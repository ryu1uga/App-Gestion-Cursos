// Hoja única para agregar o editar cualquier cosa del horario (móvil).
//
// Es la gemela de Notaflow-Desktop/renderer/src/components/ScheduleSheet.jsx:
// mismo borrador, mismas reglas, misma lógica de guardado. Lo unico distinto
// son los controles, que aquí son de React Native.
//
// Antes había dos hojas casi iguales, la de clases dentro del curso y la de
// actividades dentro de Horario, con campos y textos que se habían ido
// separando. Esta reemplaza a las dos.
import React, { useMemo, useRef, useState } from 'react'
import {
  View, Text, Pressable, TextInput, Modal, ScrollView, Alert, Keyboard,
  KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import { useStore } from '../lib/store.js'
import {
  WEEK_ORDER, dayName, MODES, MODE_LABEL, SESSION_TYPES, ACTIVITY_TYPES,
  MAX_LABEL, MAX_ROOM, MAX_BLOCK_NAME, DEFAULT_BLOCK, DEFAULT_SESSION, minutesOf, fmtTime,
  fmtDuration, suggestSlot, findConflicts, expandDays, draftError, nextBlockColor,
} from '../lib/classes.js'
import { Icon } from './ui.js'
import { palette } from '../theme.js'
import { useStyles } from '../lib/useTheme.js'

const two = (n) => String(n).padStart(2, '0')
const timeToDate = (hhmm) => {
  const mins = minutesOf(hhmm)
  const d = new Date()
  d.setHours(mins == null ? 8 : Math.floor(mins / 60), mins == null ? 0 : mins % 60, 0, 0)
  return d
}
const dateToTime = (d) => `${two(d.getHours())}:${two(d.getMinutes())}`
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const fmtFecha = (iso) => {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : `${d.getDate()} ${MESES[d.getMonth()]}`
}

export default function ScheduleSheet({
  onClose,
  edit = null,             // { kind:'clase', courseId, session } | { kind:'actividad', block }
  lockCourseId = null,     // abierta desde un curso: no se puede cambiar de curso
  defaultKind = null,
  onOpenCourse = null,
}) {
  const { tema, styles } = useStyles(makeStyles)
  const { state, dispatch } = useStore()
  const courses = state.courses ?? []
  const blocks = state.blocks ?? []

  const armar = () => {
    if (edit?.kind === 'clase') {
      const s = edit.session
      return {
        kind: 'clase', courseId: edit.courseId, days: [s.day],
        start: s.start || '', end: s.end || '', mode: s.mode || 'presencial',
        label: s.label || '', room: s.room || '',
        name: '', color: DEFAULT_BLOCK.color, startDate: null, endDate: null,
      }
    }
    if (edit?.kind === 'actividad') {
      const b = edit.block
      return {
        kind: 'actividad', courseId: null, days: [b.day],
        start: b.start || '', end: b.end || '', mode: b.mode || 'presencial',
        label: b.label || '', room: b.room || '',
        name: b.name || '', color: b.color || DEFAULT_BLOCK.color,
        startDate: b.startDate ?? null, endDate: b.endDate ?? null,
      }
    }
    // Sin ningún día marcado: que el primer toque sea tuyo y no una corrección.
    // Las horas arrancan en las de por defecto y se vuelven a proponer, ya
    // buscando un hueco libre, en cuanto eliges el día.
    return {
      kind: defaultKind || (lockCourseId || courses.length ? 'clase' : 'actividad'),
      courseId: lockCourseId ?? courses[0]?.id ?? null,
      days: [],
      start: DEFAULT_SESSION.start, end: DEFAULT_SESSION.end,
      mode: 'presencial', label: '', room: '',
      name: '', color: nextBlockColor(blocks, palette),
      startDate: null, endDate: null,
    }
  }

  const [draft, setDraft] = useState(armar)
  const [tocoHoras, setTocoHoras] = useState(!!edit)
  const [picking, setPicking] = useState(null)   // 'start' | 'end' | 'desde' | 'hasta'
  const inicial = useRef(null)
  if (inicial.current === null) inicial.current = JSON.stringify(draft)

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }))

  // Cambiar de día vuelve a proponer un hueco libre, pero solo mientras el
  // usuario no haya tocado las horas: si ya las puso, mandan las suyas.
  const marcarDia = (d) => {
    setDraft((prev) => {
      const ya = prev.days.includes(d)
      const days = edit ? [d] : WEEK_ORDER.filter((x) => (x === d ? !ya : prev.days.includes(x)))
      const next = { ...prev, days }
      if (!tocoHoras && days.length === 1) Object.assign(next, suggestSlot(days[0], { courses, blocks }))
      return next
    })
  }

  // Mover el inicio conserva la duración.
  const setStart = (v) => {
    setTocoHoras(true)
    setDraft((d) => {
      const antes = minutesOf(d.start)
      const fin = minutesOf(d.end)
      const nuevo = minutesOf(v)
      if (nuevo == null || antes == null || fin == null || fin <= antes) return { ...d, start: v }
      return { ...d, start: v, end: fmtTime(nuevo + (fin - antes)) }
    })
  }
  const setEnd = (v) => { setTocoHoras(true); set({ end: v }) }

  const skipId = edit?.session?.id ?? edit?.block?.id ?? null
  const cruces = useMemo(
    () => findConflicts(draft, { courses, blocks, skipId }),
    [draft, courses, blocks, skipId],
  )

  const esClase = draft.kind === 'clase'
  const editando = !!edit
  const curso = courses.find((c) => c.id === draft.courseId)
  const error = draftError(draft)
  const dur = (minutesOf(draft.end) ?? 0) - (minutesOf(draft.start) ?? 0)
  const sucio = JSON.stringify(draft) !== inicial.current

  const intentarCerrar = () => {
    if (!sucio) return onClose()
    Alert.alert('Descartar cambios', 'Se pierde lo que escribiste.', [
      { text: 'Seguir editando', style: 'cancel' },
      { text: 'Descartar', style: 'destructive', onPress: onClose },
    ])
  }

  const guardar = () => {
    if (error) return
    const horas = { start: draft.start, end: draft.end, mode: draft.mode }

    if (editando && esClase) {
      const patch = { day: draft.days[0], ...horas, label: draft.label, room: draft.room }
      if (draft.courseId !== edit.courseId) {
        dispatch({ type: 'DELETE_SESSION', courseId: edit.courseId, sessionId: edit.session.id })
        dispatch({ type: 'ADD_SESSION', courseId: draft.courseId, session: patch })
      } else {
        dispatch({ type: 'UPDATE_SESSION', courseId: edit.courseId, sessionId: edit.session.id, patch })
      }
    } else if (editando) {
      dispatch({
        type: 'UPDATE_BLOCK',
        id: edit.block.id,
        patch: {
          day: draft.days[0], ...horas, name: draft.name, label: draft.label,
          color: draft.color, room: draft.room,
          startDate: draft.startDate, endDate: draft.endDate,
        },
      })
    } else if (esClase) {
      for (const session of expandDays({ ...horas, label: draft.label, room: draft.room }, draft.days)) {
        dispatch({ type: 'ADD_SESSION', courseId: draft.courseId, session })
      }
    } else {
      for (const block of expandDays({
        ...horas, name: draft.name, label: draft.label,
        color: draft.color, room: draft.room,
        startDate: draft.startDate, endDate: draft.endDate,
      }, draft.days)) {
        dispatch({ type: 'ADD_BLOCK', block })
      }
    }
    onClose()
  }

  const eliminar = () => {
    Alert.alert(
      esClase ? 'Eliminar clase' : 'Eliminar actividad',
      esClase ? '¿Quitar esta clase del horario?' : '¿Quitar esta actividad del horario?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            if (esClase) dispatch({ type: 'DELETE_SESSION', courseId: edit.courseId, sessionId: edit.session.id })
            else dispatch({ type: 'DELETE_BLOCK', id: edit.block.id })
            onClose()
          },
        },
      ],
    )
  }

  const titulo = editando ? (esClase ? 'Editar clase' : 'Editar actividad') : 'Agregar al horario'

  return (
    <Modal visible transparent animationType="slide" onRequestClose={intentarCerrar}>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={intentarCerrar} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView style={styles.sheet} contentContainerStyle={{ paddingBottom: 8 }}
            keyboardShouldPersistTaps="handled">
            <View style={styles.grab} />
            <Text style={styles.titulo}>{titulo}</Text>

            {!editando && !lockCourseId && (
              <View style={styles.seg}>
                <Pressable disabled={!courses.length}
                  style={[styles.segBtn, esClase && styles.segBtnOn, !courses.length && styles.segBtnOff]}
                  onPress={() => set({ kind: 'clase', label: '', courseId: draft.courseId ?? courses[0]?.id ?? null })}>
                  <Text style={[styles.segText, esClase && styles.segTextOn]}>Clase de un curso</Text>
                </Pressable>
                <Pressable style={[styles.segBtn, !esClase && styles.segBtnOn]}
                  onPress={() => set({ kind: 'actividad', label: '' })}>
                  <Text style={[styles.segText, !esClase && styles.segTextOn]}>Otra actividad</Text>
                </Pressable>
              </View>
            )}

            {esClase ? (
              <>
                <Text style={styles.label}>Curso</Text>
                {lockCourseId ? (
                  <View style={styles.cursoFijo}>
                    <View style={[styles.dot, { backgroundColor: curso?.color }]} />
                    <Text style={styles.cursoFijoText}>{curso?.name || 'Sin curso'}</Text>
                  </View>
                ) : (
                  <View style={styles.pillGrid}>
                    {courses.map((c) => (
                      <Pressable key={c.id} onPress={() => set({ courseId: c.id })}
                        style={[styles.pill, styles.pillCurso, draft.courseId === c.id && styles.pillOn]}>
                        <View style={[styles.dotSm, { backgroundColor: c.color }]} />
                        <Text style={[styles.pillText, draft.courseId === c.id && styles.pillTextOn]}
                          numberOfLines={1}>{c.name}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </>
            ) : (
              <>
                <Text style={styles.label}>Nombre</Text>
                <TextInput value={draft.name} onChangeText={(v) => set({ name: v })}
                  style={styles.input} placeholder="Cómo la llamas"
                  placeholderTextColor={tema.textFaint}
                  maxLength={MAX_BLOCK_NAME} returnKeyType="done" onSubmitEditing={() => Keyboard.dismiss()} />

                <Text style={styles.label}>Color</Text>
                <View style={styles.swatches}>
                  {palette.map((col) => (
                    <Pressable key={col} onPress={() => set({ color: col })}
                      style={[styles.swatch, { backgroundColor: col }, draft.color === col && styles.swatchOn]} />
                  ))}
                </View>
              </>
            )}

            <Text style={styles.label}>
              {editando ? 'Día' : 'Días'}
              {!editando ? <Text style={styles.note}>   elige uno o varios</Text> : null}
            </Text>
            <View style={styles.pillGrid}>
              {WEEK_ORDER.map((d) => (
                <Pressable key={d} onPress={() => marcarDia(d)}
                  style={[styles.pill, draft.days.includes(d) && styles.pillOn]}>
                  <Text style={[styles.pillText, draft.days.includes(d) && styles.pillTextOn]}>{dayName(d)}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.row}>
              <View style={styles.field}>
                <Text style={styles.label}>Inicio</Text>
                <Pressable style={styles.timeBtn} onPress={() => setPicking('start')}>
                  <Icon name="clock" size={15} color={tema.brand} />
                  <Text style={styles.timeText}>{draft.start || '--:--'}</Text>
                </Pressable>
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Fin</Text>
                <Pressable style={[styles.timeBtn, dur <= 0 && styles.timeBtnMal]} onPress={() => setPicking('end')}>
                  <Icon name="clock" size={15} color={dur <= 0 ? tema.red : tema.brand} />
                  <Text style={styles.timeText}>{draft.end || '--:--'}</Text>
                </Pressable>
              </View>
            </View>
            {dur > 0 && (
              <Text style={styles.noteBlock}>
                {fmtDuration(dur)}
                {draft.days.length > 1
                  ? `  ·  ${draft.days.length} días  ·  ${fmtDuration(dur * draft.days.length)} en total`
                  : ''}
              </Text>
            )}

            <Text style={styles.label}>Modalidad</Text>
            <View style={styles.pillGrid}>
              {MODES.map((m) => (
                <Pressable key={m} onPress={() => set({ mode: m })}
                  style={[styles.pill, draft.mode === m && styles.pillOn]}>
                  <Text style={[styles.pillText, draft.mode === m && styles.pillTextOn]}>{MODE_LABEL[m]}</Text>
                </Pressable>
              ))}
            </View>

            <CampoTipo
              titulo={esClase ? 'Tipo de sesión' : 'Tipo de actividad'}
              opciones={esClase ? SESSION_TYPES : ACTIVITY_TYPES}
              value={draft.label}
              onChange={(label) => set({ label })}
            />

            <Text style={styles.label}>{esClase ? 'Aula' : 'Lugar'}<Text style={styles.note}>   opcional</Text></Text>
            <TextInput value={draft.room} onChangeText={(v) => set({ room: v })}
              style={styles.input} maxLength={MAX_ROOM}
              placeholder={draft.mode === 'virtual' ? 'Sala o plataforma' : 'Dónde es'}
              placeholderTextColor={tema.textFaint} returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()} />

            {esClase ? (
              <Text style={styles.noteBlock}>
                Las fechas salen del curso: si {curso?.name || 'el curso'} tiene inicio y fin, la clase los sigue.
              </Text>
            ) : (
              <>
                <Text style={styles.label}>Vigencia<Text style={styles.note}>   opcional</Text></Text>
                <Text style={styles.hint}>
                  Sin fechas sale siempre. Con fechas entra y sale del horario sola, como un curso.
                </Text>
                <View style={styles.row}>
                  {[['desde', 'startDate', 'Desde'], ['hasta', 'endDate', 'Hasta']].map(([k, campo, rot]) => (
                    <View key={k} style={styles.field}>
                      <Pressable style={styles.timeBtn} onPress={() => setPicking(k)}>
                        <Icon name="calendar" size={15} color={draft[campo] ? tema.brand : tema.textFaint} />
                        <Text style={[styles.timeText, !draft[campo] && styles.timeTextVacio]}>
                          {fmtFecha(draft[campo]) || rot}
                        </Text>
                        {draft[campo] ? (
                          <Pressable hitSlop={8} onPress={() => set({ [campo]: null })}>
                            <Icon name="x" size={14} color={tema.textFaint} />
                          </Pressable>
                        ) : null}
                      </Pressable>
                    </View>
                  ))}
                </View>
              </>
            )}

            {cruces.length > 0 && (
              <View style={styles.warn}>
                <Icon name="alert-triangle" size={15} color={tema.amber} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.warnTitle}>
                    Se cruza con {cruces.length === 1 ? 'algo' : `${cruces.length} cosas`} de tu semana.
                  </Text>
                  {cruces.slice(0, 3).map((s) => (
                    <Text key={s.id} style={styles.warnItem} numberOfLines={1}>
                      {dayName(s.day)} {s.start}–{s.end} · {s.courseName}
                    </Text>
                  ))}
                  {cruces.length > 3 && <Text style={styles.warnItem}>y {cruces.length - 3} más</Text>}
                  <Text style={styles.warnNote}>Puedes guardarlo igual: en la rejilla salen lado a lado.</Text>
                </View>
              </View>
            )}

            {/* Recién abierta no hay nada que corregir: el mismo texto sirve de
                guía en gris, y solo se pone en ámbar cuando ya tocaste algo. */}
            {error ? <Text style={[styles.error, !sucio && styles.errorSuave]}>{error}</Text> : null}

            <View style={styles.btns}>
              {editando && (
                <Pressable style={styles.del} onPress={eliminar}>
                  <Icon name="trash-2" size={15} color={tema.red} />
                </Pressable>
              )}
              {editando && esClase && onOpenCourse && (
                <Pressable style={styles.sec} onPress={() => { onClose(); onOpenCourse(draft.courseId) }}>
                  <Text style={styles.secText}>Ver curso</Text>
                </Pressable>
              )}
              <Pressable style={[styles.ok, error && styles.okOff]} onPress={guardar} disabled={!!error}>
                <Text style={styles.okText}>
                  {editando ? 'Guardar' : (draft.days.length > 1 ? `Agregar ${draft.days.length}` : 'Agregar')}
                </Text>
              </Pressable>
            </View>

            {picking && (
              <DateTimePicker
                mode={picking === 'start' || picking === 'end' ? 'time' : 'date'}
                is24Hour
                value={
                  picking === 'start' ? timeToDate(draft.start)
                    : picking === 'end' ? timeToDate(draft.end)
                      : new Date(draft[picking === 'desde' ? 'startDate' : 'endDate'] || Date.now())
                }
                onChange={(event, sel) => {
                  const cual = picking
                  setPicking(null)
                  if (event.type !== 'set' || !sel) return
                  if (cual === 'start') setStart(dateToTime(sel))
                  else if (cual === 'end') setEnd(dateToTime(sel))
                  else set({ [cual === 'desde' ? 'startDate' : 'endDate']: sel.toISOString() })
                }}
              />
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}

// ------------------------------------------------------------
//  Campo de tipo: pastillas + “Otro…”
// ------------------------------------------------------------
//  El tipo es texto libre, así que las pastillas solo ahorran teclear. Un tipo
//  escrito a mano se suma a la lista como una pastilla más, encendida: si no,
//  al abrir una actividad de tipo “Práctica” (que vive en la lista de clases,
//  no en la de actividades) parecía que no tenía tipo. “Otro…” solo lleva el
//  cursor al campo de texto.
function CampoTipo({ titulo, opciones, value, onChange }) {
  const { tema, styles } = useStyles(makeStyles)
  const input = useRef(null)
  const propio = !!value && !opciones.includes(value)
  const lista = propio ? [...opciones, value] : opciones

  return (
    <>
      <Text style={styles.label}>{titulo}<Text style={styles.note}>   opcional</Text></Text>
      <View style={styles.pillGrid}>
        {lista.map((t) => (
          <Pressable key={t} onPress={() => onChange(value === t ? '' : t)}
            style={[styles.pill, value === t && styles.pillOn]}>
            <Text style={[styles.pillText, value === t && styles.pillTextOn]}>{t}</Text>
          </Pressable>
        ))}
        <Pressable onPress={() => input.current?.focus()} style={[styles.pill, styles.pillOtro]}>
          <Text style={styles.pillText}>Otro…</Text>
        </Pressable>
      </View>
      <TextInput ref={input} value={value} onChangeText={onChange}
        style={styles.input} placeholder="Escribe otro tipo" placeholderTextColor={tema.textFaint}
        maxLength={MAX_LABEL} returnKeyType="done" onSubmitEditing={() => Keyboard.dismiss()} />
    </>
  )
}

const makeStyles = (tema) => StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(51,45,42,0.42)' },
  sheet: {
    backgroundColor: tema.card, borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20, maxHeight: '90%',
  },
  grab: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: tema.slate100, marginBottom: 12 },
  titulo: { fontSize: 16, fontWeight: '800', color: tema.text, marginBottom: 10 },

  seg: { flexDirection: 'row', backgroundColor: tema.slate100, borderRadius: 12, padding: 3, gap: 3 },
  segBtn: { flex: 1, borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  segBtnOn: { backgroundColor: tema.card },
  segBtnOff: { opacity: 0.45 },
  segText: { fontSize: 12.5, fontWeight: '700', color: tema.textFaint },
  segTextOn: { color: tema.brand },

  label: {
    fontSize: 10, fontWeight: '700', color: tema.textFaint,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 14,
  },
  note: { fontSize: 10, fontWeight: '400', color: tema.textFaint, textTransform: 'none', letterSpacing: 0 },
  noteBlock: { fontSize: 11.5, color: tema.textSoft, lineHeight: 16, marginTop: 8 },
  hint: { fontSize: 11.5, color: tema.textSoft, lineHeight: 16, marginBottom: 6, marginTop: -2 },

  input: {
    borderWidth: 1, borderColor: tema.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: tema.text, backgroundColor: tema.card, marginTop: 4,
  },
  pillGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 8 },
  pill: {
    paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999,
    backgroundColor: tema.slate50, borderWidth: 1, borderColor: tema.border,
  },
  pillCurso: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%' },
  pillOn: { backgroundColor: tema.brandLight, borderColor: tema.brand },
  // "Otro…" no es un tipo más: abre el campo de texto de abajo.
  pillOtro: { borderStyle: 'dashed' },
  pillText: { fontSize: 12.5, color: tema.textSoft, fontWeight: '600', flexShrink: 1 },
  pillTextOn: { color: tema.brandDark, fontWeight: '800' },

  dot: { width: 11, height: 11, borderRadius: 6 },
  dotSm: { width: 9, height: 9, borderRadius: 5 },
  cursoFijo: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  cursoFijoText: { fontSize: 14.5, fontWeight: '700', color: tema.text, flexShrink: 1 },

  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  swatch: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: 'transparent' },
  swatchOn: { borderColor: tema.text },

  row: { flexDirection: 'row', gap: 10 },
  field: { flex: 1 },
  timeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: tema.border, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 11,
  },
  timeBtnMal: { borderColor: tema.red },
  timeText: { fontSize: 14, color: tema.brand, fontWeight: '700', flex: 1 },
  timeTextVacio: { color: tema.textFaint, fontWeight: '500' },

  warn: {
    flexDirection: 'row', gap: 9, marginTop: 16, padding: 11,
    borderRadius: 12, backgroundColor: tema.amberBg,
  },
  warnTitle: { fontSize: 12.5, fontWeight: '700', color: tema.text },
  warnItem: { fontSize: 11.5, color: tema.textSoft, marginTop: 2 },
  warnNote: { fontSize: 11, color: tema.textFaint, marginTop: 5 },
  error: { fontSize: 12.5, fontWeight: '700', color: tema.amber, marginTop: 14 },
  errorSuave: { color: tema.textSoft, fontWeight: '600' },

  btns: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20 },
  del: {
    paddingVertical: 11, paddingHorizontal: 14,
    borderRadius: 12, borderWidth: 1, borderColor: tema.border,
  },
  sec: {
    paddingVertical: 11, paddingHorizontal: 14,
    borderRadius: 12, borderWidth: 1, borderColor: tema.border,
  },
  secText: { color: tema.text, fontWeight: '700', fontSize: 13.5 },
  ok: { flex: 1, backgroundColor: tema.brand, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  okOff: { opacity: 0.45 },
  okText: { color: '#fff', fontWeight: '800', fontSize: 14.5 },
})
