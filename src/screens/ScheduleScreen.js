import React from 'react'
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native'
import { useStore } from '../lib/store.js'
import { Card, Badge } from '../components/ui.js'
import { colors } from '../theme.js'

export default function ScheduleScreen({ onOpen }) {
  const { state } = useStore()
  const weeks = state.settings.semesterWeeks || 16

  const byWeek = {}
  const sinAsignar = []
  state.courses.forEach((c) => {
    c.evaluations.forEach((e) => {
      const item = { ...e, courseName: c.name, courseColor: c.color, courseId: c.id }
      if (e.week == null) sinAsignar.push(item)
      else (byWeek[e.week] = byWeek[e.week] || []).push(item)
    })
  })
  const weekList = Array.from({ length: weeks }, (_, i) => i + 1).filter((w) => byWeek[w]?.length)

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.row}>
        <Text style={styles.h2}>Cronograma</Text>
        <Text style={styles.sub}>{weeks} semanas</Text>
      </View>

      {weekList.length === 0 && sinAsignar.length === 0 && (
        <Card><Text style={styles.empty}>Nada con semana asignada todavía. Ponle semana a tus evaluaciones y aparecen aquí.</Text></Card>
      )}

      {weekList.map((w) => (
        <Card key={w} style={{ marginBottom: 12 }}>
          <View style={styles.weekHead}>
            <View style={styles.weekNum}><Text style={styles.weekNumText}>{w}</Text></View>
            <Text style={styles.weekTitle}>Semana {w}</Text>
          </View>
          {byWeek[w].map((e) => (
            <Pressable key={e.id} style={styles.item} onPress={() => onOpen(e.courseId)}>
              <View style={[styles.dot, { backgroundColor: e.courseColor }]} />
              <Text style={styles.itemCourse}>{e.courseName}</Text>
              <Text style={styles.itemEval} numberOfLines={1}> · {e.type}: {e.name}</Text>
              <View style={{ flex: 1 }} />
              {e.grade == null ? <Badge color="amber">pend.</Badge> : <Badge color="slate">{String(e.grade)}</Badge>}
            </Pressable>
          ))}
        </Card>
      ))}

      {sinAsignar.length > 0 && (
        <Card style={{ marginBottom: 24 }}>
          <Text style={styles.sinTitle}>Sin semana asignada ({sinAsignar.length})</Text>
          {sinAsignar.map((e) => (
            <Pressable key={e.id} style={styles.item} onPress={() => onOpen(e.courseId)}>
              <View style={[styles.dot, { backgroundColor: e.courseColor }]} />
              <Text style={styles.itemCourse}>{e.courseName}</Text>
              <Text style={styles.itemEval} numberOfLines={1}> · {e.name}</Text>
            </Pressable>
          ))}
        </Card>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  h2: { fontSize: 17, fontWeight: '700', color: colors.text },
  sub: { fontSize: 13, color: colors.textSoft },
  empty: { color: colors.textSoft, textAlign: 'center', paddingVertical: 16 },
  weekHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  weekNum: { width: 30, height: 30, borderRadius: 8, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  weekNumText: { color: '#fff', fontWeight: '800' },
  weekTitle: { fontWeight: '700', color: colors.text },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.slate50 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  itemCourse: { fontWeight: '600', color: colors.text, fontSize: 13 },
  itemEval: { color: colors.textSoft, fontSize: 13, flexShrink: 1 },
  sinTitle: { fontSize: 13, fontWeight: '700', color: colors.textSoft, marginBottom: 4 },
})
