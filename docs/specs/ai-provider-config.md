# Feature Implementation Spec: Configuración del proveedor de IA por entorno

## Source Feature

- `id`: `ai-provider-config`
- `area`: `ai`
- `depends_on`: `bootstrap-stack` (satisfecha; estado `accepted`)
- `status`: `not_started` (estado al planificar)
- `source`: `feature_list.json`

## Goal

Crear una frontera server-only para DevExpert Inference, compatible con el SDK OpenAI, que lea base URL y modelos desde variables de entorno. El cliente no se construye ni llama cuando falta la clave; errores de configuración, autenticación, cupo o red se convierten en degradación tipada y segura para chatbot/try-on posteriores.

El build y el arranque funcionan sin `DEVEXPERT_API_KEY`; clave, headers y cuerpos de error nunca llegan a navegador, logs ni respuestas públicas. Esta feature entrega configuración/adapter, no chatbot ni prueba virtual.

## Non-Goals

- No crear rutas API, server actions, componentes, páginas ni UI de chatbot/try-on.
- No enviar peticiones reales, resolver recomendaciones, editar imágenes, inyectar catálogo, implementar auth/conversaciones/fotos/RAG/embeddings ni controlar consumo más allá de mapear errores.
- No añadir otro proveedor concreto ni selector UI; el seam es la base URL compatible del adapter DevExpert.
- No versionar clave, `.env`, logs con secretos ni variables sensibles `NEXT_PUBLIC_*`.

## Job Story

Cuando ejecuto la tienda con o sin mi clave de AI Expert, quiero que el servidor seleccione endpoint/modelo desde env y devuelva un estado controlado si la IA no está disponible, para activar features sin romper la app ni filtrar credenciales.

## Users And Permissions

- **Proceso servidor** (route handler, server action o servicio futuro): puede leer `process.env` y usar el adapter, recibiendo `ok` o `degraded`.
- **Navegador**: nunca importa el módulo server-only ni recibe clave, configuración privada, headers o cuerpo crudo.
- **Desarrollador local**: puede dejar la clave vacía y ejecutar el gate; una clave real vive en `.env` ignorado, nunca en Git.

## Acceptance Scenarios

### Scenario 1: Defaults y overrides de entorno

Given un entorno servidor sin `DEVEXPERT_API_KEY`
When se lee la configuración
Then no lanza excepción, usa `https://inference.devexpert.io/v1` y los modelos
`chat`, `chat-pro`, `image-edit` y `embedding` para chat, chat avanzado, imagen y
embeddings. El objeto público no contiene la clave.

Given valores no vacíos para `DEVEXPERT_BASE_URL`,
`DEVEXPERT_CHAT_MODEL`, `DEVEXPERT_CHAT_PRO_MODEL`, `DEVEXPERT_IMAGE_MODEL` y
`DEVEXPERT_EMBEDDING_MODEL`
When se lee la configuración
Then se usan esos valores, normalizando la barra final, sin endpoint/modelo
hardcodeado en consumidores.

### Scenario 2: Cliente compatible solo en servidor

Given una clave no vacía y una base URL HTTP(S) válida
When un servicio servidor solicita el provider
Then se crea en memoria un cliente OpenAI-compatible con `apiKey`/`baseURL`, sin
petición durante construcción, y se exponen solo los modelos públicos.

Given un componente cliente intenta importar la configuración
When Next.js compila
Then la frontera `server-only` impide la importación o falla explícitamente, sin
incluir el secreto en el bundle.

### Scenario 3: Sin clave degrada sin romper

Given `DEVEXPERT_API_KEY` ausente, vacío o con espacios
When un consumidor llama al método común de ejecución
Then no se instancia cliente ni se invoca la operación y se devuelve
`{ ok: false, degraded: true, code: "missing_api_key", message: <seguro> }`.
Build, proceso y home siguen funcionando.

### Scenario 4: Errores mapeados con respuesta segura

Given una operación que falla con un error simulado
When el adapter lo clasifica
Then aplica esta tabla, sin propagar body, prompt, headers ni clave:

| Señal | Código | Resultado |
| --- | --- | --- |
| HTTP 429 o `insufficient_quota` | `quota_exhausted` | Mensaje de cupo semanal; sin retry automático |
| HTTP 401/403 | `invalid_api_key` | Mensaje de clave inválida |
| HTTP 5xx, timeout o red | `provider_unavailable` | Mensaje temporal de indisponibilidad |
| URL/modelo inválido | `invalid_configuration` | Mensaje de configuración inválida |
| Otro error | `provider_error` | Mensaje genérico seguro |

Todo resultado fallido es `degraded` con mensaje apto para usuario; no se
interpolan errores crudos ni se reintenta automáticamente.

