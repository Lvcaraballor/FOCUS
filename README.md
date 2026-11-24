# FOCUS

> **Estado del proyecto:** prototipo funcional en desarrollo. La persistencia actual es local; Supabase y el despliegue integrado en Vercel están previstos, pero todavía no están configurados.

## 1. Nombre y descripción

**FOCUS** es un organizador web de actividades académicas y personales que ayuda a planificar el día, priorizar pendientes y reservar tiempo para concentrarse y descansar.

## 2. Problema

Estudiantes y jóvenes suelen gestionar clases, entregas, proyectos y responsabilidades personales en herramientas separadas o de forma improvisada. Esto dificulta identificar qué es urgente, calcular cuánto tiempo requiere cada actividad y dejar espacio para pausas. FOCUS busca reducir esa fricción con una vista diaria sencilla y un plan que se adapta a la disponibilidad indicada.

## 3. Objetivo general

Desarrollar una aplicación accesible y clara para registrar responsabilidades, visualizar el progreso y generar —con ayuda de IA— horarios diarios realistas que consideren prioridades, fechas límite, duración estimada, disponibilidad y descansos.

## 4. Público objetivo

- Estudiantes de secundaria, bachillerato y educación superior.
- Jóvenes que combinan responsabilidades académicas, proyectos y actividades personales.
- Personas que buscan una forma visual y simple de organizar su tiempo y concentración.

## 5. Funcionalidades principales

- Dashboard con tareas pendientes, tiempo enfocado y actividades completadas.
- Crear, editar, buscar, filtrar, completar y eliminar tareas.
- Registro de descripción, categoría (universidad, trabajo o vida personal), fecha límite, hora sugerida, duración, prioridad y proyecto asociado.
- Disponibilidad diaria configurable.
- Planificador con IA que considera fechas límite, prioridades, duración, disponibilidad y pausas.
- Validación de horarios para impedir solapamientos, duraciones incorrectas y descansos insuficientes.
- Indicación de actividades que no caben en el tiempo disponible, sin forzar un horario poco realista.
- Acción para reorganizar tareas vencidas o pendientes cuando el plan original ya no funciona.
- Vista semanal y temporizador de concentración de 25 minutos con descansos de 5 minutos.
- Calendario navegable semanal y mensual, y tablero Kanban sincronizado con los estados de las tareas.
- Seguimiento de hábitos con metas semanales y rachas, notas locales, bloques de tiempo sin solapamientos, objetivos con progreso y proyectos con tareas asociadas.
- Registro local de gastos e ingresos en USD, y estadísticas derivadas de tareas, hábitos y concentración.
- Asistente de organización con IA para recomendaciones y modo de emergencia para reorganizar pendientes.
- Recordatorios locales para las tareas y bloques con horario mientras la página está abierta y las notificaciones del navegador están autorizadas. El usuario elige el aviso con 5, 15 o 30 minutos de anticipación.
- Interfaz adaptable a escritorio, tablet y celular.

Las tareas, la disponibilidad y los datos de las nuevas secciones se guardan en `localStorage` del navegador. Las notas y los gastos permanecen en ese navegador; no hay cuentas ni sincronización entre dispositivos. Los recordatorios solo se ejecutan mientras la página permanece abierta y autorizada por el navegador. Los importes se expresan en USD.

## 6. Tecnologías utilizadas

- HTML semántico y CSS responsivo.
- JavaScript nativo en el navegador; no se usa un framework de frontend.
- Node.js 20 o superior y módulos nativos para el servidor HTTP.
- API compatible con OpenAI Chat Completions para la planificación con IA.
- `node:test` para pruebas unitarias; no hay dependencias de npm de terceros.

## 7. Arquitectura general

```text
Navegador
  index.html + styles.css + app.js + features.js
  ├── Tareas, disponibilidad, temporizador y vistas de organización
  ├── localStorage para tareas y datos privados de cada sección
  ├── POST /api/plan
  └── POST /api/assistant
          |
Servidor Node.js (server.js)
  ├── Sirve los archivos estáticos
  ├── Mantiene la clave del proveedor en el entorno del servidor
  └── planner.js: valida solicitudes, construye prompts y valida respuestas
          |
Proveedor de IA compatible con Chat Completions
```

El servidor no almacena las solicitudes del planificador ni del asistente. Antes de enviar contexto al proveedor, la interfaz solicita confirmación. La clave de IA nunca se entrega al navegador.

## 8. Estructura del proyecto

