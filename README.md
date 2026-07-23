# NotaFlow · Control de Notas (React Native + Expo)

App móvil para gestionar tus cursos, su cronograma de evaluaciones por semana y llevar el control de notas ponderadas — calculando cuánto necesitas para aprobar.

Hecha con **React Native + Expo**. Corre en tu celular con **Expo Go**. Los datos se guardan en el dispositivo (AsyncStorage); no sale nada a internet.

## Requisitos

- [Node.js](https://nodejs.org) 18+ en tu PC.
- La app **Expo Go** instalada en tu celular (gratis en Play Store / App Store).
- PC y celular en la **misma red WiFi**.

## Cómo correrla

```bash
npm install         # instala dependencias (¡corre esto tras actualizar!)
npx expo start -c   # inicia el servidor (-c limpia caché de Babel) y muestra un QR
```

> Esta versión agregó dependencias nativas (fechas, notificaciones y reordenar
> arrastrando). Debes correr `npm install` de nuevo y reiniciar Expo con `-c`.
> Todas funcionan dentro de Expo Go, no necesitas compilar un APK.

Luego:
- **Android:** abre **Expo Go** → *Scan QR code* → escanea el QR de la terminal.
- **iPhone:** abre la **cámara** → apunta al QR → abre en Expo Go.

La app carga en tu celular al instante. Cada cambio que guardes se recarga solo.

> Si `npm install` deja versiones desalineadas, corre `npx expo install --fix` para que Expo ajuste las versiones de las dependencias nativas a tu SDK.

## Generar un APK (opcional, más adelante)

Expo Go es para desarrollar/probar. Si luego quieres un **APK instalable**:

```bash
npm install -g eas-cli
eas build -p android --profile preview
```

EAS compila en la nube y te da un `.apk` para descargar. (Requiere cuenta gratuita de Expo.)

## Qué hace

**Cursos.** Cada curso tiene evaluaciones con nombre, tipo (Examen, Proyecto, Práctica…), semana, peso (%) y nota. Ingresas las notas conforme te las devuelven.

**Control de notas ponderadas** (peso × nota, como tu Excel):
- **Nota actual**: promedio sobre lo ya evaluado.
- **Estado**: Aprobado asegurado · En juego · Ya no alcanza.
- **Máx./Mín. posible** según lo que saques en lo pendiente.
- **Para aprobar**: cuánto necesitas en promedio en lo que falta.
- **Próxima evaluación**: nota mínima que necesitas en la siguiente para seguir en carrera.

**Cronograma.** Todas las evaluaciones de todos los cursos, por semana del semestre.

**Escala configurable** (global y por curso). Por defecto 0–20 aprobando con 11; los cursos en otra escala (ej. 0–7 aprobando con 4) activan "escala propia".

**Redondeo de nota final** (Ajustes global, y también por curso). Si tu universidad redondea la nota final (10.65 → 11), déjalo activado; desactívalo para el promedio exacto. Cada curso con escala propia puede tener su propio switch de redondeo, que anula el global.

**Fechas del curso.** Cada curso puede tener fecha de inicio y fin. La fecha de cada evaluación se calcula desde el inicio + su número de semana.

**Notificaciones.** Activándolas en Ajustes, la app te avisa X días antes (configurable, por defecto 2) de cada evaluación pendiente que tenga semana asignada en un curso con fecha de inicio.

**Reordenar evaluaciones.** Mantén presionado el asa (≡) de una fila y arrástrala para cambiar el orden.

**Respaldo.** Exporta/importa todos tus datos como JSON desde Ajustes.

## Primer uso

La app arranca **vacía** (sin datos de ejemplo). En la primera apertura muestra un **tutorial de bienvenida** de unas pocas pantallas que explica cómo usarla. Puedes volver a verlo desde **Ajustes → Ayuda → Ver tutorial de nuevo**.

## Estructura

```
App.js                  Raíz: navegación por pestañas
app.json                Config de Expo (nombre, ícono, splash, package)
assets/                 Ícono, adaptive-icon y splash
src/
  lib/
    calc.js             Lógica de notas (pura)
    id.js               Generador de IDs + estado inicial vacío
    store.js            Estado global + persistencia AsyncStorage + export/import
  theme.js              Colores y tokens
  components/ui.js          Card, Badge, Progress, PickerModal
  components/Onboarding.js  Tutorial de bienvenida
  screens/
    CoursesScreen.js
    CourseDetailScreen.js
    ScheduleScreen.js
    SettingsScreen.js
```
