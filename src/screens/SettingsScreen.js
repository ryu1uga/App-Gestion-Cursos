import React, { useState } from 'react'
import { ScrollView, View, Text, Pressable, Switch, Alert, StyleSheet } from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import { useStore, exportJSON, downloadJSON, importJSON } from '../lib/store.js'
import { ensurePermission } from '../lib/notify.js'
import { Card, NumField, Icon, InfoButton } from '../components/ui.js'
import { colors } from '../theme.js'

const two = (n) => String(n).padStart(2, '0')

const STEP_INFO = {
  title: 'Paso de la nota',
  text: 'Define a qué valores se ajusta (redondea) la nota final:\n\n• 1 → notas enteras (…, 10, 11, 12)\n• 0.5 → medios puntos (10, 10.5, 11)\n• 0.25 → cuartos (10, 10.25, 10.5)\n• 0.1 → un decimal (10.0, 10.1, 10.2)\n\nElige el que use tu facultad.',
}

export default function SettingsScreen() {
  const { state, dispatch } = useStore()
  const s = state.settings
  const [showTime, setShowTime] = useState(false)
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
  const doDownload = async () => {
    try {
      const uri = await downloadJSON(state)
      if (uri) Alert.alert('Backup guardado', 'Tu archivo JSON se guardó en la carpeta que elegiste.')
    } catch (e) { Alert.alert('Error al guardar', String(e.message || e)) }
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
        <Text style={styles.p}>Se usa en los cursos que no tienen escala propia. Tu facultad usa 0–20 y aprueba con 11; otra quizá 0–7 con 4.</Text>
        <View style={styles.grid}>
          <Field label="Nota mínima" value={s.defaultScale.min} onChange={(v) => setScale({ min: v })} />
          <Field label="Nota máxima" value={s.defaultScale.max} onChange={(v) => setScale({ max: v })} />
          <Field label="Aprobar con" value={s.defaultScale.passing} onChange={(v) => setScale({ passing: v })} />
          <Field label="Paso" value={s.defaultScale.step} onChange={(v) => setScale({ step: v })} info={STEP_INFO} />
        </View>

        <View style={styles.toggleRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.toggleTitle}>Redondear la nota final</Text>
            <Text style={styles.p}>Ajusta la nota final al paso de tu escala (a enteros, medios o decimales, según tu configuración). Actívalo si tu facultad redondea; apágalo para el promedio exacto.</Text>
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
        <Text style={styles.p}>Te aviso antes de cada evaluación. Necesito la fecha de inicio del curso y la semana de la evaluación.</Text>
        <View style={styles.toggleRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.toggleTitle}>Activar avisos</Text>
            <Text style={styles.p}>Un recordatorio antes de cada una.</Text>
          </View>
          <Switch value={s.notificationsOn === true} trackColor={{ true: colors.brand }}
            onValueChange={toggleNotifications} />
        </View>
        {s.notificationsOn === true && (
          <>
            <View style={[styles.grid, { marginTop: 12 }]}>
              <Field label="Avisar días antes" value={s.notifyDaysBefore ?? 2}
                onChange={(v) => dispatch({ type: 'UPDATE_SETTINGS', patch: { notifyDaysBefore: Math.max(0, Math.trunc(v)) } })} />
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Hora del aviso</Text>
                <Pressable style={styles.timeBtn} onPress={() => setShowTime(true)}>
                  <Icon name="clock" size={15} color={colors.textSoft} />
                  <Text style={styles.timeBtnText}>{two(s.notifyHour ?? 9)}:{two(s.notifyMinute ?? 0)}</Text>
                </Pressable>
              </View>
            </View>
            <Text style={styles.p}>Llega a lo más tarde el domingo previo a la semana de la evaluación. Los "días antes" solo pueden adelantarlo.</Text>
            {showTime && (
              <DateTimePicker
                mode="time"
                is24Hour
                value={(() => { const d = new Date(); d.setHours(s.notifyHour ?? 9, s.notifyMinute ?? 0, 0, 0); return d })()}
                onChange={(event, sel) => {
                  setShowTime(false)
                  if (event.type === 'set' && sel) {
                    dispatch({ type: 'UPDATE_SETTINGS', patch: { notifyHour: sel.getHours(), notifyMinute: sel.getMinutes() } })
                  }
                }}
              />
            )}
          </>
        )}
      </Card>

      <Card style={{ marginBottom: 24 }}>
        <Text style={styles.h2}>Copia de seguridad</Text>
        <Text style={styles.p}>Tus datos viven solo aquí. Descárgalos como archivo, compártelos o vuelve a importarlos.</Text>
        <View style={styles.btnRow}>
          <Pressable style={styles.btnPrimary} onPress={doDownload}>
            <Icon name="download" size={16} color="#fff" />
            <Text style={styles.btnPrimaryText}>Descargar</Text>
          </Pressable>
          <Pressable style={styles.btnGhost} onPress={doExport}>
            <Icon name="share-2" size={16} color={colors.text} />
            <Text style={styles.btnGhostText}>Compartir</Text>
          </Pressable>
          <Pressable style={styles.btnGhost} onPress={doImport}>
            <Icon name="upload" size={16} color={colors.text} />
            <Text style={styles.btnGhostText}>Importar</Text>
          </Pressable>
        </View>
      </Card>

      <Card style={{ marginBottom: 24 }}>
        <Text style={styles.h2}>Ayuda</Text>
        <Text style={styles.p}>¿Repasamos cómo funciona?</Text>
        <Pressable style={styles.btnGhost} onPress={() => dispatch({ type: 'UPDATE_SETTINGS', patch: { onboarded: false } })}>
          <Icon name="help-circle" size={16} color={colors.text} />
          <Text style={styles.btnGhostText}>Ver el tutorial otra vez</Text>
        </Pressable>
      </Card>

      <Text style={styles.footer}>NotaFlow · todo vive en tu teléfono</Text>
    </ScrollView>
  )
}

function Field({ label, value, onChange, info }) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldLabelRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {info ? <InfoButton title={info.title} text={info.text} size={13} /> : null}
      </View>
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
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  fieldLabel: { fontSize: 12, color: colors.textSoft },
  fieldInput: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 9, textAlign: 'center', color: colors.text },
  timeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 9 },
  timeBtnText: { color: colors.text, fontWeight: '700', fontSize: 15 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, backgroundColor: colors.slate50, borderRadius: 12, padding: 12 },
  toggleTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 2 },
  btnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  btnPrimary: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.brand, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  btnPrimaryText: { color: '#fff', fontWeight: '700' },
  btnGhost: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  btnGhostText: { color: colors.text, fontWeight: '700' },
  footer: { textAlign: 'center', fontSize: 12, color: colors.textFaint },
})
