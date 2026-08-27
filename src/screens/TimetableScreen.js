import React, { useEffect, useMemo, useState } from 'react'
import { ScrollView, View, Text, Pressable, Switch, useWindowDimensions, StyleSheet } from 'react-native'
import { useStore } from '../lib/store.js'
import {
  WEEK_ORDER, dayName, MODE_LABEL, isVirtual,
  allSessions, sessionsByDay, layoutDay, dayBounds, fmtTime, nextClass,
} from '../lib/classes.js'
import { Card, Icon } from '../components/ui.js'
import { colors } from '../theme.js'

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
  const { state } = useStore()
  const { width, height } = useWindowDimensions()
  const apaisado = width > height
  const [onlyActive, setOnlyActive] = useState(true)
  const [pickedDay, setPickedDay] = useState(null)
  // El reloj se refresca cada minuto: así la línea de "ahora" y la cuenta
  // regresiva de la próxima clase no se quedan congeladas.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(id)
  }, [])
  const hoy = now.getDay()

  const opts = { onlyActive, date: now }
  const sessions = useMemo(() => allSessions(state.courses, opts), [state.courses, onlyActive, now])
  const byDay = useMemo(() => sessionsByDay(state.courses, opts), [state.courses, onlyActive, now])
  const next = useMemo(() => nextClass(state.courses, now), [state.courses, now])

  const conClase = WEEK_ORDER.filter((d) => (byDay[d] || []).length > 0)
  const days = conClase.length ? conClase : [1, 2, 3, 4, 5]
  // Por defecto abre en hoy; si hoy no hay clase, en el primer día que sí.
  const day = pickedDay != null && days.includes(pickedDay)
    ? pickedDay
    : (days.includes(hoy) ? hoy : days[0])

  const vacío = sessions.length === 0

  const cabecera = (
    <View style={styles.head}>
      <View style={{ flex: 1 }}>
        <Text style={styles.h2}>Horario</Text>
        <Text style={styles.sub}>Tus clases de la semana.</Text>
      </View>
      <Text style={styles.switchLabel}>Vigentes</Text>
      <Switch value={onlyActive} onValueChange={setOnlyActive} trackColor={{ true: colors.brand }} />
    </View>
  )

  const próxima = next ? (
    <Card style={styles.nextCard}>
      <Text style={styles.kicker}>{next.ongoing ? 'EN CLASE' : 'PRÓXIMA CLASE'}</Text>
      <Pressable style={styles.nextRow} onPress={() => onOpen(next.courseId)}>
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
        <Card><Text style={styles.empty}>Todavía no hay clases. Abre un curso y agrégalas en la tarjeta “Clases”.</Text></Card>
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
                          onPress={() => onOpen(s.courseId)}
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
          <Pressable key={s.id} style={styles.item} onPress={() => onOpen(s.courseId)}>
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

      <View style={styles.footHint}>
        <Icon name="rotate-cw" size={13} color={colors.textFaint} />
        <Text style={styles.footHintText}>Gira el teléfono para ver la semana completa.</Text>
      </View>
    </ScrollView>
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
