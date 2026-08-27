import React, { useEffect, useMemo, useState } from 'react'
import {
  ScrollView, View, Text, Pressable, Switch, TextInput, Modal, Alert, Keyboard,
  KeyboardAvoidingView, Platform, useWindowDimensions, StyleSheet,
} from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import { useStore } from '../lib/store.js'
import {
  WEEK_ORDER, dayName, MODES, MODE_LABEL, isVirtual, minutesOf,
  allSessions, sessionsByDay, layoutDay, dayBounds, fmtTime, nextClass,
  BLOCK_SUGGESTIONS, MAX_BLOCK_NAME, MAX_ROOM,
} from '../lib/classes.js'
import { Card, Icon } from '../components/ui.js'
import { colors, palette } from '../theme.js'

// Alto de un minuto en la rejilla apaisada.
const PX_PER_MIN = 0.8
const GUTTER = 42

// Color del curso con transparencia, para el relleno del bloque.
const tint = (hex, alpha) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '')
  if (!m) return `rgba(109, 74, 156, ${alpha})`
  const n = parseInt(m[1], 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

// "en 25 min" · "hoy a las 14:00" · "mañana a las 08:00" · "jueves a las 10:00"
function whenText(next, now) {
  if (next.ongoing) return 'ahora mismo'
  if (next.minutesAway < 60) return `en ${Math.max(1, next.minutesAway)} min`
  const hoy = new Date(now); hoy.setHours(0, 0, 0, 0)
  const dia = new Date(next.date); dia.setHours(0, 0, 0, 0)
  const dias = Math.round((dia - hoy) / 86400000)
  const hora = `a las ${next.start}`
  if (dias === 0) return `hoy ${hora}`
  if (dias === 1) return `mañana ${hora}`
  return `${dayName(next.day, true).toLowerCase()} ${hora}`
}

export default function TimetableScreen({ onOpen }) {
  const { state, dispatch } = useStore()
  const { width, height } = useWindowDimensions()
  const apaisado = width > height
  const [onlyActive, setOnlyActive] = useState(true)
  const [pickedDay, setPickedDay] = useState(null)
  const [editingBlock, setEditingBlock] = useState(null)
  // El reloj se refresca cada minuto: así la línea de "ahora" y la cuenta
  // regresiva de la próxima clase no se quedan congeladas.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(id)
  }, [])
  const hoy = now.getDay()

  const blocks = state.blocks ?? []
  const opts = { onlyActive, date: now, blocks }
  const sessions = useMemo(() => allSessions(state.courses, opts), [state.courses, blocks, onlyActive, now])
  const byDay = useMemo(() => sessionsByDay(state.courses, opts), [state.courses, blocks, onlyActive, now])
  const next = useMemo(() => nextClass(state.courses, now, blocks), [state.courses, blocks, now])

  const patchBlock = (id, patch) => dispatch({ type: 'UPDATE_BLOCK', id, patch })
  const bloqueEnEdicion = editingBlock != null ? blocks.find((b) => b.id === editingBlock) : null

  // Un bloque libre no tiene curso que abrir: se edita en su propia hoja.
  const abrir = (s) => (s.blockId ? setEditingBlock(s.blockId) : onOpen(s.courseId))

  const conClase = WEEK_ORDER.filter((d) => (byDay[d] || []).length > 0)
  const days = conClase.length ? conClase : [1, 2, 3, 4, 5]
  // Por defecto abre en hoy; si hoy no hay clase, en el primer día que sí.
  const day = pickedDay != null && days.includes(pickedDay)
    ? pickedDay
    : (days.includes(hoy) ? hoy : days[0])

  const vacío = sessions.length === 0

  // La tarjeta y la hoja se usan en las tres vistas (vacía, apaisada y vertical),
  // así que se arman una vez aquí.
  const tarjetaBloques = (
        <Card style={{ marginBottom: 12 }}>
          <View style={styles.blocksHead}>
            <Text style={styles.dayTitle}>Otros bloques</Text>
            {blocks.length > 0 && <Text style={styles.blocksCount}>{blocks.length}</Text>}
          </View>
          <Text style={styles.blocksHint}>
            Lo que te ocupa la semana sin ser un curso: trabajo, prácticas, gimnasio.
            Sale en el horario junto a las clases y no cuenta para ninguna nota.
          </Text>

          {blocks.map((b) => (
            <Pressable key={b.id} style={styles.item} onPress={() => setEditingBlock(b.id)}>
              <View style={styles.itemTime}>
                <Text style={styles.itemStart}>{b.start || '--:--'}</Text>
                <Text style={styles.itemEnd}>{b.end || '--:--'}</Text>
              </View>
              <View style={[
                styles.itemBar,
                { backgroundColor: b.color || colors.brand },
                b.mode === 'virtual' && styles.itemBarVirtual,
              ]} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.itemName} numberOfLines={1}>{b.name || 'Sin nombre'}</Text>
                <Text style={styles.itemMeta} numberOfLines={1}>
                  {[dayName(b.day, true), b.room].filter(Boolean).join('  ·  ')}
                </Text>
              </View>
              <View style={styles.tag}><Text style={styles.tagText}>{MODE_LABEL[b.mode] || MODE_LABEL.presencial}</Text></View>
            </Pressable>
          ))}

          <Pressable style={styles.addBlock} onPress={() => dispatch({ type: 'ADD_BLOCK' })}>
            <Text style={styles.addBlockText}>+ Agregar bloque</Text>
          </Pressable>
        </Card>
  )

  const hojaBloque = bloqueEnEdicion ? (
    <BlockSheet
      b={bloqueEnEdicion}
      onPatch={(patch) => patchBlock(bloqueEnEdicion.id, patch)}
      onClose={() => setEditingBlock(null)}
      onDelete={() => {
        const id = bloqueEnEdicion.id
        Alert.alert('Eliminar bloque', '¿Quitarlo del horario?', [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Eliminar', style: 'destructive', onPress: () => { setEditingBlock(null); dispatch({ type: 'DELETE_BLOCK', id }) } },
        ])
      }}
    />
  ) : null


  const cabecera = (
    <View style={styles.head}>
      <View style={{ flex: 1 }}>
        <Text style={styles.h2}>Horario</Text>
        <Text style={styles.sub}>Tus clases de la semana.</Text>
      </View>
      <Text style={styles.switchLabel}>Vigente</Text>
      <Switch value={onlyActive} onValueChange={setOnlyActive} trackColor={{ true: colors.brand }} />
    </View>
  )

  const próxima = next ? (
    <Card style={styles.nextCard}>
      <Text style={styles.kicker}>
        {next.ongoing
          ? (next.blockId ? 'AHORA MISMO' : 'EN CLASE')
          : (next.blockId ? 'LO SIGUIENTE' : 'PRÓXIMA CLASE')}
      </Text>
      <Pressable style={styles.nextRow} onPress={() => abrir(next)}>
        <View style={[styles.dot, { backgroundColor: next.courseColor }]} />
        <Text style={styles.nextName} numberOfLines={1}>{next.courseName}</Text>
        <View style={styles.tag}><Text style={styles.tagText}>{MODE_LABEL[next.mode] || MODE_LABEL.presencial}</Text></View>
      </Pressable>
      <Text style={styles.nextMeta}>
        {[next.label, `${dayName(next.day, true)} ${next.start}–${next.end}`, next.room].filter(Boolean).join('  ·  ')}
      </Text>
      <Text style={styles.nextWhen}>{whenText(next, now)}</Text>
    </Card>
  ) : null

  // ------------------------------------------------------------
  //  Vacío
  // ------------------------------------------------------------
  if (vacío) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        {cabecera}
        <Card style={{ marginBottom: 12 }}>
          <Text style={styles.empty}>
            Todavía no hay nada esta semana. Abre un curso y agrega sus clases en la tarjeta “Clases”,
            o crea aquí abajo un bloque que no sea de un curso.
          </Text>
        </Card>
        {tarjetaBloques}
        {hojaBloque}
      </ScrollView>
    )
  }

  // ------------------------------------------------------------
  //  Apaisado: la semana completa en rejilla
  // ------------------------------------------------------------
  if (apaisado) {
    const { from, to } = dayBounds(sessions)
    const alto = (to - from) * PX_PER_MIN
    const horas = []
    for (let m = from; m <= to; m += 60) horas.push(m)
    const anchoCol = Math.max(104, (width - GUTTER - 34) / days.length)
    const nowMin = now.getHours() * 60 + now.getMinutes()

    return (
      <View style={styles.gridWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <View style={styles.gridHead}>
              <View style={{ width: GUTTER }} />
              {days.map((d) => (
                <Text key={d} style={[styles.dayHead, { width: anchoCol }, d === hoy && styles.dayHeadToday]}>
                  {dayName(d, true)}
                </Text>
              ))}
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={[styles.gridBody, { height: alto + 16 }]}>
                <View style={{ width: GUTTER }}>
                  {horas.map((m) => (
                    <Text key={m} style={[styles.hourLabel, { top: (m - from) * PX_PER_MIN + 8 }]}>{fmtTime(m)}</Text>
                  ))}
                </View>

                {days.map((d) => (
                  <View key={d} style={[styles.col, { width: anchoCol }, d === hoy && styles.colToday]}>
                    {horas.map((m) => (
                      <View key={m} style={[styles.line, { top: (m - from) * PX_PER_MIN + 8 }]} />
                    ))}

                    {d === hoy && nowMin >= from && nowMin <= to && (
                      <View style={[styles.nowLine, { top: (nowMin - from) * PX_PER_MIN + 8 }]} />
                    )}

                    {layoutDay(byDay[d] || []).map((s) => {
                      const h = Math.max(24, (s.endMin - s.startMin) * PX_PER_MIN - 3)
                      // Bloque corto: nombre y hora en una sola fila, si no se cortan.
                      const compacto = h < 46
                      const w = (anchoCol - 6) / (s.lanes || 1)
                      return (
                        <Pressable
                          key={s.id}
                          onPress={() => abrir(s)}
                          style={[
                            styles.block,
                            compacto && styles.blockCompact,
                            isVirtual(s) && styles.blockVirtual,
                            {
                              top: (s.startMin - from) * PX_PER_MIN + 8,
                              height: h,
                              left: 3 + (s.lane || 0) * w,
                              width: w - 2,
                              backgroundColor: tint(s.courseColor, 0.13),
                              borderColor: s.courseColor,
                            },
                          ]}
                        >
                          <Text style={[styles.blockName, compacto && styles.blockNameCompact, { color: s.courseColor }]} numberOfLines={1}>{s.courseName}</Text>
                          <Text style={[styles.blockTime, compacto && styles.blockTimeCompact]} numberOfLines={1}>{s.start}–{s.end}</Text>
                          {h >= 52 && (
                            <Text style={styles.blockMeta} numberOfLines={1}>
                              {[s.label, s.room, isVirtual(s) ? 'Virtual' : null].filter(Boolean).join(' · ')}
                            </Text>
                          )}
                        </Pressable>
                      )
                    })}
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </ScrollView>
        {hojaBloque}
      </View>
    )
  }

  // ------------------------------------------------------------
  //  Vertical: un día a la vez
  // ------------------------------------------------------------
  const delDía = (byDay[day] || [])

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {cabecera}
      {próxima}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsWrap} contentContainerStyle={styles.chips}>
        {days.map((d) => {
          const on = d === day
          return (
            <Pressable key={d} onPress={() => setPickedDay(d)} style={[styles.chip, on && styles.chipOn]}>
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{dayName(d)}</Text>
              <View style={[styles.chipCount, on && styles.chipCountOn]}>
                <Text style={[styles.chipCountText, on && styles.chipCountTextOn]}>{(byDay[d] || []).length}</Text>
              </View>
            </Pressable>
          )
        })}
      </ScrollView>

      <Card style={{ marginBottom: 12 }}>
        <Text style={styles.dayTitle}>
          {dayName(day, true)}{day === hoy ? '  ·  hoy' : ''}
        </Text>
        {delDía.length === 0 ? (
          <Text style={styles.empty}>Sin clases este día.</Text>
        ) : delDía.map((s) => (
          <Pressable key={s.id} style={styles.item} onPress={() => abrir(s)}>
            <View style={styles.itemTime}>
              <Text style={styles.itemStart}>{s.start}</Text>
              <Text style={styles.itemEnd}>{s.end}</Text>
            </View>
            <View style={[
              styles.itemBar,
              { backgroundColor: s.courseColor },
              isVirtual(s) && styles.itemBarVirtual,
            ]} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.itemName} numberOfLines={1}>{s.courseName}</Text>
              <Text style={styles.itemMeta} numberOfLines={1}>
                {[s.label, s.room].filter(Boolean).join('  ·  ') || (isVirtual(s) ? 'Sin sala' : 'Sin aula')}
              </Text>
            </View>
            <View style={styles.tag}><Text style={styles.tagText}>{MODE_LABEL[s.mode] || MODE_LABEL.presencial}</Text></View>
          </Pressable>
        ))}
      </Card>

      {tarjetaBloques}

      <View style={styles.footHint}>
        <Icon name="rotate-cw" size={13} color={colors.textFaint} />
        <Text style={styles.footHintText}>Gira el teléfono para ver la semana completa.</Text>
      </View>

      {hojaBloque}
    </ScrollView>
  )
}