```text
.
├── .env.example          # Nombres y valores por defecto de configuración
├── .gitignore            # Excluye secretos y dependencias locales
├── AGENTS.md             # Guía permanente para agentes de programación
├── README.md             # Documentación del proyecto
├── app.js                # Interacciones y estado de la interfaz
├── build-pages.js        # Genera la publicación estática en docs/
├── features.js           # Calendario, Kanban y módulos locales de organización
├── docs/                 # Salida estática para publicar con GitHub Pages
├── focus-video-mockup.mp4 # Video ilustrativo de la experiencia de FOCUS (30 s)
├── index.html            # Estructura de la aplicación
├── package.json          # Scripts y requisito de Node.js
├── planner.js            # Validación, prompt y validación del plan generado
├── server.js             # Servidor local y endpoints POST /api/plan y /api/assistant
├── styles.css            # Estilos, estados y diseño responsivo
└── test/
    ├── assistant.test.js # Validación y límites del asistente de IA
    └── planner.test.js   # Pruebas de entrada, prompts y horarios
```

## 9. Instalación y ejecución local

Requisitos: Node.js 20 o superior y npm.

```bash
git clone <URL_DEL_REPOSITORIO>
cd FOCUS-
npm start
```

Abre <http://127.0.0.1:3000>. No se requiere `npm install`: el proyecto no declara dependencias externas.

Para ejecutar las pruebas:

```bash
npm test
```

## 10. Publicación estática con GitHub Pages

Genera el sitio publicable en `docs/` con:

```bash
npm run build:pages
```

En GitHub, abre **Settings → Pages**, elige **Deploy from a branch**, selecciona la rama `main` y la carpeta `/docs`, y guarda. La aplicación estará disponible en la URL que GitHub Pages indique. Si publicas desde otra rama, selecciónala en esa configuración.

Esta salida es estática: tareas, disponibilidad y módulos locales funcionan en el navegador y se guardan en `localStorage`. GitHub Pages no ejecuta `server.js` ni los endpoints `/api/plan` y `/api/assistant`; por eso la planificación, el asistente y el modo de emergencia con IA se deshabilitan en esa publicación. Los datos no se envían al intentar usar esas acciones. Para IA se necesita un servidor aparte con esos endpoints y una clave privada; no se debe poner la clave en GitHub Pages.

Vuelve a ejecutar el comando después de cambiar archivos del cliente para actualizar `docs/`.

## 11. Variables de entorno

`.env.example` es una referencia de configuración; Node.js no carga automáticamente archivos `.env`. Define las variables en el entorno de ejecución o mediante el gestor de secretos de tu plataforma.

| Variable | Obligatoria | Valor por defecto | Uso |
| --- | --- | --- | --- |
| `OPENAI_API_KEY` | Para generar planes | — | Credencial del proveedor, solo en el servidor |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | Modelo solicitado |
| `OPENAI_API_URL` | No | `https://api.openai.com/v1/chat/completions` | Endpoint compatible con Chat Completions |
| `PORT` | No | `3000` | Puerto del servidor local |
| `HOST` | No | `127.0.0.1` | Interfaz de red del servidor |

Ejemplo en macOS/Linux:

```bash
export OPENAI_API_KEY="tu_clave"
npm start
```

Ejemplo en PowerShell:

```powershell
$env:OPENAI_API_KEY = "tu_clave"
npm start
```

No escribas claves reales en archivos versionados, en `app.js`, en el HTML ni en solicitudes del navegador. Si la clave no está configurada, las páginas siguen disponibles y el endpoint de planificación devuelve un error explícito.

## 12. Integración prevista con Supabase

Supabase **todavía no está integrado**. La aplicación usa almacenamiento local, no tiene autenticación, base de datos remota ni sincronización multi-dispositivo.

Una integración futura debería contemplar:

1. Supabase Auth para identidad y sesiones.
2. PostgreSQL para perfiles, tareas, disponibilidad y sesiones de concentración.
3. Una columna `user_id` y políticas RLS por usuario en todas las tablas con datos privados.
4. Migraciones versionadas y pruebas para el esquema y las políticas.
5. Migrar gradualmente desde `localStorage`, con una estrategia explícita de importación y manejo de errores.
6. Usar la clave pública/anon solo según el modelo de seguridad de Supabase y RLS. La clave `service_role` debe permanecer exclusivamente en servicios confiables del servidor y nunca exponerse al cliente.

No se deben añadir el SDK ni credenciales de Supabase hasta que la integración se implemente y se documenten sus variables de entorno.

## 13. Integración con inteligencia artificial

