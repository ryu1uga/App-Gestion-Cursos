# NotaFlow · Control de Notas (React Native + Expo)

App móvil para llevar tus cursos: el horario semanal de clases, el cronograma de
evaluaciones y el control de notas ponderadas — calculando cuánto necesitas para aprobar.

Hecha con **React Native + Expo**. Corre en tu celular con **Expo Go**. Los datos se
guardan en el dispositivo (AsyncStorage); no sale nada a internet.

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

> Si `npm install` deja versiones desalineadas, corre `npx expo install --fix` para que
> Expo ajuste las versiones de las dependencias nativas a tu SDK.

## Generar un APK (opcional, más adelante)

Expo Go es para desarrollar/probar. Si luego quieres un **APK instalable**:

```bash
npm install -g eas-cli
eas build -p android --profile preview
```

EAS compila en la nube y te da un `.apk` para descargar. (Requiere cuenta gratuita de Expo.)

## Qué hace

**Cursos.** Cada curso tiene evaluaciones con nombre, tipo (Examen, Proyecto, Práctica…
o el que escribas tú), semana, día exacto, peso (%) y nota. Ingresas las notas conforme
te las devuelven. Toca una evaluación para abrir su ficha y editarla completa.

**Control de notas ponderadas** (peso × nota, como tu Excel):

- **Nota actual**: promedio sobre lo ya evaluado.
- **Estado**: Aprobado asegurado · Aún es posible · Ya no es posible.
- **Máx./Mín. posible** según lo que saques en lo pendiente.
- **Para aprobar**: cuánto necesitas en promedio en lo que falta.
- **Próxima evaluación**: nota mínima que necesitas en la siguiente para seguir en carrera.

**Horario de clases.** En cada curso registras en qué días te toca, de qué hora a qué hora,
si es **presencial o virtual**, qué bloque es (Teoría, Laboratorio…) y el aula. La pestaña
**Horario** junta las clases de todos tus cursos: en vertical las ves día por día, y al
**girar el teléfono** aparece la semana completa en rejilla, con la hora actual marcada.
Arriba siempre está tu próxima clase y cuánto falta para ella.

**Cronograma.** Todas las evaluaciones de todos los cursos, por semana del semestre o en
vista de calendario mensual.

**Escala configurable** (global y por curso). Por defecto 0–20 aprobando con 11; los cursos
en otra escala (ej. 0–7 aprobando con 4) activan "escala propia".

**Redondeo de nota final** (Ajustes global, y también por curso). Si tu universidad redondea
la nota final (10.65 → 11), déjalo activado; desactívalo para el promedio exacto. Cada curso
con escala propia puede tener su propio switch de redondeo, que anula el global.

**Fechas del curso.** Cada curso puede tener fecha de inicio y fin. La fecha de cada
evaluación se calcula desde el inicio + su número de semana, o la fijas directamente y se
deduce la semana sola.

**Notificaciones.** Activándolas en Ajustes, la app te avisa X días antes (por defecto 2)
de cada evaluación pendiente con fecha, a la **hora que elijas**. El aviso llega a más
tardar el domingo previo a la semana de la evaluación; los "días antes" solo pueden
adelantarlo.

**Reordenar evaluaciones.** Mantén presionado el asa (≡) de una fila y arrástrala para
cambiar el orden.

**Respaldo compatible con la app de escritorio.** Exporta tus datos como JSON desde Ajustes:
**Descargar** los guarda en la carpeta que elijas, **Compartir** los manda por el menú del
sistema (WhatsApp, Drive…) y **Importar** los vuelve a cargar. Es el mismo formato que usa
NotaFlow en la computadora, así que puedes mover tus cursos entre ambas.

## Primer uso

La app arranca **vacía** (sin datos de ejemplo). En la primera apertura muestra un
**tutorial de bienvenida** de unas pocas pantallas que explica cómo usarla. Puedes volver a
verlo desde **Ajustes → Ayuda → Ver tutorial de nuevo**.

## Estructura

```
App.js                  Raíz: pestañas Cursos · Cronograma · Horario · Ajustes
app.json                Config de Expo (nombre, ícono, splash, package)
eas.json                Perfiles de build de EAS
assets/                 Ícono, adaptive-icon y splash
src/
  theme.js              Colores y tokens (compartido con la app de escritorio)
  lib/
    calc.js             Lógica de notas (pura) — compartida
    classes.js          Horario: días, modalidad, rejilla semanal — compartida
    evalTypes.js        Tipos de evaluación — compartida
    id.js               Generador de IDs + estado inicial vacío — compartida
    notify.js           Fechas de evaluaciones y notificaciones locales
    store.js            Estado global + persistencia AsyncStorage + export/import
  components/
    ui.js               Card, Badge, Progress, NumField, Icon, InfoButton
    Calendar.js         Calendario mensual
    Onboarding.js       Tutorial de bienvenida
  screens/
    CoursesScreen.js
    CourseDetailScreen.js
    ScheduleScreen.js
    TimetableScreen.js
    SettingsScreen.js
```

## Las dos apps

NotaFlow existe también para computadora, en
[Notaflow-Desktop](../Notaflow-Desktop) (Electron + React). Las dos guardan y leen el
**mismo JSON de respaldo**, así que puedes exportar de una e importar en la otra.

Para que eso siga funcionando, estos archivos son **idénticos en los dos repos** y se
copian a mano cuando cambian:

| Aquí | En el escritorio |
| --- | --- |
| `src/lib/calc.js` | `renderer/src/lib/calc.js` |
| `src/lib/classes.js` | `renderer/src/lib/classes.js` |
| `src/lib/evalTypes.js` | `renderer/src/lib/evalTypes.js` |
| `src/lib/id.js` | `renderer/src/lib/id.js` |
| `src/theme.js` | `renderer/src/theme.js` |

Los campos nuevos se leen siempre con valor por defecto (`course.sessions ?? []`), así que
un respaldo hecho con una versión anterior se abre sin migrar nada.
