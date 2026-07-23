// ============================================================
//  Store global + persistencia (AsyncStorage) para React Native
// ============================================================
import React, { createContext, useContext, useEffect, useReducer, useRef } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as FileSystem from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import * as DocumentPicker from 'expo-document-picker'
import { newId, emptyState } from './id.js'
import { rescheduleAll } from './notify.js'

const KEY = 'gestion-cursos:v1'

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
            id: newId(), name: action.name || 'Nuevo curso', color: action.color || '#3355f5',
            useOwnScale: false, scale: { ...state.settings.defaultScale },
            startDate: null, endDate: null, roundFinal: null, evaluations: [],
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
                  { id: newId(), name: `Evaluación ${c.evaluations.length + 1}`, type: 'Evaluación', week: null, weight: 0, grade: null },
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
export async function exportJSON(state) {
  const { loaded, ...data } = state
  const fileUri = FileSystem.documentDirectory + `gestion-cursos-${new Date().toISOString().slice(0, 10)}.json`
  await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(data, null, 2))
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, { mimeType: 'application/json', dialogTitle: 'Exportar datos' })
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
