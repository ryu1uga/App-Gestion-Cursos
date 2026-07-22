// ============================================================
//  Lógica de cálculo de notas ponderadas
//  Todo es puro (sin estado) para poder testearlo fácilmente.
// ============================================================

// Redondea a un paso dado (ej. step=1 -> enteros, step=0.1 -> 1 decimal)
export function roundToStep(value, step) {
  if (!step || step <= 0) return value
  return Math.round(value / step) * step
}

// Formatea una nota respetando decimales configurados.
// Si el valor NO cae en la grilla del paso (modo sin redondeo), muestra
// decimales extra para no engañar (ej. 10.65 en escala de enteros).
export function fmtGrade(value, scale) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  const step = scale?.step ?? 1
  const decimals = decimalsFromStep(step)
  const onGrid = Math.abs(value - roundToStep(value, step)) < 1e-9
  return Number(value).toFixed(onGrid ? decimals : Math.max(decimals, 2))
}

export function decimalsFromStep(step) {
  if (!step || step >= 1) return 0
  const s = String(step)
  return s.includes('.') ? s.split('.')[1].length : 0
}

// Escala por defecto (se puede sobreescribir global o por curso)
export const DEFAULT_SCALE = { min: 0, max: 20, passing: 11, step: 1 }

// Devuelve la escala efectiva de un curso: la suya propia o la global
export function effectiveScale(course, settings) {
  const base = settings?.defaultScale ?? DEFAULT_SCALE
  if (course?.scale && course.useOwnScale) {
    return { ...base, ...course.scale }
  }
  return base
}

// ------------------------------------------------------------
//  Núcleo del cálculo para un curso
// ------------------------------------------------------------
// evaluations: [{ id, name, type, week, weight (0..1 o %), grade (número|null) }]
// scale: { min, max, passing, step }
//
// Nota: weight se interpreta como el peso relativo. Si los pesos
// suman 1 (o 100), se usan tal cual (normalizados a fracción).
export function analyzeCourse(evaluations = [], scale = DEFAULT_SCALE, opts = {}) {
  // round: redondear la nota final al paso de la escala (ej. 10.65 -> 11)
  const round = opts.round !== false
  const finalize = (v) => (v == null ? v : round ? roundToStep(v, scale.step) : v)
  // Umbral efectivo sobre el valor crudo: si redondeamos, basta llegar a passing - paso/2
  const passThreshold = round ? scale.passing - (scale.step || 1) / 2 : scale.passing

  const evals = evaluations.map((e) => ({
    ...e,
    weight: Number(e.weight) || 0,
    grade: e.grade === '' || e.grade === null || e.grade === undefined ? null : Number(e.grade),
  }))

  const totalWeightRaw = evals.reduce((s, e) => s + e.weight, 0)
  // Detectar si los pesos vienen en % (>1.5) para normalizar a fracción
  const asPercent = totalWeightRaw > 1.5
  const norm = (w) => (asPercent ? w / 100 : w)

  const totalWeight = evals.reduce((s, e) => s + norm(e.weight), 0) // debería ~1
  const graded = evals.filter((e) => e.grade !== null && !Number.isNaN(e.grade))
  const pending = evals.filter((e) => e.grade === null || Number.isNaN(e.grade))

  const gradedWeight = graded.reduce((s, e) => s + norm(e.weight), 0)
  const pendingWeight = pending.reduce((s, e) => s + norm(e.weight), 0)

  // Suma ponderada de lo ya obtenido (en puntos absolutos sobre 'max')
  const earned = graded.reduce((s, e) => s + norm(e.weight) * e.grade, 0)

  // Valores crudos (sin redondear) para comparaciones internas
  const currentAvgRaw = gradedWeight > 0 ? earned / gradedWeight : null
  const rawMax = earned + pendingWeight * scale.max
  const rawMin = earned + pendingWeight * scale.min
  const projRaw = totalWeight > 0 ? earned / totalWeight : null

  // ¿Cuánto necesito (en promedio) en lo pendiente para aprobar?
  // final = earned + pendingWeight * x  >= passThreshold
  let neededAvgOnPending = null
  if (pendingWeight > 0) {
    neededAvgOnPending = (passThreshold - earned) / pendingWeight
  }

  // Estado global del curso (comparando el valor crudo contra el umbral efectivo)
  let status
  if (pendingWeight <= 1e-9) {
    status = earned >= passThreshold - 1e-9 ? 'aprobado' : 'desaprobado'
  } else if (rawMax < passThreshold - 1e-9) {
    status = 'imposible' // ni con el máximo alcanzas a aprobar
  } else if (rawMin >= passThreshold - 1e-9) {
    status = 'seguro' // ya apruebas pase lo que pase
  } else {
    status = 'en_juego' // depende de lo que saques
  }

  return {
    scale,
    round,
    passThreshold,
    asPercent,
    totalWeightRaw,
    totalWeightPct: asPercent ? totalWeightRaw : totalWeightRaw * 100,
    weightsOk: Math.abs(totalWeight - 1) < 0.005,
    graded,
    pending,
    gradedWeight,
    pendingWeight,
    earned,
    // Valores para mostrar (redondeados si corresponde)
    currentAvg: finalize(currentAvgRaw),
    maxPossible: finalize(rawMax),
    minPossible: finalize(rawMin),
    neededAvgOnPending,
    projectedIfStopNow: finalize(projRaw),
    // Crudos por si se necesitan
    currentAvgRaw,
    status,
  }
}

// ------------------------------------------------------------
//  ¿Qué nota necesito en la PRÓXIMA evaluación (una específica)?
//  Asume el mejor caso en las demás pendientes (sacar el máximo).
//  Devuelve la nota mínima necesaria en esa evaluación.
// ------------------------------------------------------------
export function neededOnNext(analysis, nextEval, scale) {
  const { earned, pendingWeight } = analysis
  const asPercent = analysis.asPercent
  const wNext = (Number(nextEval.weight) || 0) / (asPercent ? 100 : 1)
  if (wNext <= 0) return null

  const otherPendingWeight = pendingWeight - wNext
  // final = earned + otherPending*max + wNext*x >= passThreshold
  const pass = analysis.passThreshold ?? scale.passing
  const required = (pass - earned - otherPendingWeight * scale.max) / wNext

  return {
    weight: wNext,
    // valor crudo (puede salir <min o >max)
    raw: required,
    // interpretado:
    feasible: required <= scale.max + 1e-9,
    // si sale por debajo del mínimo, con cualquier nota apruebas (asumiendo max en el resto)
    triviallyOk: required <= scale.min + 1e-9,
    clamped: Math.min(scale.max, Math.max(scale.min, required)),
  }
}

export const STATUS_META = {
  aprobado:    { label: 'Aprobado',            color: 'emerald', hint: 'Curso terminado y aprobado.' },
  desaprobado: { label: 'Desaprobado',         color: 'red',     hint: 'Curso terminado sin alcanzar la nota mínima.' },
  seguro:      { label: 'Aprobado asegurado',  color: 'emerald', hint: 'Ya apruebas pase lo que pase en lo pendiente.' },
  en_juego:    { label: 'En juego',            color: 'amber',   hint: 'Depende de tus notas pendientes.' },
  imposible:   { label: 'Ya no alcanza',       color: 'red',     hint: 'Ni con el máximo en lo pendiente llegas a aprobar.' },
}