// ------------------------------------------------------------
//  Hoja de edición de un bloque libre
//  Guarda al instante en el store, como la de clases; el botón solo cierra.
// ------------------------------------------------------------
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

function BlockSheet({ b, onPatch, onClose, onDelete }) {
  const [picking, setPicking] = useState(null)   // 'start' | 'end' | 'desde' | 'hasta'

  // Igual que en las clases: el fin nunca queda antes del inicio.
  const setEnd = (v) => {
    const ini = minutesOf(b.start)
    const nuevo = minutesOf(v)
    if (nuevo != null && ini != null && nuevo <= ini) return onPatch({ end: fmtTime(ini + 30) })
    onPatch({ end: v })
  }
  const setStart = (v) => {
    const antes = minutesOf(b.start)
    const fin = minutesOf(b.end)
    const nuevo = minutesOf(v)
    if (nuevo == null || antes == null || fin == null || fin <= antes) return onPatch({ start: v })
    onPatch({ start: v, end: fmtTime(nuevo + (fin - antes)) })
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetRoot}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView style={styles.sheet} contentContainerStyle={{ paddingBottom: 8 }}
            keyboardShouldPersistTaps="handled">
            <View style={styles.grab} />

            <Text style={styles.sheetLabel}>Nombre</Text>
            <TextInput value={b.name || ''} onChangeText={(v) => onPatch({ name: v })}
              style={styles.input} placeholder="Trabajo, Prácticas…" placeholderTextColor={colors.textFaint}
              maxLength={MAX_BLOCK_NAME} returnKeyType="done" onSubmitEditing={() => Keyboard.dismiss()} />
            <View style={styles.pillGrid}>
              {BLOCK_SUGGESTIONS.map((n) => (
                <Pressable key={n} onPress={() => onPatch({ name: n })}
                  style={[styles.pill, b.name === n && styles.pillOn]}>
                  <Text style={[styles.pillText, b.name === n && styles.pillTextOn]}>{n}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.sheetLabel}>Color</Text>
            <View style={styles.swatches}>
              {palette.map((col) => (
                <Pressable key={col} onPress={() => onPatch({ color: col })}
                  style={[styles.swatch, { backgroundColor: col }, b.color === col && styles.swatchOn]} />
              ))}
            </View>

            <Text style={styles.sheetLabel}>Día</Text>
            <View style={styles.pillGrid}>
              {WEEK_ORDER.map((d) => (
                <Pressable key={d} onPress={() => onPatch({ day: d })}
                  style={[styles.pill, b.day === d && styles.pillOn]}>
                  <Text style={[styles.pillText, b.day === d && styles.pillTextOn]}>{dayName(d)}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.sheetRow}>
              <View style={styles.sheetField}>
                <Text style={styles.sheetLabel}>Inicio</Text>
                <Pressable style={styles.sheetTimeBtn} onPress={() => setPicking('start')}>
                  <Icon name="clock" size={15} color={colors.brand} />
                  <Text style={styles.sheetDateText}>{b.start || '--:--'}</Text>
                </Pressable>
              </View>
              <View style={styles.sheetField}>
                <Text style={styles.sheetLabel}>Fin</Text>
                <Pressable style={styles.sheetTimeBtn} onPress={() => setPicking('end')}>
                  <Icon name="clock" size={15} color={colors.brand} />
                  <Text style={styles.sheetDateText}>{b.end || '--:--'}</Text>
                </Pressable>
              </View>
            </View>

            <View style={{ marginTop: 16 }}>
              <Text style={styles.sheetLabel}>Modalidad</Text>
              <View style={styles.pillGrid}>
                {MODES.map((m) => (
                  <Pressable key={m} onPress={() => onPatch({ mode: m })}
                    style={[styles.pill, b.mode === m && styles.pillOn]}>
                    <Text style={[styles.pillText, b.mode === m && styles.pillTextOn]}>{MODE_LABEL[m]}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <Text style={styles.sheetLabel}>Lugar</Text>
            <TextInput value={b.room || ''} onChangeText={(v) => onPatch({ room: v })}
              style={styles.input} maxLength={MAX_ROOM}
              placeholder={b.mode === 'virtual' ? 'Sala, plataforma…' : 'Oficina, sede…'}
              placeholderTextColor={colors.textFaint} returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()} />

            <Text style={styles.sheetLabel}>Vigencia</Text>
            <Text style={styles.sheetHint}>
              Sin fechas el bloque sale siempre. Con ellas entra y sale del horario solo,
              como un curso con fechas.
            </Text>
            <View style={styles.sheetRow}>
              {[['desde', 'startDate', 'Desde'], ['hasta', 'endDate', 'Hasta']].map(([k, campo, rot]) => (
                <View key={k} style={styles.sheetField}>
                  <Pressable style={styles.sheetTimeBtn} onPress={() => setPicking(k)}>
                    <Icon name="calendar" size={15} color={b[campo] ? colors.brand : colors.textFaint} />
                    <Text style={[styles.sheetDateText, !b[campo] && styles.sheetDateEmpty]}>
                      {fmtFecha(b[campo]) || rot}
                    </Text>
                    {b[campo] ? (
                      <Pressable hitSlop={8} onPress={() => onPatch({ [campo]: null })}>
                        <Icon name="x" size={14} color={colors.textFaint} />
                      </Pressable>
                    ) : null}
                  </Pressable>
                </View>
              ))}
            </View>

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
                mode={picking === 'start' || picking === 'end' ? 'time' : 'date'}
                is24Hour
                value={
                  picking === 'start' ? timeToDate(b.start)
                    : picking === 'end' ? timeToDate(b.end)
                      : new Date(b[picking === 'desde' ? 'startDate' : 'endDate'] || Date.now())
                }
                onChange={(event, sel) => {
                  const cual = picking
                  setPicking(null)
                  if (event.type !== 'set' || !sel) return
                  if (cual === 'start') setStart(dateToTime(sel))
                  else if (cual === 'end') setEnd(dateToTime(sel))
                  else onPatch({ [cual === 'desde' ? 'startDate' : 'endDate']: sel.toISOString() })
                }}
              />
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}


const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  h2: { fontSize: 17, fontWeight: '700', color: colors.text },
  sub: { fontSize: 13, color: colors.textSoft, marginTop: 2 },
  switchLabel: { fontSize: 12, color: colors.textSoft, marginRight: 6 },
  empty: { color: colors.textSoft, textAlign: 'center', paddingVertical: 16 },

  kicker: { fontSize: 11, fontWeight: '700', color: colors.textFaint, letterSpacing: 0.5 },
  nextCard: { marginBottom: 12, borderLeftWidth: 4, borderLeftColor: colors.brand },
  nextRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  nextName: { fontSize: 15, fontWeight: '700', color: colors.text, flexShrink: 1 },
  nextMeta: { fontSize: 12, color: colors.textSoft, marginTop: 4 },
  nextWhen: { fontSize: 13, fontWeight: '700', color: colors.amber, marginTop: 4 },
  dot: { width: 11, height: 11, borderRadius: 6, marginRight: 8 },

  tag: { backgroundColor: colors.slate100, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, marginLeft: 8 },
  tagText: { fontSize: 10.5, fontWeight: '700', color: colors.textSoft },

  chipsWrap: { marginBottom: 12 },
  chips: { gap: 8, paddingRight: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.slate100, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8,
  },
  chipOn: { backgroundColor: colors.brand },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.textSoft },
  chipTextOn: { color: '#fff' },
  chipCount: { minWidth: 18, alignItems: 'center', borderRadius: 999, backgroundColor: colors.card, paddingHorizontal: 5 },
  chipCountOn: { backgroundColor: 'rgba(255,255,255,0.28)' },
  chipCountText: { fontSize: 11, fontWeight: '800', color: colors.textSoft },
  chipCountTextOn: { color: '#fff' },

  dayTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 6 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.slate50 },
  itemTime: { width: 46 },
  itemStart: { fontSize: 13.5, fontWeight: '800', color: colors.text },
  itemEnd: { fontSize: 11.5, color: colors.textFaint, marginTop: 1 },
  itemBar: { width: 4, alignSelf: 'stretch', borderRadius: 3 },
  // Virtual: la misma barra, atenuada. El borde punteado sobre 4 px de ancho
  // se veía como una escalerita de puntos en vez de una línea.
  itemBarVirtual: { opacity: 0.4 },
  itemName: { fontSize: 14.5, fontWeight: '700', color: colors.text },
  itemMeta: { fontSize: 11.5, color: colors.textSoft, marginTop: 2 },

  blocksHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  blocksCount: { fontSize: 12, fontWeight: '700', color: colors.textFaint },
  blocksHint: { fontSize: 11.5, color: colors.textSoft, lineHeight: 16, marginTop: 2, marginBottom: 4 },
  addBlock: {
    borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', borderRadius: 12,
    paddingVertical: 10, alignItems: 'center', marginTop: 10,
  },
  addBlockText: { color: colors.brand, fontWeight: '700', fontSize: 13 },

  // Hoja de edición del bloque
  sheetRoot: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(51,45,42,0.42)' },
  sheet: {
    backgroundColor: colors.card, borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20, maxHeight: '88%',
  },
  grab: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: colors.slate100, marginBottom: 14 },
  sheetLabel: {
    fontSize: 10, fontWeight: '700', color: colors.textFaint,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 4,
  },
  sheetHint: { fontSize: 11.5, color: colors.textSoft, lineHeight: 16, marginBottom: 8, marginTop: -2 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: colors.text, backgroundColor: colors.card, marginBottom: 10,
  },
  pillGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 12 },
  pill: {
    paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999,
    backgroundColor: colors.slate50, borderWidth: 1, borderColor: colors.border,
  },
  pillOn: { backgroundColor: colors.brandLight, borderColor: colors.brand },
  pillText: { fontSize: 12.5, color: colors.textSoft, fontWeight: '600' },
  pillTextOn: { color: colors.brandDark, fontWeight: '800' },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  swatch: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: 'transparent' },
  swatchOn: { borderColor: colors.text },
  sheetRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  sheetField: { flex: 1 },
  sheetTimeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 11,
  },
  sheetDateText: { fontSize: 14, color: colors.brand, fontWeight: '700', flex: 1 },
  sheetDateEmpty: { color: colors.textFaint, fontWeight: '500' },
  sheetBtns: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20 },
  sheetDel: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 11, paddingHorizontal: 14,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border,
  },
  sheetDelText: { color: colors.red, fontWeight: '700', fontSize: 13.5 },
  sheetOk: { flex: 1, backgroundColor: colors.brand, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  sheetOkText: { color: '#fff', fontWeight: '800', fontSize: 14.5 },

  footHint: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' },
  footHintText: { fontSize: 12, color: colors.textFaint },

  gridWrap: { flex: 1, paddingHorizontal: 12, paddingTop: 8 },
  gridHead: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 6 },
  dayHead: { fontSize: 12, fontWeight: '700', color: colors.textSoft, textAlign: 'center' },
  dayHeadToday: { color: colors.brand },
  gridBody: { flexDirection: 'row' },
  hourLabel: { position: 'absolute', right: 6, fontSize: 10, color: colors.textFaint, transform: [{ translateY: -6 }] },
  col: { position: 'relative', borderLeftWidth: 1, borderLeftColor: colors.slate100 },
  colToday: { backgroundColor: colors.slate50 },
  line: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: colors.slate100 },
  nowLine: { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: colors.red, zIndex: 3 },
  block: {
    position: 'absolute', overflow: 'hidden',
    borderWidth: 1, borderLeftWidth: 3, borderRadius: 9, paddingHorizontal: 6, paddingVertical: 4,
  },
  blockVirtual: { borderStyle: 'dashed' },
  blockCompact: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
  blockNameCompact: { flexShrink: 1 },
  blockTimeCompact: { marginTop: 0, flexShrink: 0 },
  blockName: { fontSize: 11.5, fontWeight: '700' },
  blockTime: { fontSize: 10, color: colors.textSoft, marginTop: 1 },
  blockMeta: { fontSize: 9.5, color: colors.textFaint, marginTop: 1 },
})
