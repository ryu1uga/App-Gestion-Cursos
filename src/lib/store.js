// ============================================================
//  Store global + persistencia (AsyncStorage) para React Native
// ============================================================
import React, { createContext, useContext, useEffect, useReducer, useRef } from 'react'
import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as FileSystem from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import * as DocumentPicker from 'expo-document-picker'
import { newId, emptyState } from './id.js'
import { rescheduleAll } from './notify.js'
import { DEFAULT_SESSION } from './classes.js'

const KEY = 'notaflow:v1'

const StoreCtx = createContext(null)
export const useStore = () => useContext(StoreCtx)

const initialState = { ...emptyState(), loaded: false }

function reducer(state, action) {
  switch (action.type) {
    case 'LOAD':
      return { ...action.payload, loaded: true }

    case 'ADD_COURSE':
      return {
        ...state,
        courses: [
          ...state.courses,
          {
            id: action.id || newId(), name: action.name || 'Nuevo curso', color: action.color || '#6d4a9c',
            useOwnScale: false, scale: { ...state.settings.defaultScale },
            startDate: null, endDate: null, roundFinal: null, evaluations: [], sessions: [],
          },
        ],
      }

    case 'UPDATE_COURSE':
      return { ...state, courses: state.courses.map((c) => (c.id === action.id ? { ...c, ...action.patch } : c)) }

    case 'DELETE_COURSE':
      return { ...state, courses: state.courses.filter((c) => c.id !== action.id) }

    case 'ADD_EVAL':
      return {
        ...state,
        courses: state.courses.map((c) =>
          c.id === action.courseId
            ? {
                ...c,
                evaluations: [
                  ...c.evaluations,
                  { id: newId(), name: `Evaluación ${c.evaluations.length + 1}`, type: 'Examen', week: null, date: null, weight: 0, grade: null },
                ],
              }
            : c,
        ),
      }

    case 'UPDATE_EVAL':
      return {
        ...state,
        courses: state.courses.map((c) =>
          c.id === action.courseId
            ? { ...c, evaluations: c.evaluations.map((e) => (e.id === action.evalId ? { ...e, ...action.patch } : e)) }
            : c,
        ),
      }

    case 'DELETE_EVAL':
      return {
        ...state,
        courses: state.courses.map((c) =>
          c.id === action.courseId
            ? { ...c, evaluations: c.evaluations.filter((e) => e.id !== action.evalId) }
            : c,
        ),
      }

    case 'REORDER_EVALS':
      return {
        ...state,
        courses: state.courses.map((c) =>
          c.id === action.courseId ? { ...c, evaluations: action.evaluations } : c,
        ),
      }

    // ---- Bloques de clase (horario semanal del curso) ----
    case 'ADD_SESSION':
      return {
        ...state,
        courses: state.courses.map((c) =>
          c.id === action.courseId
            ? { ...c, sessions: [...(c.sessions ?? []), { ...DEFAULT_SESSION, ...(action.session || {}), id: newId() }] }
            : c,
        ),
      }

    case 'UPDATE_SESSION':
      return {
        ...state,
        courses: state.courses.map((c) =>
          c.id === action.courseId
            ? { ...c, sessions: (c.sessions ?? []).map((s) => (s.id === action.sessionId ? { ...s, ...action.patch } : s)) }
            : c,
        ),
      }

    case 'DELETE_SESSION':
      return {
        ...state,
        courses: state.courses.map((c) =>
          c.id === action.courseId
            ? { ...c, sessions: (c.sessions ?? []).filter((s) => s.id !== action.sessionId) }
            : c,
        ),
      }

    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.patch } }

    case 'REPLACE_ALL':
      return { ...action.payload, loaded: true }

    default:
      return state
  }
}

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const first = useRef(true)

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY)
        const saved = raw ? JSON.parse(raw) : null
        if (saved && saved.courses) dispatch({ type: 'LOAD', payload: saved })
        else dispatch({ type: 'LOAD', payload: emptyState() })
      } catch {
        dispatch({ type: 'LOAD', payload: emptyState() })
      }
    })()
  }, [])

  useEffect(() => {
    if (!state.loaded) return
    if (first.current) { first.current = false }
    const { loaded, ...persist } = state
    AsyncStorage.setItem(KEY, JSON.stringify(persist)).catch(() => {})
    // Reprograma las notificaciones locales ante cualquier cambio relevante
    rescheduleAll(persist)
  }, [state])

  return <StoreCtx.Provider value={{ state, dispatch }}>{children}</StoreCtx.Provider>
}

// ---- Export / Import ----
const backupName = () => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `notaflow-${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}.json`
}

// Compartir (menú del sistema: WhatsApp, Drive, Guardar en Archivos, etc.)
export async function exportJSON(state) {
  const { loaded, ...data } = state
  const fileUri = FileSystem.documentDirectory + backupName()
  await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(data, null, 2))
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, { mimeType: 'application/json', dialogTitle: 'Exportar datos' })
  }
  return fileUri
}

// Descargar/guardar el JSON en una carpeta del dispositivo.
// Android: pide elegir carpeta (Storage Access Framework) y escribe ahí.
// iOS: escribe y abre "Guardar en Archivos" vía el menú de compartir.
// Devuelve la ruta, null si el usuario canceló.
export async function downloadJSON(state) {
  const { loaded, ...data } = state
  const content = JSON.stringify(data, null, 2)
  const name = backupName()

  if (Platform.OS === 'android') {
    const perm = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync()
    if (!perm.granted) return null
    const uri = await FileSystem.StorageAccessFramework.createFileAsync(perm.directoryUri, name, 'application/json')
    await FileSystem.writeAsStringAsync(uri, content)
    return uri
  }

  const fileUri = FileSystem.documentDirectory + name
  await FileSystem.writeAsStringAsync(fileUri, content)
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, { mimeType: 'application/json', dialogTitle: 'Guardar backup' })
  }
  return fileUri
}

export async function importJSON() {
  const res = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true })
  if (res.canceled) return null
  const uri = res.assets?.[0]?.uri
  if (!uri) return null
  const content = await FileSystem.readAsStringAsync(uri)
  const data = JSON.parse(content)
  if (!data.courses) throw new Error('Archivo inválido')
  return data
}