El navegador envía las tareas pendientes, sus fechas límite y la disponibilidad al endpoint local `POST /api/plan`. `server.js` valida la solicitud y delega en `planner.js`, que crea instrucciones en español para que el modelo:

- Priorice entregas próximas o vencidas sin modificar sus fechas límite.
- Considere prioridad, duración, horario disponible y descansos.
- Evite solapamientos y no reduzca duraciones para forzar actividades en el horario.
- Devuelva una respuesta JSON con tareas planificadas y tareas que no caben.

Antes de devolver el resultado al cliente, el servidor valida identificadores, duraciones, límites de disponibilidad, descansos y que cada tarea esté planificada o explícitamente pendiente de ubicar. La interfaz permite volver a solicitar un plan para pendientes y tareas vencidas.

La planificación requiere `OPENAI_API_KEY`. Si falta o el proveedor falla, se muestra el error; no se genera un plan simulado. Los nombres, descripciones, categorías, prioridades, fechas límite, duraciones y disponibilidad se envían al proveedor solo tras la confirmación del usuario.

El asistente de recomendaciones utiliza `POST /api/assistant` y la misma clave del servidor. Después de pedir confirmación, envía la pregunta, hasta seis mensajes previos, el horario disponible, nombres y fechas objetivo de hasta 20 proyectos, y hasta 30 tareas pendientes con sus títulos, categorías, prioridades, fechas límite, duración y estado. No envía descripciones, notas ni gastos. La respuesta se limita a texto breve y consejos: no puede modificar tareas ni calendarios. El modo de emergencia vuelve a usar el planificador validado de `POST /api/plan`; no cambia fechas límite ni tareas completadas. Sin `OPENAI_API_KEY`, ambos servicios muestran un error explícito.

## 14. Despliegue en Vercel

El despliegue completo en Vercel **está pendiente**. El proyecto actual usa `server.js` como servidor Node persistente para desarrollo local; Vercel espera funciones serverless para endpoints como `/api/plan` y `/api/assistant`. No hay todavía `vercel.json` ni funciones serverless.

Para desplegar la aplicación completa:

1. Crear funciones serverless compatibles con Vercel para `/api/plan` y `/api/assistant`, reutilizando la validación y los prompts de `planner.js`.
2. Configurar el proyecto en Vercel para servir los archivos estáticos y enrutar ambos endpoints a sus funciones.
3. Añadir `OPENAI_API_KEY` y, si corresponde, `OPENAI_MODEL` y `OPENAI_API_URL` en las variables de entorno de Vercel para los entornos necesarios.
4. No definir secretos con prefijos que los expongan al navegador (por ejemplo, variables públicas del frontend).
5. Probar la página, la función, validación de errores y generación con una credencial válida antes de promover a producción.

Hasta completar esa adaptación, `npm start` es el método de ejecución soportado. Un despliegue estático por sí solo no incluye el endpoint de IA.

## 15. Estado actual y funcionalidades pendientes

**Implementado:** dashboard, tareas CRUD, fechas límite y prioridades, disponibilidad diaria, persistencia local, temporizador, calendarios semanal y mensual, tablero Kanban, hábitos, notas, bloques de tiempo con validación de solapamientos, gastos e ingresos locales, estadísticas de actividad, objetivos, proyectos, recordatorios en primer plano, recomendaciones con IA sujetas a confirmación, endpoint de planificación con validación estricta y modo de emergencia.

**Pendiente:**

- Supabase Auth, base de datos, RLS y sincronización entre dispositivos.
- Función serverless y configuración de despliegue en Vercel.
- Pruebas automatizadas de interfaz y flujos completos en navegador.
- Configuración de disponibilidad por día de la semana y gestión avanzada de calendarios.
- Persistencia remota y sincronización de sesiones de concentración.
- Verificación de las integraciones con IA usando credenciales reales y el proveedor elegido para producción.
- Tratamiento de autenticación, límites de uso y controles de abuso antes de ofrecer el endpoint públicamente.

Las funcionalidades pendientes no deben describirse como disponibles hasta que se implementen y prueben.

## 16. Video de demostración

[Ver o descargar el mockup de FOCUS](./focus-video-mockup.mp4) (MP4, 30 segundos, 1600 × 900).

El video muestra una demostración visual de la interfaz: creación y priorización de tareas, selección de disponibilidad, calendario semanal y temporizador de concentración. El horario que aparece es ilustrativo; el video no ejecuta la aplicación ni demuestra una respuesta real del proveedor de IA. La planificación y el asistente requieren `OPENAI_API_KEY` en el servidor.
