// ============================================================
//  Notificaciones locales de evaluaciones próximas
//  Fecha de una evaluación = startDate del curso + (semana-1)*7 días.
//  Se avisa `notifyDaysBefore` días antes, a las 9:00 a. m.
// ============================================================
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

// Muestra la notificación aunque la app esté en primer plano
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

const DAY_MS = 24 * 60 * 60 * 1000

// Calcula la fecha (Date) de una evaluación a partir del inicio del curso y su semana.
export function evalDate(startDate, week) {
  if (!startDate || week == null) return null
  const base = new Date(startDate)
  if (Number.isNaN(base.getTime())) return null
  const d = new Date(base.getTime() + (Number(week) - 1) * 7 * DAY_MS)
  d.setHours(9, 0, 0, 0) // hora de la evaluación (referencia)
  return d
}

// Pide permiso de notificaciones. Devuelve true si quedó concedido.
export async function ensurePermission() {
  const settled = await Notifications.getPermissionsAsync()
  let status = settled.status
  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync()
    status = req.status
  }
  if (status === 'granted' && Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('evaluaciones', {
      name: 'Evaluaciones',
      importance: Notifications.AndroidImportance.HIGH,
    })
  }
  return status === 'granted'
}

// Reprograma TODAS las notificaciones según el estado actual.
// Cancela lo anterior y agenda un aviso por cada evaluación pendiente con fecha futura.
export async function rescheduleAll(state) {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync()
    if (!state?.settings?.notificationsOn) return

    const daysBefore = Number(state.settings.notifyDaysBefore ?? 2)
    const now = Date.now()

    for (const c of state.courses) {
      if (!c.startDate) continue
      for (const e of c.evaluations) {
        if (e.grade != null && e.grade !== '') continue // ya tiene nota
        const when = evalDate(c.startDate, e.week)
        if (!when) continue
        const fireAt = new Date(when.getTime() - daysBefore * DAY_MS)
        if (fireAt.getTime() <= now) continue // ya pasó

        await Notifications.scheduleNotificationAsync({
          content: {
            title: `📌 ${c.name}`,
            body:
              daysBefore <= 0
                ? `Hoy: ${e.type} · ${e.name}`
                : `En ${daysBefore} día${daysBefore === 1 ? '' : 's'}: ${e.type} · ${e.name}`,
            data: { courseId: c.id, evalId: e.id },
          },
          trigger: fireAt,
          ...(Platform.OS === 'android' ? { channelId: 'evaluaciones' } : {}),
        })
      }
    }
  } catch {
    // Silencioso: si el entorno no soporta notificaciones (ej. web), no rompe la app.
  }
}
