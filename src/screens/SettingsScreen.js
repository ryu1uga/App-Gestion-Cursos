import React from 'react'
import { ScrollView, View, Text, Pressable, Switch, Alert, StyleSheet } from 'react-native'
import { useStore, exportJSON, importJSON } from '../lib/store.js'
import { ensurePermission } from '../lib/notify.js'
import { Card, NumField } from '../components/ui.js'
import { colors } from '../theme.js'

export default function SettingsScreen() {
  const { state, dispatch } = useStore()
  const s = state.settings
  const setScale = (patch) => dispatch({ type: 'UPDATE_SETTINGS', patch: { defaultScale: { ...s.defaultScale, ...patch } } })

  const toggleNotifications = async (v) => {
    if (!v) { dispatch({ type: 'UPDATE_SETTINGS', patch: { notificationsOn: false } }); return }
    const ok = await ensurePermission()
    if (ok) dispatch({ type: 'UPDATE_SETTINGS', patch: { notificationsOn: true } })
    else Alert.alert('Permiso denegado', 'Activa las notificaciones de la app en los ajustes de tu teléfono para recibir avisos.')
  }

  const doExport = async () => {
    try { await exportJSON(state) } catch (e) { Alert.alert('Error al exportar', String(e.message || e)) }
  }
  const doImport = async () => {
    try {
      const data = await importJSON()
      if (!data) return
      Alert.alert('Importar datos', 'Esto reemplazará todos tus datos actuales. ¿Continuar?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Reemplazar', style: 'destructive', onPress: () => dispatch({ type: 'REPLACE_ALL', payload: data }) },
      ])
    } catch (e) { Alert.alert('Archivo inválido', String(e.message || e)) }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card style={{ marginBottom: 12 }}>
        <Text style={styles.h2}>Escala global por defecto</Text>
        <Text style={styles.p}>Se aplica a los cursos sin escala propia. Ej.: tu universidad usa 0–20 y aprueba con 11; otra podría usar 0–7 y aprobar con 4 (eso se activa por curso).</Text>
        <View style={styles.grid}>
          <Field label="Nota mínima" value={s.defaultScale.min} onChange={(v) => setScale({ min: v })} />
          <Field label="Nota máxima" value={s.defaultScale.max} onChange={(v) => setScale({ max: v })} />
          <Field label="Aprobar con" value={s.defaultScale.passing} onChange={(v) => setScale({ passing: v })} />
          <Field label="Paso (1=enteros)" value={s.defaultScale.step} onChange={(v) => setScale({ step: v })} />
        </View>

        <View style={styles.toggleRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.toggleTitle}>Redondear la nota final</Text>
            <Text style={styles.p}>Al paso de la escala (ej. 10.65 → 11). Actívalo si tu universidad redondea la nota final para aprobar; desactívalo para ver el promedio exacto.</Text>
          </View>
          <Switch value={s.roundFinal !== false} trackColor={{ true: colors.brand }}
            onValueChange={(v) => dispatch({ type: 'UPDATE_SETTINGS', patch: { roundFinal: v } })} />
        </View>
      </Card>

      <Card style={{ marginBottom: 12 }}>
        <Text style={styles.h2}>Semestre</Text>
        <View style={styles.grid}>
          <Field label="Semanas" value={s.semesterWeeks} onChange={(v) => dispatch({ type: 'UPDATE_SETTINGS', patch: { semesterWeeks: v } })} />
        </View>
      </Card>

      <Card style={{ marginBottom: 12 }}>
        <Text style={styles.h2}>Notificaciones</Text>
        <Text style={styles.p}>Avisos locales antes de cada evaluación. Requiere que el curso tenga fecha de inicio y que la evaluación tenga semana asignada.</Text>
        <View style={styles.toggleRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.toggleTitle}>Activar avisos</Text>
            <Text style={styles.p}>Te recordamos las evaluaciones próximas.</Text>
          </View>
          <Switch value={s.notificationsOn === true} trackColor={{ true: colors.brand }}
            onValueChange={toggleNotifications} />
        </View>
        {s.notificationsOn === true && (
          <View style={[styles.grid, { marginTop: 12 }]}>
            <Field label="Avisar días antes" value={s.notifyDaysBefore ?? 2}
              onChange={(v) => dispatch({ type: 'UPDATE_SETTINGS', patch: { notifyDaysBefore: Math.max(0, Math.trunc(v)) } })} />
          </View>
        )}
      </Card>

      <Card style={{ marginBottom: 24 }}>
        <Text style={styles.h2}>Copia de seguridad</Text>
        <Text style={styles.p}>Tus datos viven solo en este dispositivo. Expórtalos para respaldar o pasarlos a otro equipo.</Text>
        <View style={styles.btnRow}>
          <Pressable style={styles.btnPrimary} onPress={doExport}><Text style={styles.btnPrimaryText}>⬆ Exportar</Text></Pressable>
          <Pressable style={styles.btnGhost} onPress={doImport}><Text style={styles.btnGhostText}>⬇ Importar</Text></Pressable>
        </View>
      </Card>

      <Card style={{ marginBottom: 24 }}>
        <Text style={styles.h2}>Ayuda</Text>
        <Text style={styles.p}>¿Quieres repasar cómo funciona la app?</Text>
        <Pressable style={styles.btnGhost} onPress={() => dispatch({ type: 'UPDATE_SETTINGS', patch: { onboarded: false } })}>
          <Text style={styles.btnGhostText}>📘 Ver tutorial de nuevo</Text>
        </Pressable>
      </Card>

      <Text style={styles.footer}>Gestión de Cursos · datos locales en tu dispositivo</Text>
    </ScrollView>
  )
}

function Field({ label, value, onChange }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <NumField style={styles.fieldInput} value={value} onChangeNumber={(v) => onChange(v)} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  h2: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 4 },
  p: { fontSize: 13, color: colors.textSoft, marginBottom: 8, lineHeight: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  field: { flexGrow: 1, minWidth: '45%' },
  fieldLabel: { fontSize: 12, color: colors.textSoft, marginBottom: 4 },
  fieldInput: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 9, textAlign: 'center', color: colors.text },
  toggleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, backgroundColor: colors.slate50, borderRadius: 12, padding: 12 },
  toggleTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 2 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  btnPrimary: { backgroundColor: colors.brand, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  btnPrimaryText: { color: '#fff', fontWeight: '700' },
  btnGhost: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  btnGhostText: { color: colors.text, fontWeight: '700' },
  footer: { textAlign: 'center', fontSize: 12, color: colors.textFaint },
})
