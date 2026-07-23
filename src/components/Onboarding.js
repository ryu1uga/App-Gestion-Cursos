import React, { useRef, useState } from 'react'
import { View, Text, Pressable, ScrollView, useWindowDimensions, StyleSheet } from 'react-native'
import { Icon } from './ui.js'
import { colors } from '../theme.js'

const SLIDES = [
  {
    icon: 'book-open',
    title: 'Tus cursos, sin la hoja de Excel',
    body: 'Cursos, evaluaciones y notas en un solo lugar. Nada de esto sale de tu teléfono.',
  },
  {
    icon: 'plus-circle',
    title: 'Arma cada curso',
    body: 'Agrega tus evaluaciones —examen, práctica, proyecto— con su peso y la semana en que caen.',
  },
  {
    icon: 'edit-3',
    title: 'Anota conforme salen',
    body: 'Metes cada nota cuando te la devuelven y el promedio ponderado se calcula solo.',
  },
  {
    icon: 'target',
    title: '¿Me alcanza para aprobar?',
    body: 'Te digo cuánto necesitas en lo que falta y qué sacar en la próxima para no quedarte.',
  },
  {
    icon: 'sliders',
    title: 'Tu escala, tus reglas',
    body: '0–20, 0–7, lo que use tu facultad. Defines la nota de aprobación y si se redondea.',
  },
  {
    icon: 'calendar',
    title: 'Todo a la vista',
    body: 'El cronograma junta tus evaluaciones por semana. Y respaldas tus datos cuando quieras.',
  },
]

export default function Onboarding({ onDone }) {
  const { width } = useWindowDimensions()
  const scrollRef = useRef(null)
  const [index, setIndex] = useState(0)
  const last = index === SLIDES.length - 1

  const goTo = (i) => {
    const clamped = Math.max(0, Math.min(SLIDES.length - 1, i))
    scrollRef.current?.scrollTo({ x: clamped * width, animated: true })
    setIndex(clamped)
  }

  const onScroll = (e) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width)
    if (i !== index) setIndex(i)
  }

  return (
    <View style={styles.overlay}>
      <View style={styles.topBar}>
        {!last ? (
          <Pressable onPress={onDone} hitSlop={12}><Text style={styles.skip}>Saltar</Text></Pressable>
        ) : <View />}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
      >
        {SLIDES.map((s, i) => (
          <View key={i} style={[styles.slide, { width }]}>
            <View style={styles.iconCircle}><Icon name={s.icon} size={48} color={colors.brand} /></View>
            <Text style={styles.title}>{s.title}</Text>
            <Text style={styles.body}>{s.body}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Puntos indicadores */}
      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      {/* Botones */}
      <View style={styles.actions}>
        <Pressable style={styles.primaryBtn} onPress={() => (last ? onDone() : goTo(index + 1))}>
          <Text style={styles.primaryText}>{last ? 'Empezar' : 'Siguiente'}</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.bg, zIndex: 50 },
  topBar: { height: 44, justifyContent: 'center', alignItems: 'flex-end', paddingHorizontal: 20 },
  skip: { color: colors.textSoft, fontWeight: '600', fontSize: 15 },
  slide: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  iconCircle: {
    width: 120, height: 120, borderRadius: 60, backgroundColor: colors.brandLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: 32,
  },
  icon: { fontSize: 56 },
  title: { fontSize: 24, fontWeight: '800', color: '#0f172a', textAlign: 'center', marginBottom: 14 },
  body: { fontSize: 16, color: colors.textSoft, textAlign: 'center', lineHeight: 24 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 20 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.brand, width: 22 },
  actions: { paddingHorizontal: 24, paddingBottom: 40 },
  primaryBtn: { backgroundColor: colors.brand, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 16 },
})
