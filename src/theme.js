// Paleta y tokens de estilo compartidos
export const colors = {
  brand: '#3355f5',
  brandDark: '#1a2db1',
  brandLight: '#dbe6ff',
  bg: '#f1f5f9',
  card: '#ffffff',
  border: '#e2e8f0',
  text: '#1e293b',
  textSoft: '#64748b',
  textFaint: '#94a3b8',
  slate50: '#f8fafc',
  slate100: '#f1f5f9',
  // estados
  emerald: '#059669', emeraldBg: '#d1fae5',
  amber: '#d97706', amberBg: '#fef3c7',
  red: '#dc2626', redBg: '#fee2e2',
}

// Colores para elegir por curso
export const palette = [
  '#3355f5', '#0ea5e9', '#8b5cf6', '#ec4899', '#14b8a6',
  '#f59e0b', '#f97316', '#ef4444', '#22c55e', '#10b981',
]

export const statusColor = {
  emerald: { fg: colors.emerald, bg: colors.emeraldBg },
  amber: { fg: colors.amber, bg: colors.amberBg },
  red: { fg: colors.red, bg: colors.redBg },
  slate: { fg: colors.textSoft, bg: colors.slate100 },
}
