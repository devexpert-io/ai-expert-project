# Instrucciones para agentes

Este repositorio contiene una web app responsive de e-commerce de ropa (tienda) con catálogo, carrito, checkout, pedidos y funciones de IA (chatbot y prueba virtual).

## Leer primero

- `CONTEXT.md` — lenguaje de dominio (glosario).
- `docs/build-brief.md` — problema, objetivos y slice del MVP.
- `docs/domain-model.md` — entidades, relaciones, estados y escenarios.
- `docs/risks-and-open-questions.md` — riesgos y preguntas abiertas.

Leer docs opcionales solo cuando apliquen:

- `docs/technical-discovery.md` — al tocar stack, integraciones, IA, auth, despliegue u operaciones.
- `DESIGN.md` — al tocar UI, estilos o componentes visuales.

## Flujo de arranque

Antes de escribir código:

1. Confirmar el directorio con `pwd`.
2. Leer `PROGRESS.md` para ver el estado verificado y el siguiente paso.
3. Leer `feature_list.json` y elegir la primera feature lista sin terminar en orden de lista.
4. Ejecutar `./init.sh`.
5. Si la verificación base falla, arreglar la base antes de añadir trabajo nuevo.

## Reglas de trabajo

- Trabajar en una feature a la vez.
- No marcar una feature como completa solo porque se añadió código.
- Mantener los cambios dentro del alcance de la feature elegida salvo que un bloqueo requiera un arreglo de soporte acotado.
- No cambiar en silencio las reglas de verificación durante la implementación.
- Actualizar los artefactos durables del repo en lugar de depender de resúmenes de chat.

## Artefactos requeridos

- `feature_list.json`: fuente de verdad del estado de features.
- `PROGRESS.md`: estado verificado actual y log ligero de sesión.
- `init.sh`: ruta estándar de arranque y verificación.

## Definición de hecho (Definition of Done)

Una feature está hecha solo cuando se cumple todo:

- el comportamiento objetivo está implementado,
- la verificación requerida se ejecutó de verdad,
- la evidencia está registrada en `feature_list.json` o `PROGRESS.md`,
- el repo sigue arrancando desde la ruta estándar,
- los docs relevantes se actualizaron si cambió comportamiento, reglas de dominio, API o verificación.

## Fin de sesión

Antes de terminar una sesión:

1. Actualizar `PROGRESS.md`.
2. Actualizar `feature_list.json`.
3. Registrar riesgos o bloqueos no resueltos.
4. Dejar el repo limpio para que la siguiente sesión ejecute `./init.sh` de inmediato.
