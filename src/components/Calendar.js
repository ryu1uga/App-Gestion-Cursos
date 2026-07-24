import React, { useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Icon, Badge } from './ui.js'
import { colors } from '../theme.js'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const sameDay = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
const keyOf = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

// items: [{ date: Date, courseName, courseColor, courseId, type, name, grade }]
export default function Calendar({ items = [], onOpen }) {
  const today = new Date()
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selected, setSelected] = useState(null)

  const year = cursor.getFullYear()
  const month = cursor.getMonth()

  // Mapa día -> evaluaciones de ese día
  const byDay = {}
  items.forEach((it) => {
    if (!it.date) return
    ;(byDay[keyOf(it.date)] = byDay[keyOf(it.date)] || []).push(it)
  })

  // Construcción de la grilla (semana empieza en lunes)
  const firstOfMonth = new Date(year, month, 1)
  const leading = (firstOfMonth.getDay() + 6) % 7 // lun=0 … dom=6
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < leading; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)

  const goMonth = (delta) => { setSelected(null); setCursor(new Date(year, month + delta, 1)) }
  const selItems = selected ? (byDay[keyOf(selected)] || []) : []

  return (
    <View>
      <View style={styles.header}>
        <Pressable onPress={() => goMonth(-1)} hitSlop={10} style={styles.navBtn}><Icon name="chevron-left" size={20} color={colors.text} /></Pressable>
        <Text style={styles.monthTitle}>{MESES[month]} {year}</Text>
        <Pressable onPress={() => goMonth(1)} hitSlop={10} style={styles.navBtn}><Icon name="chevron-right" size={20} color={colors.text} /></Pressable>
      </View>

      <View style={styles.weekRow}>
        {DIAS.map((d) => <Text key={d} style={styles.weekday}>{d}</Text>)}
      </View>

      <View style={styles.grid}>
        {cells.map((d, i) => {
          if (!d) return <View key={i} style={styles.cell} />
          const evs = byDay[keyOf(d)] || []
          const isToday = sameDay(d, today)
          const isSel = sameDay(d, selected)
          return (
            <Pressable key={i} style={styles.cell} onPress={() => setSelected(isSel ? null : d)}>
              <View style={[styles.dayCircle, isToday && styles.dayToday, isSel && styles.daySel]}>
                <Text style={[styles.dayNum, isToday && styles.dayTodayText, isSel && styles.daySelText]}>{d.getDate()}</Text>
              </View>
              <View style={styles.dotsRow}>
                {evs.slice(0, 3).map((e, j) => (
                  <View key={j} style={[styles.evDot, { backgroundColor: e.courseColor }]} />
                ))}
              </View>
            </Pressable>
          )
        })}
      </View>

      {selected && (
        <View style={styles.dayPanel}>
          <Text style={styles.dayPanelTitle}>{selected.getDate()} de {MESES[month]}</Text>
          {selItems.length === 0 ? (
            <Text style={styles.dayEmpty}>Sin evaluaciones este día.</Text>
          ) : selItems.map((e, i) => (
            <Pressable key={i} style={styles.item} onPress={() => onOpen && onOpen(e.courseId)}>
              <View style={[styles.itemDot, { backgroundColor: e.courseColor }]} />
              <Text style={styles.itemCourse}>{e.courseName}</Text>
              <Text style={styles.itemEval} numberOfLines={1}> · {e.type}: {e.name}</Text>
              <View style={{ flex: 1 }} />
              {e.grade == null ? <Badge color="amber">pend.</Badge> : <Badge color="slate">{String(e.grade)}</Badge>}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  navBtn: { padding: 4 },
  monthTitle: { fontSize: 16, fontWeight: '800', color: colors.text, textTransform: 'capitalize' },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekday: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: colors.textFaint },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 2 },
  dayCircle: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  dayToday: { backgroundColor: colors.brandLight },
  daySel: { backgroundColor: colors.brand },
  dayNum: { fontSize: 13, color: colors.text, fontWeight: '600' },
  dayTodayText: { color: colors.brand, fontWeight: '800' },
  daySelText: { color: '#fff', fontWeight: '800' },
  dotsRow: { flexDirection: 'row', gap: 2, height: 6, marginTop: 2 },
  evDot: { width: 5, height: 5, borderRadius: 3 },
  dayPanel: { marginTop: 12, borderTopWidth: 1, borderTopColor: colors.slate100, paddingTop: 10 },
  dayPanelTitle: { fontSize: 13, fontWeight: '700', color: colors.textSoft, marginBottom: 6, textTransform: 'capitalize' },
  dayEmpty: { fontSize: 13, color: colors.textFaint, paddingVertical: 8 },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.slate50 },
  itemDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  itemCourse: { fontWeight: '600', color: colors.text, fontSize: 13 },
  itemEval: { color: colors.textSoft, fontSize: 13, flexShrink: 1 },
})