### Scenario 5: Sin alcance de producto

Given la feature implementada
When se ejecutan tests y build sin clave ni red
Then no hay llamadas a DevExpert, no se añaden rutas/UI de chatbot o try-on y
`./init.sh` termina correctamente.

## Repository Research

### Files Inspected

- `AGENTS.md`, `PROGRESS.md`, `feature_list.json` — Node 22/pnpm 10.18.3, gate,
  dependencia y contrato de esta feature; está `not_started`.
- `docs/technical-discovery.md` — DevExpert Inference, URL `/v1`,
  `DEVEXPERT_API_KEY`, modelos y manejo requerido de 429.
- `docs/build-brief.md`, `docs/domain-model.md`, `docs/risks-and-open-questions.md`
  — funciones futuras, privacidad de fotos, cupo y degradación sin clave.
- `ARCHITECTURE.md`, `CONSTRAINTS.md`, `.env.example`, `.gitignore` y
  `scripts/db-setup.mjs` — capas, reglas de secretos, env ya documentado y
  creación local de `.env` ignorado.
- `package.json`, `src/app/*`, `prisma/*` — app/catalogo bootstrap operativos,
  pero sin OpenAI, `server-only`, adapter, endpoints o tests AI.

### Existing Patterns To Follow

- Mantener TypeScript estricto, Node 22.23.2, pnpm fijado y el gate de `init.sh`
  (`db:setup`, `db:verify`, lint, typecheck, test, build).
- Mantener app local sin servicios externos; leer env en runtime de servidor y no
  realizar llamadas durante build.
- Usar `DEVEXPERT_API_KEY` y cliente OpenAI-compatible con `baseURL`; no llamar a
  OpenAI directamente.

### Current Gaps

- No existe contrato parser/defaults para base URL y modelos.
- No existe boundary server-only, cliente ni resultado de degradación común.
- No hay tests para clave ausente, overrides, 401/403/429/5xx/red o no-fuga.

## Technical Approach

### Contrato de entorno

Añadir a `.env.example` sin crear una clave real:

| Variable | Default | Sensibilidad |
| --- | --- | --- |
| `DEVEXPERT_API_KEY` | vacío (desactivada) | secreto, solo servidor |
| `DEVEXPERT_BASE_URL` | `https://inference.devexpert.io/v1` | configuración servidor |
| `DEVEXPERT_CHAT_MODEL` | `chat` | configuración |
| `DEVEXPERT_CHAT_PRO_MODEL` | `chat-pro` | configuración |
| `DEVEXPERT_IMAGE_MODEL` | `image-edit` | configuración |
| `DEVEXPERT_EMBEDDING_MODEL` | `embedding` | configuración |

`readAiConfig(env = process.env)` debe aceptar env inyectado, recortar espacios,
usar defaults en valores opcionales vacíos y validar `BASE_URL` como URL absoluta
HTTP(S). Un valor inválido devuelve estado degradado, no excepción. Nunca exportar
ni imprimir la clave.

### Boundary y resultado

Crear `src/lib/server/ai/config.ts` con `import "server-only"`; debe devolver
base URL, modelos y estado sin secrets. Crear `src/lib/server/ai/provider.ts`
con construcción condicionada de `OpenAI` y método genérico `run<T>(operation)`:

```ts
type AiResult<T> =
  | { ok: true; value: T }
  | { ok: false; degraded: true; code: AiDegradationCode; message: string };
```

`run` no llama la operación si falta clave/configuración. Con clave, la operación
recibe el cliente server-only y modelos; el adapter captura errores, usa mensajes
constantes en español y registra como máximo código/status sanitizado. Nunca
registra payloads, headers, URL con credenciales o body; no añade retries.

### Pruebas y consumidores

Crear tests de config/provider con env, operaciones y errores fake; no usar red ni
clave real. Comprobar que serializar configuración/resultado no incluye la clave.
`chatbot-conversation` y `tryon-result` usarán esta frontera desde servidor; no
accederán a `process.env`/SDK desde UI. Esta feature no crea esos productos.

## Expected File Changes

- `src/lib/server/ai/config.ts` — parser/defaults server-only sin clave pública.
- `src/lib/server/ai/provider.ts` — cliente OpenAI-compatible, `AiResult` y
  clasificación; sin endpoints de producto.
- `src/lib/server/ai/config.test.ts`, `provider.test.ts` — tests sin red de
  defaults, overrides, no-key, errores y no-fuga.
- `.env.example` — documentar base URL/modelos, manteniendo clave vacía; `.env`
  seguirá local/ignorado y lo prepara `db:setup`.
