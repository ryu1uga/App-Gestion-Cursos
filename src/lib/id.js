// Generador de IDs únicos y estado inicial vacío (sin datos de ejemplo)
let _n = 0
export const newId = () => `${Date.now().toString(36)}-${(_n++).toString(36)}`

export function emptyState() {
  return {
    courses: [],
    settings: {
      defaultScale: { min: 0, max: 20, passing: 11, step: 1 },
      semesterWeeks: 16,
      roundFinal: true,
      onboarded: false,
    },
  }
}
