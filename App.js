import 'react-native-gesture-handler'
import React, { useState, useEffect } from 'react'
import { SafeAreaView, View, Text, Pressable, ActivityIndicator, StyleSheet, Platform, BackHandler, StatusBar as RNStatusBar } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { StatusBar } from 'expo-status-bar'
import { StoreProvider, useStore } from './src/lib/store.js'
import { newId } from './src/lib/id.js'
import CoursesScreen from './src/screens/CoursesScreen.js'
import CourseDetailScreen from './src/screens/CourseDetailScreen.js'
import ScheduleScreen from './src/screens/ScheduleScreen.js'
import TimetableScreen from './src/screens/TimetableScreen.js'
import SettingsScreen from './src/screens/SettingsScreen.js'
import Onboarding from './src/components/Onboarding.js'
import { Icon } from './src/components/ui.js'
import { colors } from './src/theme.js'

const TABS = [
  { id: 'cursos', label: 'Cursos', icon: 'book-open' },
  { id: 'cronograma', label: 'Cronograma', icon: 'calendar' },
  { id: 'horario', label: 'Horario', icon: 'clock' },
  { id: 'config', label: 'Ajustes', icon: 'sliders' },
]

// ¿El curso quedó "en blanco" (recién creado y sin tocar)?
const isPristineCourse = (c) =>
  c && (!c.name || c.name === 'Nuevo curso') && (c.evaluations?.length || 0) === 0 &&
  !c.startDate && !c.endDate && !c.useOwnScale

function Shell() {
  const { state, dispatch } = useStore()
  const [tab, setTab] = useState('cursos')
  const [openCourse, setOpenCourse] = useState(null)
  const [newCourseId, setNewCourseId] = useState(null)

  const createCourse = () => {
    const id = newId()
    dispatch({ type: 'ADD_COURSE', id })
    setNewCourseId(id)
    setOpenCourse(id)
  }

  // Cierra el detalle; si el curso era nuevo y quedó vacío, lo descarta.
  const closeCourse = () => {
    if (openCourse && openCourse === newCourseId) {
      const c = state.courses.find((x) => x.id === openCourse)
      if (isPristineCourse(c)) dispatch({ type: 'DELETE_COURSE', id: openCourse })
    }
    setNewCourseId(null)
    setOpenCourse(null)
  }

  // Botón físico "atrás" de Android: del detalle vuelve a la lista;
  // desde otra pestaña vuelve a Cursos; recién ahí deja salir de la app.
  useEffect(() => {
    const onBack = () => {
      if (openCourse) { closeCourse(); return true }
      if (tab !== 'cursos') { setTab('cursos'); return true }
      return false
    }
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack)
    return () => sub.remove()
  }, [openCourse, tab, newCourseId, state.courses])

  if (!state.loaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.brand} size="large" />
      </View>
    )
  }

  // Onboarding en el primer uso (o cuando se pide verlo de nuevo)
  if (!state.settings.onboarded) {
    return <Onboarding onDone={() => dispatch({ type: 'UPDATE_SETTINGS', patch: { onboarded: true } })} />
  }

  const course = state.courses.find((c) => c.id === openCourse)

  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <Text style={styles.title}>NotaFlow</Text>
        <Text style={styles.subtitle}>Tus notas, bajo control</Text>
      </View>

      <View style={styles.content}>
        {tab === 'cursos' && !course && <CoursesScreen onOpen={setOpenCourse} onCreate={createCourse} />}
        {tab === 'cursos' && course && <CourseDetailScreen course={course} onBack={closeCourse} />}
        {tab === 'cronograma' && <ScheduleScreen onOpen={(id) => { setTab('cursos'); setOpenCourse(id) }} />}
        {tab === 'horario' && <TimetableScreen onOpen={(id) => { setTab('cursos'); setOpenCourse(id) }} />}
        {tab === 'config' && <SettingsScreen />}
      </View>

      {/* Barra de pestañas inferior */}
      <View style={styles.tabbar}>
        {TABS.map((t) => {
          const active = tab === t.id
          return (
            <Pressable key={t.id} style={styles.tab} onPress={() => { closeCourse(); setTab(t.id) }}>
              <Icon name={t.icon} size={20} color={active ? colors.brand : colors.textFaint} />
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{t.label}</Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StoreProvider>
        <SafeAreaView style={styles.safe}>
          <StatusBar style="dark" />
          <Shell />
        </SafeAreaView>
      </StoreProvider>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0 },
  flex: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textSoft, marginTop: 2 },
  content: { flex: 1 },
  tabbar: {
    flexDirection: 'row', backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border,
    paddingBottom: Platform.OS === 'ios' ? 20 : 8, paddingTop: 8,
  },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  tabIcon: { fontSize: 20, opacity: 0.85 },
  tabLabel: { fontSize: 11, color: colors.textFaint, fontWeight: '600' },
  tabLabelActive: { color: colors.brand },
})
