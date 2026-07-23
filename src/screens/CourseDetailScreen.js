import React, { useState } from 'react'
import { View, Text, TextInput, Pressable, Switch, Alert, StyleSheet } from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import {
  NestableScrollContainer,
  NestableDraggableFlatList,
  ScaleDecorator,
} from 'react-native-draggable-flatlist'
import { useStore } from '../lib/store.js'
import { analyzeCourse, effectiveScale, effectiveRound, neededOnNext, fmtGrade, STATUS_META, decimalsFromStep } from '../lib/calc.js'
import { evalDate } from '../lib/notify.js'
import { Card, Badge, Progress, PickerModal, NumField, Icon } from '../components/ui.js'
import { colors, palette, statusColor } from '../theme.js'

const TYPES = ['Examen', 'Proyecto', 'Práctica', 'Tarea', 'Exposición', 'Control', 'Evaluación', 'Otro']

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString() : null)
// Recorta ceros/decimales innecesarios para mostrar el peso
const trimNum = (n) => String(Number(Number(n).toFixed(2)))

export default function CourseDetailScreen({ course, onBack }) {
  const { state, dispatch } = useStore()
  const [picker, setPicker] = useState(null) // evalId con selector de tipo abierto
  const scale = effectiveScale(course, state.settings)
  const round = effectiveRound(course, state.settings)
  const a = analyzeCourse(course.evaluations, scale, { round })
  const meta = STATUS_META[a.status]
  const step = scale.step || 1
  const dec = decimalsFromStep(step)

  const patchCourse = (patch) => dispatch({ type: 'UPDATE_COURSE', id: course.id, patch })
  const patchEval = (evalId, patch) => dispatch({ type: 'UPDATE_EVAL', courseId: course.id, evalId, patch })

  const nextEval = [...a.pending].sort((x, y) => (x.week ?? 99) - (y.week ?? 99))[0]
  const nextReq = nextEval ? neededOnNext(a, nextEval, scale) : null
  const nextDate = nextEval && course.startDate ? evalDate(course.startDate, nextEval.week) : null
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
    const gradeBg = e.grade == null ? colors.slate100 : e.grade >= scale.passing ? statusColor.emerald.bg : statusColor.red.bg
    const gradeFg = e.grade == null ? colors.textFaint : e.grade >= scale.passing ? statusColor.emerald.fg : statusColor.red.fg
    return (
      <ScaleDecorator>
        <View style={[styles.evalRow, isActive && styles.evalRowActive]}>
          <Pressable onLongPress={drag} delayLongPress={120} style={styles.dragHandle} hitSlop={8}>
            <Icon name="menu" size={18} color={colors.textFaint} />
          </Pressable>
          <View style={{ flex: 1, paddingRight: 6 }}>
            <TextInput value={e.name} onChangeText={(t) => patchEval(e.id, { name: t })} style={styles.evalName} />
            <Pressable onPress={() => setPicker(e.id)} style={styles.typeRow}>
              <Text style={styles.evalType}>{e.type}</Text>
              <Icon name="chevron-down" size={13} color={colors.textSoft} />
            </Pressable>
          </View>
          <NumField style={[styles.cell, styles.wSem]} integer allowEmpty placeholder="—"
            value={e.week} onChangeNumber={(v) => patchEval(e.id, { week: v })} />
          <NumField style={[styles.cell, styles.wPeso]} value={wPct} format={trimNum}
            onChangeNumber={(v) => patchEval(e.id, { weight: a.asPercent ? v : v / 100 })} />
          <NumField style={[styles.cell, styles.wNota, { backgroundColor: gradeBg, color: gradeFg, fontWeight: '700' }]}
            value={e.grade} allowEmpty placeholder="pend."
            onChangeNumber={(v) => patchEval(e.id, { grade: v })} />
          <Pressable style={styles.delEval} hitSlop={6} onPress={() => dispatch({ type: 'DELETE_EVAL', courseId: course.id, evalId: e.id })}>
            <Icon name="x" size={16} color={colors.textFaint} />
          </Pressable>
        </View>
      </ScaleDecorator>
    )
  }

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
          <Text style={styles.datesHint}>Cada evaluación toma su fecha del inicio más su semana.</Text>
        ) : (
          <Text style={styles.datesHint}>Pon la fecha de inicio y calculo cuándo cae cada evaluación.</Text>
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
            PRÓXIMA{nextEval.week ? ` · SEMANA ${nextEval.week}` : ''}{nextDate ? ` · ${fmtDate(nextDate.toISOString())}` : ''}
          </Text>
          <Text style={styles.nextName}>{nextEval.name} <Text style={{ color: colors.textFaint }}>({Math.round(nextReq.weight * 100)}%)</Text></Text>
          {nextReq.triviallyOk ? (
            <Text style={[styles.panelMsg, { color: colors.emerald }]}>Con cualquier nota sigues, si clavas el resto.</Text>
          ) : nextReq.feasible ? (
            <Text style={styles.panelMsg}>Mínimo aquí, sacando el máximo en lo demás: <Text style={{ color: colors.amber, fontWeight: '800' }}>{nextReq.clamped.toFixed(dec)}</Text></Text>
          ) : (
            <Text style={[styles.panelMsg, { color: colors.red }]}>Ni con {scale.max} aquí basta; te la juegas en varias.</Text>
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
          <View style={{ width: 22 }} />
          <Text style={[styles.colH, { flex: 1 }]}>Nombre / Tipo</Text>
          <Text style={[styles.colH, styles.wSem]}>Sem</Text>
          <Text style={[styles.colH, styles.wPeso]}>Peso%</Text>
          <Text style={[styles.colH, styles.wNota]}>Nota</Text>
          <View style={{ width: 26 }} />
        </View>

        {course.evaluations.length > 1 && (
          <Text style={styles.reorderHint}>Mantén pulsada el asa y arrastra para reordenar.</Text>
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
              <ScaleField label="Paso" value={course.scale.step} onChange={(v) => patchCourse({ scale: { ...course.scale, step: v } })} />
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
          <Text style={styles.hintSmall}>Usa la escala global (0–{scale.max}, aprueba con {scale.passing}). Actívala para darle a este curso su escala y su redondeo.</Text>
        )}
      </Card>

      <PickerModal visible={picker != null} title="Tipo de evaluación" options={TYPES}
        value={course.evaluations.find((e) => e.id === picker)?.type}
        onSelect={(t) => patchEval(picker, { type: t })} onClose={() => setPicker(null)} />
    </NestableScrollContainer>
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

function ScaleField({ label, value, onChange }) {
  return (
    <View style={styles.scaleField}>
      <Text style={styles.scaleLabel}>{label}</Text>
      <NumField style={styles.scaleInput} value={value} onChangeNumber={(v) => onChange(v)} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  back: { color: colors.brand, fontWeight: '600' },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nameInput: { flex: 1, fontSize: 18, fontWeight: '800', color: '#0f172a', padding: 4 },
  iconBtn: { padding: 6 },
  paletteRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  swatch: { width: 26, height: 26, borderRadius: 13 },
  swatchActive: { borderWidth: 3, borderColor: '#0f172a' },
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
  evalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  pesos: { fontSize: 12, color: colors.textFaint },
  reorderHint: { fontSize: 11, color: colors.textFaint, marginBottom: 4 },
  evalColsHead: { flexDirection: 'row', alignItems: 'center', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.slate100 },
  colH: { fontSize: 10, color: colors.textFaint, fontWeight: '600', textTransform: 'uppercase' },
  wSem: { width: 42, textAlign: 'center' },
  wPeso: { width: 52, textAlign: 'center' },
  wNota: { width: 56, textAlign: 'center' },
  evalRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.slate50, backgroundColor: colors.card },
  evalRowActive: { backgroundColor: colors.slate50, borderRadius: 10 },
  dragHandle: { width: 22, alignItems: 'center', justifyContent: 'center' },
  dragHandleText: { color: colors.textFaint, fontSize: 18, fontWeight: '700' },
  evalName: { fontSize: 14, color: colors.text, padding: 2, fontWeight: '600' },
  evalType: { fontSize: 12, color: colors.textSoft, paddingHorizontal: 2, marginTop: 2 },
  cell: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingVertical: 6, marginHorizontal: 2, color: colors.text, fontSize: 13, textAlign: 'center' },
  delEval: { width: 26, alignItems: 'center' },
  addEval: { marginTop: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  addEvalText: { color: colors.brand, fontWeight: '600' },
  switchLabel: { fontSize: 13, color: colors.textSoft, marginRight: 6 },
  roundRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, backgroundColor: colors.slate50, borderRadius: 12, padding: 12 },
  toggleTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 2 },
  scaleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  scaleField: { flexGrow: 1, minWidth: 70 },
  scaleLabel: { fontSize: 11, color: colors.textSoft, marginBottom: 4 },
  scaleInput: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 8, textAlign: 'center', color: colors.text },
})
