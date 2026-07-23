import 'react-native-gesture-handler'
import React, { useState } from 'react'
import { SafeAreaView, View, Text, Pressable, ActivityIndicator, StyleSheet, Platform, StatusBar as RNStatusBar } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { StatusBar } from 'expo-status-bar'
import { StoreProvider, useStore } from './src/lib/store.js'
import CoursesScreen from './src/screens/CoursesScreen.js'
import CourseDetailScreen from './src/screens/CourseDetailScreen.js'
import ScheduleScreen from './src/screens/ScheduleScreen.js'
import SettingsScreen from './src/screens/SettingsScreen.js'
import Onboarding from './src/components/Onboarding.js'
import { Icon } from './src/components/ui.js'
import { colors } from './src/theme.js'

const TABS = [
  { id: 'cursos', label: 'Cursos', icon: 'book-open' },
  { id: 'cronograma', label: 'Cronograma', icon: 'calendar' },
  { id: 'config', label: 'Ajustes', icon: 'sliders' },
]

function Shell() {
  const { state, dispatch } = useStore()
  const [tab, setTab] = useState('cursos')
  const [openCourse, setOpenCourse] = useState(null)

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
        {tab === 'cursos' && !course && <CoursesScreen onOpen={setOpenCourse} />}
        {tab === 'cursos' && course && <CourseDetailScreen course={course} onBack={() => setOpenCourse(null)} />}
        {tab === 'cronograma' && <ScheduleScreen onOpen={(id) => { setTab('cursos'); setOpenCourse(id) }} />}
        {tab === 'config' && <SettingsScreen />}
      </View>

      {/* Barra de pestañas inferior */}
      <View style={styles.tabbar}>
        {TABS.map((t) => {
          const active = tab === t.id
          return (
            <Pressable key={t.id} style={styles.tab} onPress={() => { setTab(t.id); setOpenCourse(null) }}>
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
  title: { fontSize: 24, fontWeight: '800', color: '#0f172a' },
  subtitle: { fontSize: 13, color: colors.textSoft, marginTop: 2 },
  content: { flex: 1 },
  tabbar: {
    flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colors.border,
    paddingBottom: Platform.OS === 'ios' ? 20 : 8, paddingTop: 8,
  },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  tabIcon: { fontSize: 20, opacity: 0.85 },
  tabLabel: { fontSize: 11, color: colors.textFaint, fontWeight: '600' },
  tabLabelActive: { color: colors.brand },
})
