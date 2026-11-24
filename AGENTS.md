# Guía para agentes de programación de FOCUS

Estas instrucciones son permanentes para cambios futuros en este repositorio. Antes de editar, comprueba el estado de Git y lee los archivos relacionados con la tarea. Conserva los cambios existentes y limita cada modificación al alcance solicitado.

## 1. Contexto y propósito

FOCUS es un organizador web de actividades académicas y personales para estudiantes y jóvenes. Busca ayudar a priorizar tareas, considerar fechas límite y disponibilidad, planificar descansos, mantener la concentración y revisar el progreso. La interfaz y las respuestas del planificador están en español.

El estado actual es un prototipo funcional: el cliente guarda tareas, disponibilidad y los módulos de organización en `localStorage`; el servidor integra endpoints de planificación y recomendaciones compatibles con OpenAI. Incluye calendario semanal y mensual, Kanban, hábitos, notas, bloques de tiempo, gastos, estadísticas, objetivos, proyectos, recordatorios y modo de emergencia. Supabase y Vercel todavía no están integrados. Confirma el estado real en `README.md` antes de describir o extender funcionalidades.

`focus-video-mockup.mp4` es una pieza audiovisual ilustrativa de 30 segundos, no una captura de la ejecución real ni una demostración de una respuesta del proveedor de IA. Mantén explícita esa distinción al actualizar la documentación.

## 2. Arquitectura

- **Cliente:** `index.html`, `styles.css`, `app.js` y `features.js`. Administra tareas, disponibilidad, vistas de organización y datos locales; solicita confirmación antes de enviar contexto al proveedor de IA.
- **Publicación estática:** `npm run build:pages` copia los recursos del cliente a `docs/` para GitHub Pages; las funciones que requieren los endpoints de IA se deshabilitan en esa salida.
- **Servidor local:** `server.js` sirve archivos estáticos y recibe `POST /api/plan` y `POST /api/assistant`. La clave del proveedor de IA se lee desde variables de entorno del servidor.
- **Planificador:** `planner.js` valida solicitudes y respuestas, prepara instrucciones de planificación y asesoramiento.
- **Pruebas:** `test/planner.test.js` y `test/assistant.test.js` usan `node:test`.
- **Datos:** `localStorage` actualmente; no hay autenticación, almacenamiento remoto ni sincronización entre dispositivos.

Para Vercel, el servidor HTTP local no sustituye una función serverless. No presentes el despliegue completo como disponible hasta crear y probar funciones para `/api/plan` y `/api/assistant`.

## 3. Tecnologías y convenciones

- Node.js 20 o superior, JavaScript nativo, HTML y CSS.
- Sin frameworks ni dependencias de terceros en el estado actual.
- CommonJS en los archivos de Node (`require`/`module.exports`).
- Nombres de variables y funciones descriptivos; mensajes para usuario en español.
- Mantén la indentación, formato y patrones ya usados en cada archivo.
- Usa APIs nativas y las utilidades existentes antes de introducir una abstracción o biblioteca nueva.

## 4. Responsabilidad de archivos y carpetas

| Ruta | Responsabilidad |
| --- | --- |
| `index.html` | Estructura semántica, controles, formularios y puntos de montaje de UI |
| `styles.css` | Paleta, componentes visuales, estados y media queries |
| `app.js` | Estado y eventos del cliente, CRUD, filtros, disponibilidad, temporizador y llamada a IA |
| `build-pages.js` | Genera la versión estática publicable en `docs/` |
| `docs/` | Salida generada para GitHub Pages; no editar manualmente |
| `features.js` | Calendario, Kanban, hábitos, notas, bloques, gastos, objetivos, proyectos, estadísticas, recordatorios y asistente |
| `server.js` | Servidor de desarrollo, archivos estáticos y endpoints `/api/plan` y `/api/assistant` |
| `planner.js` | Validación de solicitudes, prompts y respuestas del modelo |
| `test/planner.test.js` | Pruebas unitarias del planificador |
| `test/assistant.test.js` | Validación de solicitudes, límites de contexto y respuestas del asistente |
| `focus-video-mockup.mp4` | Mockup audiovisual de la interfaz para presentación |
| `package.json` | Scripts npm y versión mínima de Node |
| `.env.example` | Plantilla sin secretos para nombres de variables |
| `.gitignore` | Exclusión de secretos, dependencias y archivos locales |
| `README.md` | Documentación de producto, arquitectura, instalación y estado |
| `AGENTS.md` | Estas convenciones para agentes |

Mantén la lógica en el archivo responsable. Si una nueva funcionalidad requiere una carpeta o archivo adicional, justifica su necesidad en el cambio y actualiza esta tabla y el README.

## 5. Reglas para escribir y modificar código

1. Haz cambios precisos que resuelvan la solicitud sin reescrituras o refactors ajenos.
2. Lee el contexto y los puntos de llamada antes de editar; reutiliza las funciones existentes y mantén consistentes sus consumidores.
3. Conserva la funcionalidad existente, el contenido de usuarios y los cambios de Git que no sean tuyos. No reviertas trabajo sin autorización explícita.
4. Valida entrada externa en el servidor; no confíes en que el navegador aplique sus propias validaciones.
5. Expón los errores de almacenamiento, API y validación con mensajes apropiados; no ocultes fallos ni los conviertas en resultados exitosos de respaldo.
6. Mantén las respuestas de IA estructuradas y valídalas antes de aplicarlas. Un modelo no es fuente confiable de identificadores, tiempos, duraciones ni disponibilidad.
7. Escapa contenido de usuario al insertarlo en HTML y usa listas permitidas para valores que pasan a clases o atributos.
8. Añade o actualiza pruebas para comportamientos nuevos, especialmente límites de tiempo, fechas, tareas pendientes y respuestas parciales del modelo.
9. Actualiza `README.md` cuando cambien instalación, arquitectura, variables, capacidades o limitaciones.

