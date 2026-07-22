import React, { useState } from 'react'
import { ScrollView, View, Text, TextInput, Pressable, Switch, Alert, StyleSheet } from 'react-native'
import { useStore } from '../lib/store.js'
import { analyzeCourse, effectiveScale, neededOnNext, fmtGrade, STATUS_META, decimalsFromStep } from '../lib/calc.js'
import { Card, Badge, Progress, PickerModal } from '../components/ui.js'
import { colors, palette, statusColor } from '../theme.js'

const TYPES = ['Examen', 'Proyecto', 'Práctica', 'Tarea', 'Exposición', 'Control', 'Evaluación', 'Otro']

export default function CourseDetailScreen({ course, onBack }) {
  const { state, dispatch } = useStore()
  const [picker, setPicker] = useState(null) // evalId con selector de tipo abierto
  const scale = effectiveScale(course, state.settings)
  const a = analyzeCourse(course.evaluations, scale, { round: state.settings.roundFinal !== false })
  const meta = STATUS_META[a.status]
  const step = scale.step || 1
  const dec = decimalsFromStep(step)

  const patchCourse = (patch) => dispatch({ type: 'UPDATE_COURSE', id: course.id, patch })
  const patchEval = (evalId, patch) => dispatch({ type: 'UPDATE_EVAL', courseId: course.id, evalId, patch })

  const nextEval = [...a.pending].sort((x, y) => (x.week ?? 99) - (y.week ?? 99))[0]
  const nextReq = nextEval ? neededOnNext(a, nextEval, scale) : null
  const pctSum = a.totalWeightPct

  const confirmDelete = () =>
    Alert.alert('Eliminar curso', `¿Eliminar "${course.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => { onBack(); dispatch({ type: 'DELETE_COURSE', id: course.id }) } },
    ])

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable onPress={onBack}><Text style={styles.back}>← Volver</Text></Pressable>

      {/* Encabezado */}
      <Card style={{ marginBottom: 12 }}>
        <View style={styles.rowCenter}>
          <TextInput value={course.name} onChangeText={(t) => patchCourse({ name: t })} style={styles.nameInput} />
          <Pressable onPress={confirmDelete} style={styles.iconBtn}><Text style={{ color: colors.red, fontSize: 16 }}>🗑</Text></Pressable>
        </View>
        <View style={styles.paletteRow}>
          {palette.map((col) => (
            <Pressable key={col} onPress={() => patchCourse({ color: col })}
              style={[styles.swatch, { backgroundColor: col }, course.color === col && styles.swatchActive]} />
          ))}
        </View>
      </Card>

      {/* Panel: nota actual */}
      <Card style={{ marginBottom: 12 }}>
        <Text style={styles.kicker}>NOTA ACTUAL</Text>
        <Text style={[styles.bigGrade, { color: course.color }]}>
          {fmtGrade(a.currentAvg, scale)}<Text style={styles.bigGradeMax}> / {scale.max}</Text>
        </Text>
        <Progress value={a.currentAvg || 0} max={scale.max} color={course.color} threshold={scale.passing} />
        <Text style={styles.hintSmall}>Promedio sobre lo ya evaluado ({Math.round(a.gradedWeight * 100)}% del curso)</Text>
      </Card>

      {/* Panel: estado + para aprobar */}
      <View style={styles.grid2}>
        <Card style={styles.gridItem}>
          <Text style={styles.kicker}>ESTADO</Text>
          <View style={{ marginTop: 6, marginBottom: 6 }}><Badge color={meta.color}>{meta.label}</Badge></View>
          <Text style={styles.hintSmall}>{meta.hint}</Text>
          <View style={styles.miniRow}>
            <View style={styles.miniBox}><Text style={styles.miniLabel}>Máx.</Text><Text style={styles.miniVal}>{fmtGrade(a.maxPossible, scale)}</Text></View>
            <View style={styles.miniBox}><Text style={styles.miniLabel}>Mín.</Text><Text style={styles.miniVal}>{fmtGrade(a.minPossible, scale)}</Text></View>
          </View>
        </Card>

        <Card style={styles.gridItem}>
          <Text style={styles.kicker}>PARA APROBAR ({scale.passing})</Text>
          {a.pendingWeight <= 0 ? (
            <Text style={styles.panelMsg}>No quedan evaluaciones pendientes.</Text>
          ) : a.status === 'imposible' ? (
            <Text style={[styles.panelMsg, { color: colors.red }]}>Ya no alcanzas {scale.passing} con lo que queda.</Text>
          ) : a.status === 'seguro' ? (
            <Text style={[styles.panelMsg, { color: colors.emerald }]}>Asegurado, incluso con el mínimo.</Text>
          ) : (
            <>
              <Text style={styles.panelMsg}>Necesitas en promedio en lo que falta:</Text>
              <Text style={[styles.bigGrade, { color: colors.amber, fontSize: 30 }]}>
                {fmtGrade(Math.max(scale.min, a.neededAvgOnPending), scale)}
                <Text style={styles.bigGradeMax}> / {scale.max}</Text>
              </Text>
              <Text style={styles.hintSmall}>sobre el {Math.round(a.pendingWeight * 100)}% restante</Text>
            </>
          )}
        </Card>
      </View>

      {/* Próxima evaluación */}
      {nextEval && nextReq && a.status !== 'seguro' && a.status !== 'imposible' && (
        <Card style={{ marginBottom: 12, borderLeftWidth: 4, borderLeftColor: colors.amber }}>
          <Text style={styles.kicker}>PRÓXIMA{nextEval.week ? ` · SEMANA ${nextEval.week}` : ''}</Text>
          <Text style={styles.nextName}>{nextEval.name} <Text style={{ color: colors.textFaint }}>({Math.round(nextReq.weight * 100)}%)</Text></Text>
          {nextReq.triviallyOk ? (
            <Text style={[styles.panelMsg, { color: colors.emerald }]}>Con cualquier nota sigues en carrera (si sacas el máximo en las demás).</Text>
          ) : nextReq.feasible ? (
            <Text style={styles.panelMsg}>Mínimo aquí (con máx. en las demás): <Text style={{ color: colors.amber, fontWeight: '800' }}>{nextReq.clamped.toFixed(dec)}</Text></Text>
          ) : (
            <Text style={[styles.panelMsg, { color: colors.red }]}>Ni con {scale.max} aquí alcanzas; dependerá de varias evaluaciones.</Text>
          )}
        </Card>
      )}

      {/* Evaluaciones */}
      <Card style={{ marginBottom: 12 }}>
        <View style={styles.evalHead}>
          <Text style={styles.sectionTitle}>Evaluaciones</Text>
          <Text style={[styles.pesos, (pctSum > 100.5 || pctSum < 99.5) && { color: colors.amber, fontWeight: '700' }]}>Pesos: {Math.round(pctSum)}%</Text>
        </View>

        {/* cabecera columnas */}
        <View style={styles.evalColsHead}>
          <Text style={[styles.colH, { flex: 1 }]}>Nombre / Tipo</Text>
          <Text style={[styles.colH, styles.wSem]}>Sem</Text>
          <Text style={[styles.colH, styles.wPeso]}>Peso%</Text>
          <Text style={[styles.colH, styles.wNota]}>Nota</Text>
          <View style={{ width: 26 }} />
        </View>

        {course.evaluations.map((e) => {
          const wPct = a.asPercent ? e.weight : (e.weight || 0) * 100
          const gradeBg = e.grade == null ? colors.slate100 : e.grade >= scale.passing ? statusColor.emerald.bg : statusColor.red.bg
          const gradeFg = e.grade == null ? colors.textFaint : e.grade >= scale.passing ? statusColor.emerald.fg : statusColor.red.fg
          return (
            <View key={e.id} style={styles.evalRow}>
              <View style={{ flex: 1, paddingRight: 6 }}>
                <TextInput value={e.name} onChangeText={(t) => patchEval(e.id, { name: t })} style={styles.evalName} />
                <Pressable onPress={() => setPicker(e.id)}><Text style={styles.evalType}>{e.type} ▾</Text></Pressable>
              </View>
              <TextInput style={[styles.cell, styles.wSem]} keyboardType="number-pad" value={e.week == null ? '' : String(e.week)} placeholder="—"
                onChangeText={(t) => patchEval(e.id, { week: t === '' ? null : Number(t) })} />
              <TextInput style={[styles.cell, styles.wPeso]} keyboardType="numeric" value={String(Number(wPct.toFixed(2)))}
                onChangeText={(t) => { const v = t === '' ? 0 : Number(t); patchEval(e.id, { weight: a.asPercent ? v : v / 100 }) }} />
              <TextInput style={[styles.cell, styles.wNota, { backgroundColor: gradeBg, color: gradeFg, fontWeight: '700' }]}
                keyboardType="numeric" value={e.grade == null ? '' : String(e.grade)} placeholder="pend."
                onChangeText={(t) => patchEval(e.id, { grade: t === '' ? null : Number(t) })} />
              <Pressable style={styles.delEval} onPress={() => dispatch({ type: 'DELETE_EVAL', courseId: course.id, evalId: e.id })}>
                <Text style={{ color: colors.red }}>✕</Text>
              </Pressable>
            </View>
          )
        })}

        <Pressable style={styles.addEval} onPress={() => dispatch({ type: 'ADD_EVAL', courseId: course.id })}>
          <Text style={styles.addEvalText}>+ Agregar evaluación</Text>
        </Pressable>
      </Card>

      {/* Escala del curso */}
      <Card style={{ marginBottom: 24 }}>
        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>Escala del curso</Text>
          <View style={styles.rowCenter}>
            <Text style={styles.switchLabel}>Propia</Text>
            <Switch value={course.useOwnScale} onValueChange={(v) => patchCourse({ useOwnScale: v })}
              trackColor={{ true: colors.brand }} />
          </View>
        </View>
        {course.useOwnScale ? (
          <View style={styles.scaleGrid}>
            <ScaleField label="Mínima" value={course.scale.min} onChange={(v) => patchCourse({ scale: { ...course.scale, min: v } })} />
            <ScaleField label="Máxima" value={course.scale.max} onChange={(v) => patchCourse({ scale: { ...course.scale, max: v } })} />
            <ScaleField label="Aprobar" value={course.scale.passing} onChange={(v) => patchCourse({ scale: { ...course.scale, passing: v } })} />
            <ScaleField label="Paso" value={course.scale.step} onChange={(v) => patchCourse({ scale: { ...course.scale, step: v } })} />
          </View>
        ) : (
          <Text style={styles.hintSmall}>Usando la escala global: 0–{scale.max}, aprueba con {scale.passing}. Actívala aquí para una escala propia (ej. 0–7).</Text>
        )}
      </Card>

      <PickerModal visible={picker != null} title="Tipo de evaluación" options={TYPES}
        value={course.evaluations.find((e) => e.id === picker)?.type}
        onSelect={(t) => patchEval(picker, { type: t })} onClose={() => setPicker(null)} />
    </ScrollView>
  )
}

function ScaleField({ label, value, onChange }) {
  return (
    <View style={styles.scaleField}>
      <Text style={styles.scaleLabel}>{label}</Text>
      <TextInput style={styles.scaleInput} keyboardType="numeric" value={String(value)}
        onChangeText={(t) => onChange(t === '' ? 0 : Number(t))} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  back: { color: colors.brand, fontWeight: '600', marginBottom: 12 },
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nameInput: { flex: 1, fontSize: 18, fontWeight: '800', color: '#0f172a', padding: 4 },
  iconBtn: { padding: 6 },
  paletteRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  swatch: { width: 26, height: 26, borderRadius: 13 },
  swatchActive: { borderWidth: 3, borderColor: '#0f172a' },
  kicker: { fontSize: 11, fontWeight: '700', color: colors.textFaint, letterSpacing: 0.5 },
  bigGrade: { fontSize: 34, fontWeight: '800', marginVertical: 6 },
  bigGradeMax: { fontSize: 15, fontWeight: '400', color: colors.textFaint },
  hintSmall: { fontSize: 12, color: colors.textSoft, marginTop: 8 },
  grid2: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  gridItem: { flex: 1 },
  panelMsg: { fontSize: 13, color: colors.textSoft, marginTop: 8 },
  miniRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  miniBox: { flex: 1, backgroundColor: colors.slate50, borderRadius: 10, padding: 8 },
  miniLabel: { fontSize: 11, color: colors.textFaint },
  miniVal: { fontSize: 14, fontWeight: '700', color: colors.text },
  nextName: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 4 },
  evalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  pesos: { fontSize: 12, color: colors.textFaint },
  evalColsHead: { flexDirection: 'row', alignItems: 'center', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.slate100 },
  colH: { fontSize: 10, color: colors.textFaint, fontWeight: '600', textTransform: 'uppercase' },
  wSem: { width: 42, textAlign: 'center' },
  wPeso: { width: 52, textAlign: 'center' },
  wNota: { width: 56, textAlign: 'center' },
  evalRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.slate50 },
  evalName: { fontSize: 14, color: colors.text, padding: 2, fontWeight: '600' },
  evalType: { fontSize: 12, color: colors.textSoft, paddingHorizontal: 2, marginTop: 2 },
  cell: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingVertical: 6, marginHorizontal: 2, color: colors.text, fontSize: 13 },
  delEval: { width: 26, alignItems: 'center' },
  addEval: { marginTop: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  addEvalText: { color: colors.brand, fontWeight: '600' },
  switchLabel: { fontSize: 13, color: colors.textSoft, marginRight: 6 },
  scaleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  scaleField: { flexGrow: 1, minWidth: 70 },
  scaleLabel: { fontSize: 11, color: colors.textSoft, marginBottom: 4 },
  scaleInput: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 8, textAlign: 'center', color: colors.text },
})
