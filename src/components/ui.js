import React, { useState } from 'react'
import { View, Text, Pressable, Modal, TextInput, StyleSheet } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { colors, statusColor } from '../theme.js'

// Ícono base de la app (Feather, incluido en Expo)
export function Icon({ name, size = 18, color = colors.text, style }) {
  return <Feather name={name} size={size} color={color} style={style} />
}

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>
}

// ------------------------------------------------------------
//  Campo numérico robusto (acepta decimales con punto o coma)
//  Mantiene el texto crudo mientras editas (permite estados
//  intermedios como "10." o "10,5") y solo convierte a número al
//  terminar de editar. Evita la corrupción al teclear decimales.
// ------------------------------------------------------------
export function NumField({
  value,
  onChangeNumber,
  style,
  placeholder,
  allowEmpty = false,
  integer = false,
  format,
}) {
  const [focused, setFocused] = useState(false)
  const [text, setText] = useState('')

  const asText = (v) => (v == null || v === '' ? '' : String(v))
  const displayed = focused ? text : (format ? (value == null || value === '' ? '' : format(value)) : asText(value))

  const handleChange = (t) => {
    // Solo dígitos y un separador decimal (punto o coma); '-' opcional al inicio.
    let cleaned = t.replace(integer ? /[^0-9\-]/g : /[^0-9.,\-]/g, '')
    setText(cleaned)
  }

  const commit = () => {
    setFocused(false)
    const raw = text.replace(',', '.').trim()
    if (raw === '' || raw === '-' || raw === '.') {
      onChangeNumber(allowEmpty ? null : 0)
      return
    }
    let n = Number(raw)
    if (Number.isNaN(n)) { onChangeNumber(allowEmpty ? null : 0); return }
    if (integer) n = Math.trunc(n)
    onChangeNumber(n)
  }

  return (
    <TextInput
      style={style}
      placeholder={placeholder}
      placeholderTextColor={colors.textFaint}
      keyboardType={integer ? 'number-pad' : 'decimal-pad'}
      value={displayed}
      onFocus={() => { setFocused(true); setText(asText(value)) }}
      onChangeText={handleChange}
      onEndEditing={commit}
      onBlur={commit}
    />
  )
}

export function Badge({ color = 'slate', children }) {
  const c = statusColor[color] || statusColor.slate
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.fg }]}>{children}</Text>
    </View>
  )
}

// Barra de progreso con marca de umbral
export function Progress({ value, max, color = colors.brand, threshold }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  const tpct = threshold != null && max > 0 ? (threshold / max) * 100 : null
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: color }]} />
      {tpct != null && <View style={[styles.progressMark, { left: `${tpct}%` }]} />}
    </View>
  )
}

// Selector modal simple (para tipo de evaluación)
export function PickerModal({ visible, options, value, onSelect, onClose, title }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <View style={styles.modalSheet}>
          {title ? <Text style={styles.modalTitle}>{title}</Text> : null}
          {options.map((opt) => (
            <Pressable key={opt} style={styles.modalRow} onPress={() => { onSelect(opt); onClose() }}>
              <Text style={[styles.modalRowText, opt === value && { color: colors.brand, fontWeight: '700' }]}>{opt}</Text>
              {opt === value ? <Icon name="check" size={18} color={colors.brand} /> : null}
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card, borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: colors.border,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  progressTrack: { height: 10, borderRadius: 999, backgroundColor: '#e2e8f0', overflow: 'visible', justifyContent: 'center' },
  progressFill: { height: 10, borderRadius: 999 },
  progressMark: { position: 'absolute', width: 2, height: 14, backgroundColor: '#64748b', borderRadius: 1 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)', justifyContent: 'center', padding: 32 },
  modalSheet: { backgroundColor: '#fff', borderRadius: 16, paddingVertical: 8 },
  modalTitle: { fontWeight: '700', color: colors.text, paddingHorizontal: 16, paddingVertical: 8 },
  modalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  modalRowText: { fontSize: 16, color: colors.text },
})
