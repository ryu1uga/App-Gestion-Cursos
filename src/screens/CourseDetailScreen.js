import React, { useState, useRef } from 'react'
import { View, Text, TextInput, Pressable, Switch, Alert, Keyboard, Modal, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import {
  NestableScrollContainer,
  NestableDraggableFlatList,
  ScaleDecorator,
} from 'react-native-draggable-flatlist'
import { useStore } from '../lib/store.js'
import { analyzeCourse, effectiveScale, effectiveRound, neededOnNext, fmtGrade, STATUS_META, decimalsFromStep } from '../lib/calc.js'
import { evalEffectiveDate, weekFromDate, notifyFireAt } from '../lib/notify.js'
import { Card, Badge, Progress, NumField, Icon, InfoButton } from '../components/ui.js'
import { colors, palette, statusColor } from '../theme.js'
import { TYPES, OTHER, MAX_TIPO, isCustomType } from '../lib/evalTypes.js'
import {
  WEEK_ORDER, dayName, MODES, MODE_LABEL, BLOCK_LABELS, MAX_LABEL, MAX_ROOM,
  minutesOf, fmtTime, weeklyMinutes, isVirtual,
} from '../lib/classes.js'


const two = (n) => String(n).padStart(2, '0')
const fmtDate = (d) => (d ? d.toLocaleDateString() : null)
const fmtDateTime = (d) => `${d.toLocaleDateString()} a las ${two(d.getHours())}:${two(d.getMinutes())}`
const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
const fullDate = (d) => `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`
// Recorta ceros/decimales innecesarios para mostrar el peso
const trimNum = (n) => String(Number(Number(n).toFixed(2)))

// "3 h 20 min" a partir de minutos sueltos.
const fmtDuration = (mins) => {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return [h ? `${h} h` : null, m ? `${m} min` : null].filter(Boolean).join(' ') || '0 min'
}

// 'HH:MM' -> Date de hoy a esa hora (lo que espera el selector de hora).
const timeToDate = (hhmm) => {
  const mins = minutesOf(hhmm)
  const d = new Date()
  d.setHours(mins == null ? 8 : Math.floor(mins / 60), mins == null ? 0 : mins % 60, 0, 0)
  return d
}
const dateToTime = (d) => `${two(d.getHours())}:${two(d.getMinutes())}`

const STEP_INFO = {
  title: 'Paso de la nota',
  text: 'Define a qué valores se ajusta (redondea) la nota final:\n\n• 1 → notas enteras (…, 10, 11, 12)\n• 0.5 → medios puntos (10, 10.5, 11)\n• 0.25 → cuartos (10, 10.25, 10.5)\n• 0.1 → un decimal (10.0, 10.1, 10.2)\n\nElige el que use tu facultad para calcular la nota final.',
}

export default function CourseDetailScreen({ course, onBack }) {
  const { state, dispatch } = useStore()
  const [editing, setEditing] = useState(null) // evalId con la hoja de edición abierta
  const [editingClass, setEditingClass] = useState(null) // id del bloque de clase abierto

  const scale = effectiveScale(course, state.settings)
  const round = effectiveRound(course, state.settings)
  const a = analyzeCourse(course.evaluations, scale, { round })
  const meta = STATUS_META[a.status]
  const step = scale.step || 1
  const dec = decimalsFromStep(step)

  const patchCourse = (patch) => dispatch({ type: 'UPDATE_COURSE', id: course.id, patch })
  const patchEval = (evalId, patch) => dispatch({ type: 'UPDATE_EVAL', courseId: course.id, evalId, patch })

  const patchSession = (sessionId, patch) => dispatch({ type: 'UPDATE_SESSION', courseId: course.id, sessionId, patch })

  // Las clases se listan de lunes a domingo. Se ordena de forma tolerante:
  // una hora a medio llenar no puede hacer desaparecer la fila.
  const sessions = [...(course.sessions ?? [])].sort((a, b) => {
    const da = WEEK_ORDER.indexOf(a.day)
    const db = WEEK_ORDER.indexOf(b.day)
    if (da !== db) return da - db
    return (minutesOf(a.start) ?? 0) - (minutesOf(b.start) ?? 0)
  })
  const semanales = weeklyMinutes(course)

  // Al mover la hora de inicio, la clase conserva su duración.
  const setStart = (s, v) => {
    const antes = minutesOf(s.start)
    const fin = minutesOf(s.end)
    const nuevo = minutesOf(v)
    if (nuevo == null || antes == null || fin == null || fin <= antes) return patchSession(s.id, { start: v })
    patchSession(s.id, { start: v, end: fmtTime(nuevo + (fin - antes)) })
  }

  // La hora de fin nunca puede quedar antes del inicio.
  const setEnd = (s, v) => {
    const ini = minutesOf(s.start)
    const nuevo = minutesOf(v)
    if (nuevo != null && ini != null && nuevo <= ini) return patchSession(s.id, { end: fmtTime(ini + 30) })
    patchSession(s.id, { end: v })
  }

  // Fija la fecha exacta de una evaluación y, si hay fecha de inicio, calcula la semana.
  const setEvalDate = (evalId, iso) => {
    const week = course.startDate ? weekFromDate(course.startDate, iso) : null
    patchEval(evalId, week != null ? { date: iso, week } : { date: iso })
  }

  // Próxima evaluación pendiente: por fecha efectiva (día exacto o derivado), luego por semana.
  const pendingSorted = a.pending
    .map((e) => ({ e, d: evalEffectiveDate(course, e) }))
    .sort((x, y) => {
      if (x.d && y.d) return x.d - y.d
      if (x.d) return -1
      if (y.d) return 1
      return (x.e.week ?? 99) - (y.e.week ?? 99)
    })
  const nextEval = pendingSorted[0]?.e
  const nextDate = pendingSorted[0]?.d || null
  const nextReq = nextEval ? neededOnNext(a, nextEval, scale) : null
  const nextFire = state.settings.notificationsOn && nextDate
    ? notifyFireAt(nextDate, Number(state.settings.notifyDaysBefore ?? 2), Number(state.settings.notifyHour ?? 9), Number(state.settings.notifyMinute ?? 0))
    : null
  const pctSum = a.totalWeightPct

  const roundOn = course.useOwnScale && course.roundFinal != null
    ? course.roundFinal !== false
    : state.settings.roundFinal !== false

  const confirmDelete = () =>
    Alert.alert('Eliminar curso', `¿Eliminar "${course.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => { onBack(); dispatch({ type: 'DELETE_COURSE', id: course.id }) } },
    ])

  const renderEval = ({ item: e, drag, isActive }) => {
    const wPct = a.asPercent ? e.weight : (e.weight || 0) * 100
    const done = e.grade != null
    const passed = done && e.grade >= scale.passing
    const barColor = !done ? colors.border : passed ? statusColor.emerald.fg : statusColor.red.fg
    const gradeBg = !done ? colors.slate50 : passed ? statusColor.emerald.bg : statusColor.red.bg
    const gradeFg = !done ? colors.textFaint : passed ? statusColor.emerald.fg : statusColor.red.fg
    const metaLine = [e.type, e.week != null ? `Sem ${e.week}` : null, e.date ? fullDate(new Date(e.date)) : null]
      .filter(Boolean).join('  ·  ')
    return (
      <ScaleDecorator>
        <Pressable onPress={() => setEditing(e.id)} onLongPress={drag} delayLongPress={220}
          style={[styles.evalRow, isActive && styles.evalRowActive]}>
          <Pressable onLongPress={drag} delayLongPress={120} style={styles.dragHandle} hitSlop={8}>
            <Icon name="menu" size={17} color={colors.textFaint} />
          </Pressable>
          <View style={[styles.statusBar, { backgroundColor: barColor }]} />
          <View style={styles.evalMid}>
            <Text style={styles.evalTitle} numberOfLines={1}>{e.name || 'Sin nombre'}</Text>
            <Text style={styles.evalMeta} numberOfLines={1}>{metaLine}</Text>
          </View>
          <Text style={styles.evalWeight}>{trimNum(wPct)}%</Text>
          <View style={[styles.gradeBox, { backgroundColor: gradeBg }, !done && styles.gradeBoxPend]}>
            {done
              ? <Text style={[styles.gradeText, { color: gradeFg }]}>{fmtGrade(e.grade, scale)}</Text>
              : <Text style={styles.gradePendText}>pend</Text>}
          </View>
        </Pressable>
      </ScaleDecorator>
    )
  }

  const editingEval = editing != null ? course.evaluations.find((x) => x.id === editing) : null
  const editingSession = editingClass != null ? sessions.find((x) => x.id === editingClass) : null

  return (
    <NestableScrollContainer contentContainerStyle={styles.container}>
      <Pressable onPress={onBack} style={styles.backRow} hitSlop={8}>
        <Icon name="arrow-left" size={18} color={colors.brand} />
        <Text style={styles.back}>Volver</Text>
      </Pressable>

      {/* Encabezado */}
      <Card style={{ marginBottom: 12 }}>
        <View style={styles.rowCenter}>
          <TextInput value={course.name} onChangeText={(t) => patchCourse({ name: t })} style={styles.nameInput} />
          <Pressable onPress={confirmDelete} style={styles.iconBtn} hitSlop={8}><Icon name="trash-2" size={18} color={colors.red} /></Pressable>
        </View>
        <View style={styles.paletteRow}>
          {palette.map((col) => (
            <Pressable key={col} onPress={() => patchCourse({ color: col })}
              style={[styles.swatch, { backgroundColor: col }, course.color === col && styles.swatchActive]} />
          ))}
        </View>
        {/* Fechas del curso */}
        <View style={styles.datesRow}>
          <DateField label="Inicio" value={course.startDate}
            onChange={(iso) => patchCourse({ startDate: iso })} />
          <DateField label="Fin" value={course.endDate} minimumDate={course.startDate ? new Date(course.startDate) : undefined}
            onChange={(iso) => patchCourse({ endDate: iso })} />
        </View>
        {course.startDate ? (
          <Text style={styles.datesHint}>Cada evaluación toma su fecha del inicio más su semana. Con el ícono de calendario fijas el día exacto y calculo la semana.</Text>
        ) : (
          <Text style={styles.datesHint}>Pon la fecha de inicio para calcular cuándo cae cada evaluación, o fija el día exacto con el ícono de calendario de cada fila.</Text>
        )}
      </Card>

      {/* Panel: nota actual */}
      <Card style={{ marginBottom: 12 }}>
        <Text style={styles.kicker}>NOTA ACTUAL</Text>
        <Text style={[styles.bigGrade, { color: course.color }]}>
          {fmtGrade(a.currentAvg, scale)}<Text style={styles.bigGradeMax}> / {scale.max}</Text>
        </Text>
        <Progress value={a.currentAvg || 0} max={scale.max} color={course.color} threshold={scale.passing} />
        <Text style={styles.hintSmall}>Vas por el {Math.round(a.gradedWeight * 100)}% del curso ya rendido.</Text>
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
            <Text style={styles.panelMsg}>Ya no queda nada pendiente.</Text>
          ) : a.status === 'imposible' ? (
            <Text style={[styles.panelMsg, { color: colors.red }]}>Ya no da para {scale.passing} con lo que queda.</Text>
          ) : a.status === 'seguro' ? (
            <Text style={[styles.panelMsg, { color: colors.emerald }]}>Asegurado, aunque saques lo mínimo.</Text>
          ) : (
            <>
              <Text style={styles.panelMsg}>Te falta sacar, en promedio:</Text>
              <Text style={[styles.bigGrade, { color: colors.amber, fontSize: 30 }]}>
                {fmtGrade(Math.max(scale.min, a.neededAvgOnPending), scale)}
                <Text style={styles.bigGradeMax}> / {scale.max}</Text>
              </Text>
              <Text style={styles.hintSmall}>en el {Math.round(a.pendingWeight * 100)}% que queda</Text>
            </>
          )}
        </Card>
      </View>

      {/* Próxima evaluación */}
      {nextEval && nextReq && a.status !== 'seguro' && a.status !== 'imposible' && (
        <Card style={{ marginBottom: 12, borderLeftWidth: 4, borderLeftColor: colors.amber }}>
          <Text style={styles.kicker}>
            PRÓXIMA{nextEval.week ? ` · SEMANA ${nextEval.week}` : ''}{nextDate ? ` · ${fmtDate(nextDate)}` : ''}
          </Text>
          <Text style={styles.nextName}>{nextEval.name} <Text style={{ color: colors.textFaint }}>({Math.round(nextReq.weight * 100)}%)</Text></Text>
          {nextReq.triviallyOk ? (
            <Text style={[styles.panelMsg, { color: colors.emerald }]}>Con cualquier nota sigues, si clavas el resto.</Text>
          ) : nextReq.feasible ? (
            <Text style={styles.panelMsg}>Mínimo aquí, sacando el máximo en lo demás: <Text style={{ color: colors.amber, fontWeight: '800' }}>{nextReq.clamped.toFixed(dec)}</Text></Text>
          ) : (
            <Text style={[styles.panelMsg, { color: colors.red }]}>Ni con {scale.max} aquí basta; te la juegas en varias.</Text>
          )}
          {nextFire && (
            <View style={styles.notifyRow}>
              <Icon name="bell" size={13} color={colors.textFaint} />
              <Text style={styles.notifyText}>
                {nextFire.getTime() > Date.now()
                  ? `Te aviso el ${fmtDateTime(nextFire)}`
                  : `El aviso ya pasó (${fmtDateTime(nextFire)})`}
              </Text>
            </View>
          )}
        </Card>
      )}

      {/* Evaluaciones */}
      <Card style={{ marginBottom: 12 }}>
        <View style={styles.evalHead}>
          <Text style={styles.sectionTitle}>Evaluaciones</Text>
          <Text style={[styles.pesos, (pctSum > 100.5 || pctSum < 99.5) && { color: colors.amber, fontWeight: '700' }]}>Pesos: {Math.round(pctSum)}%</Text>
        </View>

        {course.evaluations.length > 0 && (
          <Text style={styles.reorderHint}>
            {course.evaluations.length > 1
              ? 'Toca una evaluación para editarla · mantén pulsada el asa para reordenar'
              : 'Toca la evaluación para editarla'}
          </Text>
        )}

        <NestableDraggableFlatList
          data={course.evaluations}
          keyExtractor={(e) => e.id}
          renderItem={renderEval}
          onDragEnd={({ data }) => dispatch({ type: 'REORDER_EVALS', courseId: course.id, evaluations: data })}
          activationDistance={12}
        />

        <Pressable style={styles.addEval} onPress={() => dispatch({ type: 'ADD_EVAL', courseId: course.id })}>
          <Text style={styles.addEvalText}>+ Agregar evaluación</Text>
        </Pressable>
      </Card>

      {/* Clases (horario semanal) */}
      <Card style={{ marginBottom: 12 }}>
        <View style={styles.evalHead}>
          <Text style={styles.sectionTitle}>Clases</Text>
          {sessions.length > 0 && <Text style={styles.pesos}>{fmtDuration(semanales)} a la semana</Text>}
        </View>
        <Text style={styles.reorderHint}>
          Los días y horas en que te toca este curso. Salen todos juntos en la pestaña Horario.
        </Text>

        {sessions.map((s) => {
          const incompleta = minutesOf(s.start) == null || minutesOf(s.end) == null
          return (
            <Pressable key={s.id} style={styles.classRow} onPress={() => setEditingClass(s.id)}>
              <Text style={styles.classDay}>{dayName(s.day)}</Text>
              <View style={[
                styles.classBar,
                { backgroundColor: course.color },
                isVirtual(s) && styles.classBarVirtual,
              ]} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.classTime, incompleta && { color: colors.amber }]}>
                  {incompleta ? 'Falta la hora' : `${s.start} – ${s.end}`}
                </Text>
                <Text style={styles.classMeta} numberOfLines={1}>
                  {[s.label, s.room].filter(Boolean).join('  ·  ') || (isVirtual(s) ? 'Sin sala' : 'Sin aula')}
                </Text>
              </View>
              <View style={styles.classTag}>
                <Text style={styles.classTagText}>{MODE_LABEL[s.mode] || MODE_LABEL.presencial}</Text>
              </View>
            </Pressable>
          )
        })}

        <Pressable style={styles.addEval} onPress={() => dispatch({ type: 'ADD_SESSION', courseId: course.id })}>
          <Text style={styles.addEvalText}>+ Agregar clase</Text>
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
          <>
            <View style={styles.scaleGrid}>
              <ScaleField label="Mínima" value={course.scale.min} onChange={(v) => patchCourse({ scale: { ...course.scale, min: v } })} />
              <ScaleField label="Máxima" value={course.scale.max} onChange={(v) => patchCourse({ scale: { ...course.scale, max: v } })} />
              <ScaleField label="Aprobar" value={course.scale.passing} onChange={(v) => patchCourse({ scale: { ...course.scale, passing: v } })} />
              <ScaleField label="Paso" value={course.scale.step} onChange={(v) => patchCourse({ scale: { ...course.scale, step: v } })} info={STEP_INFO} />
            </View>
            <View style={styles.roundRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.toggleTitle}>Redondear nota final</Text>
                <Text style={styles.hintSmall}>Redondea 10.65 a 11. Solo aquí, y manda sobre el ajuste global.</Text>
              </View>
              <Switch value={roundOn} trackColor={{ true: colors.brand }}
                onValueChange={(v) => patchCourse({ roundFinal: v })} />
            </View>
          </>
        ) : (
          <Text style={styles.hintSmall}>Usa la escala global ({scale.min}–{scale.max}, aprueba con {scale.passing}). Actívala para darle a este curso su escala y su redondeo.</Text>
        )}
      </Card>

      {editingEval && (
        <EvalSheet
          ev={editingEval}
          course={course}
          asPercent={a.asPercent}
          scale={scale}
          onPatch={(patch) => patchEval(editingEval.id, patch)}
          onSetDate={(iso) => setEvalDate(editingEval.id, iso)}
          onClose={() => setEditing(null)}
          onDelete={() => {
            const id = editingEval.id
            Alert.alert('Eliminar evaluación', `¿Eliminar "${editingEval.name || 'esta evaluación'}"?`, [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Eliminar', style: 'destructive', onPress: () => { setEditing(null); dispatch({ type: 'DELETE_EVAL', courseId: course.id, evalId: id }) } },
            ])
          }}
        />
      )}
      {editingSession && (
        <ClassSheet
          s={editingSession}
          onPatch={(patch) => patchSession(editingSession.id, patch)}
          onSetStart={(v) => setStart(editingSession, v)}
          onSetEnd={(v) => setEnd(editingSession, v)}
          onClose={() => setEditingClass(null)}
          onDelete={() => {
            const id = editingSession.id
            Alert.alert('Eliminar clase', '¿Quitar este bloque del horario?', [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Eliminar', style: 'destructive', onPress: () => { setEditingClass(null); dispatch({ type: 'DELETE_SESSION', courseId: course.id, sessionId: id }) } },
            ])
          }}
        />
      )}
    </NestableScrollContainer>
  )
}

// Hoja inferior de un bloque de clase. Como la de evaluaciones, guarda al
// instante en el store; el botón solo cierra.
function ClassSheet({ s, onPatch, onSetStart, onSetEnd, onClose, onDelete }) {
  const [picking, setPicking] = useState(null) // 'start' | 'end'

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetRoot}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
            <View style={styles.grab} />

            <Text style={styles.sheetLabel}>Día</Text>
            <View style={styles.typeGrid}>
              {WEEK_ORDER.map((d) => (
                <Pressable key={d} onPress={() => onPatch({ day: d })}
                  style={[styles.typePill, s.day === d && styles.typePillOn]}>
                  <Text style={[styles.typePillText, s.day === d && styles.typePillTextOn]}>{dayName(d)}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.sheetRow}>
              <View style={styles.sheetField}>
                <Text style={styles.sheetLabel}>Inicio</Text>
                <Pressable style={styles.sheetTimeBtn} onPress={() => setPicking('start')}>
                  <Icon name="clock" size={15} color={colors.brand} />
                  <Text style={styles.sheetDateText}>{s.start || '--:--'}</Text>
                </Pressable>
              </View>
              <View style={styles.sheetField}>
                <Text style={styles.sheetLabel}>Fin</Text>
                <Pressable style={styles.sheetTimeBtn} onPress={() => setPicking('end')}>
                  <Icon name="clock" size={15} color={colors.brand} />
                  <Text style={styles.sheetDateText}>{s.end || '--:--'}</Text>
                </Pressable>
              </View>
            </View>

            <View style={{ marginTop: 16 }}>
              <Text style={styles.sheetLabel}>Modalidad</Text>
              <View style={styles.typeGrid}>
                {MODES.map((m) => (
                  <Pressable key={m} onPress={() => onPatch({ mode: m })}
                    style={[styles.typePill, s.mode === m && styles.typePillOn]}>
                    <Text style={[styles.typePillText, s.mode === m && styles.typePillTextOn]}>{MODE_LABEL[m]}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <Text style={styles.sheetLabel}>Bloque</Text>
            <View style={styles.typeGrid}>
              {BLOCK_LABELS.map((l) => (
                <Pressable key={l} onPress={() => onPatch({ label: s.label === l ? '' : l })}
                  style={[styles.typePill, s.label === l && styles.typePillOn]}>
                  <Text style={[styles.typePillText, s.label === l && styles.typePillTextOn]}>{l}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput value={s.label || ''} onChangeText={(v) => onPatch({ label: v })}
              style={styles.otherInput} placeholder="O escríbelo tú" placeholderTextColor={colors.textFaint}
              maxLength={MAX_LABEL} returnKeyType="done" onSubmitEditing={() => Keyboard.dismiss()} />

            <Text style={styles.sheetLabel}>Aula</Text>
            <TextInput value={s.room || ''} onChangeText={(v) => onPatch({ room: v })}
              style={styles.otherInput} maxLength={MAX_ROOM}
              placeholder={s.mode === 'virtual' ? 'Sala, plataforma…' : 'B-204'}
              placeholderTextColor={colors.textFaint} returnKeyType="done" onSubmitEditing={() => Keyboard.dismiss()} />

            <View style={styles.sheetBtns}>
              <Pressable style={styles.sheetDel} onPress={onDelete}>
                <Icon name="trash-2" size={15} color={colors.red} />
                <Text style={styles.sheetDelText}>Eliminar</Text>
              </Pressable>
              <Pressable style={styles.sheetOk} onPress={onClose}>
                <Text style={styles.sheetOkText}>Listo</Text>
              </Pressable>
            </View>

            {picking && (
              <DateTimePicker
                mode="time"
                is24Hour
                value={timeToDate(picking === 'start' ? s.start : s.end)}
                onChange={(event, sel) => {
                  const cual = picking
                  setPicking(null)
                  if (event.type === 'set' && sel) {
                    const v = dateToTime(sel)
                    if (cual === 'start') onSetStart(v); else onSetEnd(v)
                  }
                }}
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}

// Hoja inferior con todos los campos de una evaluación. Los cambios se
// guardan al instante en el store; el botón solo cierra.
function EvalSheet({ ev, course, asPercent, scale, onPatch, onSetDate, onClose, onDelete }) {
  const [showDate, setShowDate] = useState(false)
  const [focusOther, setFocusOther] = useState(false)
  const isCustom = isCustomType(ev.type)
  const refs = useRef({})
  const setRef = (k) => (r) => { if (r) refs.current[k] = r; else delete refs.current[k] }
  const focus = (k) => refs.current[k]?.focus?.()
  const wPct = asPercent ? ev.weight : (ev.weight || 0) * 100

  // Si sale con el tipo libre vacio, se guarda "Otro" para que la
  // evaluacion nunca quede sin tipo.
  const close = () => {
    if (!String(ev.type || '').trim()) onPatch({ type: OTHER })
    onClose()
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={close}>
      <View style={styles.sheetRoot}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
            <View style={styles.grab} />

            <TextInput value={ev.name} onChangeText={(t) => onPatch({ name: t })} style={styles.sheetName}
              placeholder="Nombre de la evaluación" placeholderTextColor={colors.textFaint} />

            <Text style={styles.sheetLabel}>Tipo</Text>
            <View style={[styles.typeGrid, isCustom && { marginBottom: 8 }]}>
              {TYPES.map((t) => (
                <Pressable key={t} onPress={() => { setFocusOther(false); onPatch({ type: t }) }}
                  style={[styles.typePill, ev.type === t && styles.typePillOn]}>
                  <Text style={[styles.typePillText, ev.type === t && styles.typePillTextOn]}>{t}</Text>
                </Pressable>
              ))}
              <Pressable onPress={() => { if (!isCustom) onPatch({ type: '' }); setFocusOther(true) }}
                style={[styles.typePill, isCustom && styles.typePillOn]}>
                <Text style={[styles.typePillText, isCustom && styles.typePillTextOn]}>Otro…</Text>
              </Pressable>
            </View>
            {isCustom && (
              <TextInput value={ev.type} onChangeText={(t) => onPatch({ type: t })}
                style={styles.otherInput} placeholder="¿Cómo se llama este tipo?"
                placeholderTextColor={colors.textFaint} maxLength={MAX_TIPO}
                autoFocus={focusOther} returnKeyType="done" onSubmitEditing={() => Keyboard.dismiss()} />
            )}

            <Text style={styles.sheetLabel}>Fecha</Text>
            <View style={styles.rowCenter}>
              <Pressable style={styles.sheetDateBtn} onPress={() => setShowDate(true)}>
                <Icon name="calendar" size={15} color={ev.date ? colors.brand : colors.textFaint} />
                <Text style={[styles.sheetDateText, !ev.date && { color: colors.textFaint, fontWeight: '500' }]}>
                  {ev.date ? fullDate(new Date(ev.date)) : 'Sin fecha'}
                </Text>
              </Pressable>
              {ev.date ? (
                <Pressable style={styles.sheetDateClear} hitSlop={8} onPress={() => onPatch({ date: null })}>
                  <Icon name="x" size={15} color={colors.textFaint} />
                </Pressable>
              ) : null}
            </View>

            <View style={styles.sheetRow}>
              <View style={styles.sheetField}>
                <Text style={styles.sheetLabel}>Semana</Text>
                <NumField ref={setRef('week')} style={styles.sheetInput} integer allowEmpty placeholder="—"
                  value={ev.week} onChangeNumber={(v) => onPatch({ week: v })} onNext={() => focus('weight')} />
              </View>
              <View style={styles.sheetField}>
                <Text style={styles.sheetLabel}>Peso %</Text>
                <NumField ref={setRef('weight')} style={styles.sheetInput} value={wPct} format={trimNum}
                  onChangeNumber={(v) => onPatch({ weight: asPercent ? v : v / 100 })} onNext={() => focus('grade')} />
              </View>
              <View style={styles.sheetField}>
                <Text style={styles.sheetLabel}>Nota</Text>
                <NumField ref={setRef('grade')} style={styles.sheetInput} allowEmpty placeholder="pend."
                  value={ev.grade} onChangeNumber={(v) => onPatch({ grade: v })} onNext={() => Keyboard.dismiss()} />
              </View>
            </View>
            <Text style={styles.sheetHint}>Escala {scale.min}–{scale.max}, aprueba con {scale.passing}.</Text>

            <View style={styles.sheetBtns}>
              <Pressable style={styles.sheetDel} onPress={onDelete}>
                <Icon name="trash-2" size={15} color={colors.red} />
                <Text style={styles.sheetDelText}>Eliminar</Text>
              </Pressable>
              <Pressable style={styles.sheetOk} onPress={close}>
                <Text style={styles.sheetOkText}>Listo</Text>
              </Pressable>
            </View>

            {showDate && (
              <DateTimePicker
                value={ev.date ? new Date(ev.date) : (course.startDate ? new Date(course.startDate) : new Date())}
                mode="date"
                onChange={(event, selected) => {
                  setShowDate(false)
                  if (event.type === 'set' && selected) onSetDate(selected.toISOString())
                }}
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}

function DateField({ label, value, onChange, minimumDate }) {
  const [show, setShow] = useState(false)
  const d = value ? new Date(value) : null
  return (
    <View style={styles.dateField}>
      <Text style={styles.scaleLabel}>{label}</Text>
      <View style={styles.dateBtnRow}>
        <Pressable style={styles.dateBtn} onPress={() => setShow(true)}>
          <Text style={[styles.dateBtnText, !d && { color: colors.textFaint }]}>{d ? d.toLocaleDateString() : 'Elegir'}</Text>
        </Pressable>
        {d && (
          <Pressable style={styles.dateClearBtn} onPress={() => onChange(null)} hitSlop={6}>
            <Icon name="x" size={14} color={colors.textFaint} />
          </Pressable>
        )}
      </View>
      {show && (
        <DateTimePicker
          value={d || new Date()}
          mode="date"
          minimumDate={minimumDate}
          onChange={(event, selected) => {
            setShow(false)
            if (event.type === 'set' && selected) onChange(selected.toISOString())
          }}
        />
      )}
    </View>
  )
}

function ScaleField({ label, value, onChange, info }) {
  return (
    <View style={styles.scaleField}>
      <View style={styles.scaleLabelRow}>
        <Text style={styles.scaleLabel}>{label}</Text>
        {info ? <InfoButton title={info.title} text={info.text} size={13} /> : null}
      </View>
      <NumField style={styles.scaleInput} value={value} onChangeNumber={(v) => onChange(v)} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  back: { color: colors.brand, fontWeight: '600' },
  scaleLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nameInput: { flex: 1, fontSize: 18, fontWeight: '800', color: colors.text, padding: 4 },
  iconBtn: { padding: 6 },
  paletteRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  swatch: { width: 26, height: 26, borderRadius: 13 },
  swatchActive: { borderWidth: 3, borderColor: colors.text },
  datesRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  datesHint: { fontSize: 12, color: colors.textSoft, marginTop: 8 },
  dateField: { flex: 1 },
  dateBtnRow: { flexDirection: 'row', alignItems: 'center' },
  dateBtn: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 10 },
  dateBtnText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  dateClearBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  dateClear: { color: colors.textFaint, fontSize: 14 },
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
  notifyRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.slate50 },
  notifyText: { fontSize: 12, color: colors.textSoft, flexShrink: 1 },
  evalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  pesos: { fontSize: 12, color: colors.textFaint },
  reorderHint: { fontSize: 11, color: colors.textFaint, marginBottom: 8, lineHeight: 15 },
  // --- fila de lectura ---
  evalRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.slate50, backgroundColor: colors.card },
  evalRowActive: { backgroundColor: colors.slate50, borderRadius: 12 },
  dragHandle: { width: 20, alignItems: 'center', justifyContent: 'center' },
  statusBar: { width: 3, alignSelf: 'stretch', borderRadius: 2, opacity: 0.8 },
  evalMid: { flex: 1, minWidth: 0 },
  evalTitle: { fontSize: 14.5, fontWeight: '700', color: colors.text },
  evalMeta: { fontSize: 11.5, color: colors.textSoft, marginTop: 3 },
  evalWeight: { fontSize: 11.5, color: colors.textFaint, fontWeight: '600' },
  gradeBox: { minWidth: 52, paddingHorizontal: 6, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  gradeBoxPend: { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border },
  gradeText: { fontSize: 17, fontWeight: '800' },
  gradePendText: { fontSize: 10, fontWeight: '700', color: colors.textFaint, textTransform: 'uppercase', letterSpacing: 0.4 },

  // --- hoja de edición ---
  sheetRoot: { flex: 1, backgroundColor: 'rgba(51,45,42,0.42)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 28 },
  grab: { width: 38, height: 4, borderRadius: 2, backgroundColor: colors.slate100, alignSelf: 'center', marginBottom: 14 },
  sheetName: { fontSize: 17, fontWeight: '800', color: colors.text, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 6, marginBottom: 14 },
  sheetLabel: { fontSize: 10, fontWeight: '700', color: colors.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 16 },
  typePill: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.slate50, borderWidth: 1, borderColor: colors.border },
  typePillOn: { backgroundColor: colors.brandLight, borderColor: colors.brand },
  typePillText: { fontSize: 12.5, color: colors.textSoft, fontWeight: '600' },
  typePillTextOn: { color: colors.brandDark, fontWeight: '800' },
  otherInput: { borderWidth: 1, borderColor: colors.brand, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text, backgroundColor: colors.card, marginBottom: 16 },
  sheetDateBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11 },
  sheetDateText: { fontSize: 14, color: colors.brand, fontWeight: '700' },
  // Igual que sheetDateBtn pero SIN flex: 1. El de fecha vive en una fila,
  // donde flex:1 reparte ancho; el de hora vive en una columna (sheetField),
  // donde flex:1 vale flexBasis 0 y aplasta el botón hasta ocultar la hora.
  sheetTimeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 11,
  },
  sheetDateClear: { width: 34, alignItems: 'center' },
  sheetRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  sheetField: { flex: 1 },
  sheetInput: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 8, fontSize: 15, color: colors.text, textAlign: 'center', backgroundColor: colors.card },
  sheetHint: { fontSize: 11, color: colors.textFaint, marginTop: 8 },
  sheetBtns: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20 },
  sheetDel: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  sheetDelText: { color: colors.red, fontWeight: '700', fontSize: 14 },
  sheetOk: { flex: 1, alignItems: 'center', paddingVertical: 13, borderRadius: 12, backgroundColor: colors.brand },
  sheetOkText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  addEval: { marginTop: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  addEvalText: { color: colors.brand, fontWeight: '600' },
  switchLabel: { fontSize: 13, color: colors.textSoft, marginRight: 6 },
  roundRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, backgroundColor: colors.slate50, borderRadius: 12, padding: 12 },
  toggleTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 2 },
  scaleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  scaleField: { flexGrow: 1, minWidth: 70 },
  scaleLabel: { fontSize: 11, color: colors.textSoft, marginBottom: 4 },
  scaleInput: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 8, textAlign: 'center', color: colors.text },

  // --- clases del horario ---
  classRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderTopWidth: 1, borderTopColor: colors.slate50 },
  classDay: { width: 34, fontSize: 12.5, fontWeight: '800', color: colors.text },
  classBar: { width: 4, alignSelf: 'stretch', borderRadius: 3 },
  // Virtual: la misma barra, atenuada. El borde punteado sobre 4 px de ancho
  // se veía como una escalerita de puntos en vez de una línea.
  classBarVirtual: { opacity: 0.4 },
  classTime: { fontSize: 14, fontWeight: '700', color: colors.text },
  classMeta: { fontSize: 11.5, color: colors.textSoft, marginTop: 2 },
  classTag: { backgroundColor: colors.slate100, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  classTagText: { fontSize: 10.5, fontWeight: '700', color: colors.textSoft },
})
