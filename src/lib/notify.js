// ============================================================
//  Notificaciones locales de evaluaciones próximas
//  Fecha de una evaluación = startDate del curso + (semana-1)*7 días.
//  El aviso cae como máximo el DOMINGO de la semana anterior a la
//  evaluación; los "días antes" pueden adelantarlo más. La hora del
//  aviso es configurable (notifyHour / notifyMinute).
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
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

// Calcula la fecha (Date) de una evaluación a partir del inicio del curso y su semana.
export function evalDate(startDate, week) {
  if (!startDate || week == null) return null
  const base = new Date(startDate)
  if (Number.isNaN(base.getTime())) return null
  const d = new Date(base.getTime() + (Number(week) - 1) * 7 * DAY_MS)
  d.setHours(0, 0, 0, 0)
  return d
}

// Fecha efectiva de una evaluación: el DÍA EXACTO si se fijó (ev.date),
// si no, la derivada de inicio + semana. Devuelve Date (a medianoche) o null.
export function evalEffectiveDate(course, ev) {
  if (ev?.date) {
    const d = new Date(ev.date)
    if (!Number.isNaN(d.getTime())) { d.setHours(0, 0, 0, 0); return d }
  }
  return evalDate(course?.startDate, ev?.week)
}

// Calcula el número de semana (1..N) de una fecha dada, respecto al inicio del curso.
export function weekFromDate(startDate, dateISO) {
  if (!startDate || !dateISO) return null
  const s = new Date(startDate); if (Number.isNaN(s.getTime())) return null
  const d = new Date(dateISO); if (Number.isNaN(d.getTime())) return null
  s.setHours(0, 0, 0, 0); d.setHours(0, 0, 0, 0)
  const diffDays = Math.round((d.getTime() - s.getTime()) / DAY_MS) // round: absorbe cambios de hora (DST)
  return Math.floor(diffDays / 7) + 1
}

// Domingo que cierra la semana ANTERIOR a la semana de la evaluación.
// Ej.: eval miércoles 22/07 -> lunes de su semana = 20/07 -> domingo previo = 19/07.
export function prevWeekSunday(evDay) {
  const d = new Date(evDay)
  d.setHours(0, 0, 0, 0)
  const offset = ((d.getDay() + 6) % 7) + 1 // días hasta el domingo anterior al lunes de su semana
  d.setDate(d.getDate() - offset)
  return d
}

// Fecha+hora exacta en que debe sonar el aviso de una evaluación (o null).
export function notifyFireAt(evDay, daysBefore, hour, minute) {
  if (!evDay) return null
  const byDaysBefore = new Date(evDay)
  byDaysBefore.setDate(byDaysBefore.getDate() - Math.max(0, daysBefore))
  const cap = prevWeekSunday(evDay)
  // No puede ser más tarde que el domingo tope; los días antes solo lo adelantan.
  const day = byDaysBefore.getTime() < cap.getTime() ? byDaysBefore : cap
  const fire = new Date(day)
  fire.setHours(hour, minute, 0, 0)
  return fire
}

const humanDate = (d) => `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}`

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

    const s = state.settings
    const daysBefore = Number(s.notifyDaysBefore ?? 2)
    const hour = Number(s.notifyHour ?? 9)
    const minute = Number(s.notifyMinute ?? 0)
    const now = Date.now()

    for (const c of state.courses) {
      for (const e of c.evaluations) {
        if (e.grade != null && e.grade !== '') continue // ya tiene nota
        const evDay = evalEffectiveDate(c, e)
        if (!evDay) continue
        const fireAt = notifyFireAt(evDay, daysBefore, hour, minute)
        if (!fireAt || fireAt.getTime() <= now) continue // ya pasó

        await Notifications.scheduleNotificationAsync({
          content: {
            title: c.name,
            body: `${e.type} · ${e.name} — es el ${humanDate(evDay)}`,
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
