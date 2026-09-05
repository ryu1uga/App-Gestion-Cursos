// Paleta y tokens de estilo.
//
// A diferencia del desktop, aquí no hay variables CSS: React Native congela
// los colores dentro de cada StyleSheet.create al importar el módulo. Por eso
// las paletas son objetos y las pantallas construyen sus estilos con
// makeStyles(c) a través de useStyles() (ver src/lib/useTheme.js).
//
// IMPORTANTE: los valores son los mismos que las variables de
// Notaflow-Desktop/renderer/src/styles.css (:root y [data-theme="dark"]).
// Si cambias un color allá, cámbialo aquí.

// Pares fg/bg de estado, derivados de la paleta que toque.
const withStatus = (c) => ({
  ...c,
  status: {
    emerald: { fg: c.emerald, bg: c.emeraldBg },
    amber: { fg: c.amber, bg: c.amberBg },
    red: { fg: c.red, bg: c.redBg },
    slate: { fg: c.textSoft, bg: c.slate100 },
  },
})

export const lightColors = withStatus({
  scheme: 'light',
  brand: '#6d4a9c',       // morado tinta
  brandDark: '#563982',
  brandLight: '#ede4f8',  // lila muy claro
  bg: '#f5f2ec',          // papel cálido
  card: '#fffefb',        // blanco hueso
  border: '#e6ddce',      // borde cálido
  text: '#2e2833',
  textSoft: '#6e6472',
  textFaint: '#a49aa8',
  slate50: '#f8f4ec',     // (nombre heredado) superficie sutil
  slate100: '#eee7da',    // (nombre heredado) superficie marcada
  emerald: '#35875a', emeraldBg: '#e2efe5',
  amber: '#b07d1a', amberBg: '#f6ecd2',
  red: '#c04a42', redBg: '#f7e2de',
})

export const darkColors = withStatus({
  scheme: 'dark',
  brand: '#a684d6',
  brandDark: '#b795e3',
  brandLight: 'rgba(166, 132, 214, 0.16)',
  bg: '#15111b',
  card: '#1e1826',
  border: '#322940',
  text: '#ece7f2',
  textSoft: '#a89fb4',
  textFaint: '#6f6580',
  slate50: '#262030',
  slate100: '#2f2739',
  emerald: '#6cc493', emeraldBg: 'rgba(108, 196, 147, 0.14)',
  amber: '#dcaa4c', amberBg: 'rgba(220, 170, 76, 0.14)',
  red: '#e07a6f', redBg: 'rgba(224, 122, 111, 0.14)',
})

export const PALETTES = { light: lightColors, dark: darkColors }

// Colores para elegir por curso. Se guardan como hex en los datos del usuario
// (no cambiar los valores existentes: los cursos ya creados los tienen
// persistidos). Elegidos para funcionar en claro y en oscuro.
export const palette = [
  '#6d4a9c', '#3b7ea1', '#4f9d69', '#bf861f', '#c86b4a',
  '#c1517a', '#5a6fc0', '#8a6d3b', '#4aa1a1', '#9c5bbf',
]
