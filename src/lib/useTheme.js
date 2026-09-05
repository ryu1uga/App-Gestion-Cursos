// ------------------------------------------------------------
//  Tema claro / oscuro
// ------------------------------------------------------------
//  El desktop cambia una variable CSS en el <html> y el navegador repinta
//  todo. Aquí no: StyleSheet.create se evalúa una sola vez, al importar el
//  módulo, así que los colores quedarían congelados al arrancar la app.
//
//  Por eso cada pantalla declara sus estilos como makeStyles(c) y los pide
//  con useStyles(makeStyles). El hook devuelve la paleta y la hoja de
//  estilos ya construida para el tema activo:
//
//    const makeStyles = (tema) => StyleSheet.create({ ... tema.brand ... })
//    function Pantalla() {
//      const { tema, styles } = useStyles(makeStyles)
//    }
//
//  La preferencia vive en settings.theme y vale 'system' | 'light' | 'dark'.
//  Con 'system' se sigue el tema del teléfono y cambia solo al anochecer si
//  el usuario tiene esa opción activada.

import React, { createContext, useContext, useMemo } from 'react'
import { useColorScheme } from 'react-native'
import { PALETTES } from '../theme.js'

export const THEME_MODES = ['system', 'light', 'dark']
export const THEME_LABEL = { system: 'Sistema', light: 'Claro', dark: 'Oscuro' }

const ThemeCtx = createContext(PALETTES.light)

// Qué paleta toca, dada la preferencia y lo que dice el sistema.
export function resolveScheme(mode, system) {
  if (mode === 'light' || mode === 'dark') return mode
  return system === 'dark' ? 'dark' : 'light'
}

export function ThemeProvider({ mode = 'system', children }) {
  const system = useColorScheme()
  const value = useMemo(() => PALETTES[resolveScheme(mode, system)], [mode, system])
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>
}

// La paleta activa.
export const useTheme = () => useContext(ThemeCtx)

// Las hojas ya construidas, cacheadas por (fábrica, paleta). Sin esto, cada
// componente de un mismo archivo volvería a crear la hoja entera en cada
// render, y hay archivos con cinco o seis componentes.
const cache = new WeakMap()

function stylesFor(factory, tema) {
  let porPaleta = cache.get(factory)
  if (!porPaleta) { porPaleta = new WeakMap(); cache.set(factory, porPaleta) }
  let hoja = porPaleta.get(tema)
  if (!hoja) { hoja = factory(tema); porPaleta.set(tema, hoja) }
  return hoja
}

export function useStyles(factory) {
  const tema = useTheme()
  return useMemo(() => ({ tema, styles: stylesFor(factory, tema) }), [factory, tema])
}
