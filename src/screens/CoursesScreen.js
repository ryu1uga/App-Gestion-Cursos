import React from 'react'
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native'
import { useStore } from '../lib/store.js'
import { analyzeCourse, effectiveScale, effectiveRound, fmtGrade, STATUS_META } from '../lib/calc.js'
import { Card, Badge, Progress } from '../components/ui.js'
import { colors } from '../theme.js'

export default function CoursesScreen({ onOpen }) {
  const { state, dispatch } = useStore()

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.row}>
        <Text style={styles.h2}>Mis cursos ({state.courses.length})</Text>
        <Pressable style={styles.addBtn} onPress={() => dispatch({ type: 'ADD_COURSE' })}>
          <Text style={styles.addBtnText}>+ Nuevo</Text>
        </Pressable>
      </View>

      {state.courses.length === 0 && (
        <Card><Text style={styles.empty}>Aún no tienes cursos. Crea uno con “+ Nuevo”.</Text></Card>
      )}

      {state.courses.map((c) => {
        const scale = effectiveScale(c, state.settings)
        const a = analyzeCourse(c.evaluations, scale, { round: effectiveRound(c, state.settings) })
        const meta = STATUS_META[a.status]
        const shown = a.projectedIfStopNow != null ? a.projectedIfStopNow : a.currentAvg
        return (
          <Pressable key={c.id} onPress={() => onOpen(c.id)} style={{ marginBottom: 12 }}>
            <Card>
              <View style={styles.cardHead}>
                <View style={styles.rowCenter}>
                  <View style={[styles.dot, { backgroundColor: c.color }]} />
                  <Text style={styles.courseName}>{c.name}</Text>
                </View>
                <Badge color={meta.color}>{meta.label}</Badge>
              </View>

              <View style={styles.gradeRow}>
                <Text style={styles.gradeLabel}>
                  Nota actual{a.pendingWeight > 0 ? ' (proy.)' : ''}
                </Text>
                <Text style={[styles.gradeVal, { color: c.color }]}>
                  {fmtGrade(shown, scale)}<Text style={styles.gradeMax}> / {scale.max}</Text>
                </Text>
              </View>

              <Progress value={shown || 0} max={scale.max} color={c.color} threshold={scale.passing} />

              <View style={styles.metaRow}>
                <Text style={styles.metaText}>{a.graded.length}/{c.evaluations.length} evaluadas</Text>
                <Text style={styles.metaText}>Aprobación: {scale.passing}</Text>
              </View>
            </Card>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  rowCenter: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  h2: { fontSize: 17, fontWeight: '700', color: colors.text },
  addBtn: { backgroundColor: colors.brand, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  empty: { color: colors.textSoft, textAlign: 'center', paddingVertical: 16 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  dot: { width: 12, height: 12, borderRadius: 6, marginRight: 8 },
  courseName: { fontWeight: '700', color: colors.text, fontSize: 15, flexShrink: 1 },
  gradeRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 6 },
  gradeLabel: { color: colors.textSoft, fontSize: 13 },
  gradeVal: { fontSize: 22, fontWeight: '800' },
  gradeMax: { fontSize: 13, fontWeight: '400', color: colors.textFaint },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  metaText: { fontSize: 12, color: colors.textSoft },
})