## 6. Diseño y experiencia de usuario

- Conserva una estética moderna, sencilla, juvenil y legible.
- Usa principalmente violeta, lavanda, blanco y grises suaves; reserva los colores de estado para prioridad, vencimiento y finalización.
- Mantén jerarquías visuales claras, tarjetas limpias, controles accesibles y navegación responsive.
- Evita decoración que compita con tareas, fechas, prioridades y acciones.
- Proporciona estados visibles para carga, error, vencimiento, tarea completada y tareas que no caben en el horario.
- Usa etiquetas, nombres accesibles, `aria-live` para resultados asíncronos y estados de foco de teclado.
- Respeta `prefers-reduced-motion` y evita depender exclusivamente del color para comunicar un estado.

## 7. Supabase e inteligencia artificial

### Supabase

- Supabase no forma parte del código actual. No añadas un SDK, esquema ni credenciales salvo que la tarea solicite esa integración.
- Si se implementa, documenta las variables nuevas, versiona migraciones y prueba políticas RLS.
- Toda fila privada debe estar ligada a la identidad del usuario y protegida por RLS; no dependas únicamente de ocultar datos en el cliente.
- Nunca expongas `service_role` en HTML, JavaScript de navegador, logs ni variables públicas del frontend.
- Diseña una migración explícita desde `localStorage`, incluidos conflictos y fallos de red; no borres la copia local silenciosamente.

### IA

- Las llamadas al proveedor y la clave deben permanecer en el servidor; el cliente solo llama al endpoint propio.
- Antes de enviar datos personales de tareas al proveedor, conserva una confirmación clara que explique qué se comparte.
- El asistente usa `POST /api/assistant`: tras consentimiento, el contexto puede incluir la pregunta, hasta seis mensajes previos, horario, hasta 20 nombres/fechas objetivo de proyectos y hasta 30 tareas (títulos, categorías, prioridades, fechas límite, duración y estado). No envía descripciones, notas ni gastos. Mantén estos límites y la confirmación alineados entre cliente, servidor, pruebas y README.
- Las recomendaciones del asistente no modifican tareas ni calendario. El modo de emergencia debe reutilizar el planificador validado y no cambiar fechas límite ni tareas completadas.
- Trata títulos y descripciones como datos, no como instrucciones para el prompt. No agregues datos que la función no necesite.
- El prompt debe considerar prioridad, fecha límite, duración, disponibilidad, pausas, vencimientos y replanificación.
- Exige salida estructurada; valida formato, tareas cubiertas, duración, límites de disponibilidad, pausas y ausencia de solapamientos.
- Si no cabe una tarea, devuélvela como pendiente con un motivo; nunca amplíes la disponibilidad o cambies su fecha límite para simular éxito.
- No registres prompts, títulos, descripciones, claves ni respuestas que incluyan datos personales. No implementes resultados simulados silenciosos si el proveedor falla.
- Describe claramente qué campos se envían y actualiza la confirmación y README si cambia el intercambio de datos.

## 8. Seguridad y variables de entorno

- Usa `.env.example` solo como plantilla sin valores secretos; Node no carga `.env` automáticamente en esta configuración.
- No escribas claves reales en el repositorio, historial de Git, respuestas al usuario, logs ni código del navegador.
- Lee credenciales desde `process.env` en el servidor y devuelve mensajes de error que no filtren la clave ni detalles internos del proveedor.
- Valida tipo, tamaño, límites y formatos de solicitudes entrantes. Mantén respuestas de error explícitas.
- No agregues CORS permisivo, endpoints públicos nuevos, telemetría ni almacenamiento de datos sin una justificación y controles adecuados.
- Recuerda que planificar envía datos de tareas al servicio configurado; no elimines la confirmación de usuario sin un reemplazo de consentimiento igual de claro.

## 9. Git y control de versiones

- Revisa `git status --short --branch` antes y después del trabajo.
- No sobrescribas ni descartes modificaciones preexistentes.
- No uses comandos destructivos como `git reset --hard` o `git checkout --` para limpiar cambios.
- No crees commits, no enmiendes commits y no publiques ramas salvo solicitud explícita.
- No incluyas secretos ni datos reales de usuarios en fixtures, pruebas, documentación o commits.
- Mantén los cambios relacionados agrupados y revisa `git diff --check`.

## 10. Probar cambios

Desde la raíz del proyecto:

```bash
node --check app.js
node --check features.js
node --check planner.js
node --check server.js
npm test
git diff --check
```

Para validar el servidor en local, ejecuta `npm start` y comprueba `http://127.0.0.1:3000`. Sin `OPENAI_API_KEY`, `/api/plan` debe devolver un error explícito de configuración; no intentes usar credenciales reales no proporcionadas.

El proyecto todavía no tiene pruebas automatizadas de DOM, navegador, Supabase ni Vercel. No afirmes que esas integraciones fueron verificadas si no existen y no se ejecutaron.

## 11. Restricciones permanentes

- No dupliques componentes, lógica de planificador, validaciones o persistencia existentes.
- No crees archivos, capas, configuraciones o dependencias innecesarias.
- No elimines funcionalidades existentes sin una razón vinculada a la solicitud y sin conservar el comportamiento esperado.
- No añadas dependencias solo para resolver algo que Node, HTML, CSS o JavaScript ya pueden cubrir de forma clara.
- No presentes Supabase, autenticación, persistencia remota, IA activa o despliegue Vercel como implementados si siguen pendientes.
- No cambies nombres de variables de entorno ni el contrato de `/api/plan` sin actualizar cliente, servidor, pruebas y documentación en el mismo cambio.