- `package.json`, `pnpm-lock.yaml` — añadir `openai` y `server-only` compatibles
  con Node 22, conservando el gate.
- `ARCHITECTURE.md`, `CONSTRAINTS.md`, `docs/technical-discovery.md` — documentar
  boundary, contrato, errores y regla server-only.
- `PROGRESS.md`/`feature_list.json` — evidencia tras verificar, sin cambiar estado.
- No modificar `src/app` ni implementar chatbot/try-on, rutas o UI.

## Visual Design Impact

- UI involved: no.
- Design source: `DESIGN.md` — no aplicable; no se añaden pantallas ni estados.
- Screens or states affected: ninguno.
- New design artifact required: no.

## Durable Documentation Impact

- `ARCHITECTURE.md`: update — capa adapter AI server-only, dependencias y ausencia
  de llamadas en build.
- `CONSTRAINTS.md`: update — claves fuera de cliente/logs/Git, env para
  endpoint/modelos, degradación sin throw y no `NEXT_PUBLIC` secrets.
- `AGENTS.md`: not needed — no cambia workflow, runtime ni gate.
- `docs/technical-discovery.md`: update — nombres/defaults env y códigos; DevExpert
  es el único adapter de este MVP.
- `PROGRESS.md`/`feature_list.json`: update solo tras implementación/evidencia; el
  planner no altera el estado.

## Implementation Plan

1. Añadir dependencias, contrato `.env.example` y parser server-only con defaults,
   validación y tipos sin clave pública.
2. Implementar adapter OpenAI-compatible con `run<T>`, clasificación segura y
   mensajes constantes, sin llamadas en import/build.
3. Añadir tests fake de configuración, boundary, degradación y no-fuga; ejecutar
   gate completo sin clave ni red.
4. Actualizar docs/evidencia y dejar interfaz para chatbot/try-on, sin implementar
   esos productos.

## Implementation Tasks

- [ ] Añadir variables de base URL/modelos a `.env.example`, sin secretos.
- [ ] Añadir `openai`/`server-only` y actualizar lockfile.
- [ ] Crear `config.ts` con defaults, trim, validación y estado sin clave.
- [ ] Crear `provider.ts` con `AiResult`, clasificación 401/403/429/5xx/red y
  mensajes seguros sin retries.
- [ ] Añadir tests sin red para defaults, overrides, no-key, config inválida,
  errores y secretos serializados.
- [ ] Comprobar que no hay imports desde UI, `NEXT_PUBLIC` para la clave ni red en
  build/tests.
- [ ] Actualizar docs/evidencia; mantener la feature sin aceptar hasta validación.

## Verification Plan

- `pnpm install --frozen-lockfile` — dependencias reproducibles.
- `pnpm test -- src/lib/server/ai` — contrato, no-key, boundary, degradación y
  no-fuga; sin red.
- `pnpm lint` y `pnpm typecheck` — imports server-only y tipos correctos.
- `pnpm build` con clave vacía — sin llamadas externas ni excepción de env.
- `./init.sh` — setup/verify y gate completo, sin procesos persistentes.
- `pnpm dev` sin clave — home responde y no filtra env; no se necesita E2E porque
  esta feature no añade ruta UI/API.
- `rg` estático — no `NEXT_PUBLIC_DEVEXPERT_API_KEY`, adapter fuera de cliente ni
  valores de clave en logs/fixtures/respuestas.

## Evidence To Capture

- Salida y nombres de tests, `lint`, `typecheck`, `build` e `./init.sh` sin clave.
- Test de overrides con base URL/modelos custom y configuración sin clave.
- Test de 401/403/429/5xx/red con mensajes seguros y sin retry.
- Git demuestra `.env`/secretos sin seguimiento; no hubo llamada real a red.
- Evidencia en `feature_list.json`/`PROGRESS.md` solo después de implementar y
  validar, sin aceptación prematura.

## Validator Checklist

- [ ] Base URL y modelos cambian por env; defaults DevExpert y sin hardcode en consumidores.
- [ ] `DEVEXPERT_API_KEY` es opcional, server-only y no aparece en bundle, logs,
  resultados serializados ni Git.
- [ ] Sin clave/config inválida, adapter devuelve degradación sin cliente, red o
  rotura de build/app.
- [ ] 401/403, 429/cupo, 5xx/red y desconocidos devuelven códigos/mensajes seguros
  sin body crudo ni retries.
- [ ] Tests fake, `./init.sh` y gate pasan sin clave; no se necesita E2E.
- [ ] No se añadieron chatbot, try-on, UI, rutas ni persistencia de producto.
- [ ] Docs/evidencia actualizados y estado solo por validación independiente.
