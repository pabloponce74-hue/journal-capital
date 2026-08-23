# Journal Capital Trading — V1.2.1 (Correcciones de testing real)

**Estado: V1.2.1 lista para testing real en navegador. NO validada.**
V1.1 sigue siendo la BASE ESTABLE (validada en Vercel). V1.2 fue testeada
en móvil y de ahí salieron 3 hallazgos concretos — esta build los corrige.
Nada de esto está confirmado hasta que ustedes lo prueben en el navegador.

## Qué corrige V1.2.1 (basado en el testing real de V1.2)

**1. Selector de temporalidad en Android.** El `<select>` nativo con 18
opciones no se manejaba bien en Android — costaba llegar a las
temporalidades menores. Se reemplazó por chips táctiles (el mismo patrón
que ya usan las emociones en Journal), todos visibles y tocables sin
scroll de un select nativo. Ninguna opción cambió — siguen siendo las
mismas 17 + "Personalizada".

**2. Texto del botón de guardado.** Decía "Guardar análisis en Journal",
pero el análisis nunca crea una operación ni aparece en el Historial de
Journal — solo queda en "Análisis guardados" dentro de Analizar. El texto
ahora dice **"Guardar análisis"**, sin prometer una integración que no
existe todavía (eso queda para una fase futura, no implementada acá).

**3. Detalle de análisis guardado.** Antes, tocar un análisis guardado no
hacía nada. Ahora se expande igual que una operación en el Historial de
Journal, mostrando: fecha, par, cada temporalidad guardada con su captura
y su comentario individual, el contexto/hipótesis general, y el resultado
de IA si existiera. Es de **solo lectura** — no se agregó edición todavía.
También muestra correctamente los análisis viejos guardados en formato
V1.1 (sin romperlos).

**Lo que NO cambió (verificado por diff línea a línea, no solo por
memoria):** confirmé con un diff completo contra V1.2 que el cambio está
100% contenido dentro de `AnalizarScreen` — Journal, Rendimiento,
Plan/Riesgo, Risk Engine, Pattern Engine, Discipline Score, NEXO,
navegación y el selector de temporalidad de Journal quedaron exactamente
iguales. No se conectó IA, voz ni backend.

**Confirmación de compilación:** `npm install && npm run build` real en
este entorno — compiló sin errores (2298 módulos). Sigue sin ser lo mismo
que probarlo en un navegador de verdad.

## Cómo probar V1.2.1 manualmente

1. Andá a **Analizar** en un celular Android (el bug original era ahí).
2. Agregá una temporalidad y confirmá que ahora ves **chips** en vez de un
   select desplegable, y que podés tocar directamente 1M, 45M, 1W, etc.
   sin tener que abrir y scrollear un menú largo.
3. Cargá una captura y un comentario en un par de bloques, más el
   "Contexto / hipótesis" general.
4. Confirmá que el botón dice **"Guardar análisis"** (no "...en Journal").
5. Guardalo. Andá a **Journal** → Historial y confirmá que **no** apareció
   ninguna operación nueva ahí — es el comportamiento esperado.
6. Volvé a Analizar, tocá el análisis recién guardado en "Análisis
   guardados" — debe expandirse mostrando cada temporalidad con su
   captura y comentario, más el contexto general.
7. Si tenés algún análisis viejo guardado desde V1.2 (formato con
   `timeframes`/`imagenes`), confirmá que también se puede expandir sin
   romperse, aunque se vea más simple (sin comentario individual, porque
   ese formato viejo no lo tenía).

## Qué cambia en V1.2 respecto a V1.1

**Único objetivo de esta versión:** el módulo Analizar deja de tener 5
casilleros fijos de temporalidad (4H/1H/15M/5M/1M) y pasa a un sistema
dinámico de bloques.

- Botón **"+ Agregar temporalidad"** en vez de la grilla fija.
- Cada bloque agregado es independiente y tiene: selector de temporalidad
  (17 opciones: 1M, 2M, 3M, 5M, 10M, 15M, 30M, 45M, 1H, 2H, 3H, 4H, 6H, 8H,
  12H, 1D, 1W, o "Personalizada" con texto libre), su propia captura, su
  propio comentario individual, y un botón para eliminarlo.
- Se pueden agregar **varias temporalidades a la vez, incluso repetidas**
  (ej. dos bloques de 15M con capturas y comentarios distintos) — cada uno
  tiene su propio id, sin mezclarse entre sí.
- El campo **"Contexto / hipótesis"** general se mantiene, y sigue siendo
  independiente de los comentarios de cada bloque — es la interpretación
  global, no una más de las individuales.
- Cada bloque guarda su captura y su comentario atados por el mismo id, así
  que si más adelante se conecta NEXO a un análisis real, no hay ambigüedad
  sobre qué comentario corresponde a qué imagen.

**Compatibilidad con lo ya guardado:** si en V1.1 llegaste a guardar algún
análisis de prueba (formato viejo: `timeframes` + `imagenes`), la lista
"Análisis guardados" lo sigue mostrando sin romperse — se detecta el
formato viejo y el nuevo por separado, nada se migra a la fuerza.

**Lo que NO cambió en esta versión (verificado explícitamente):**
Journal, Rendimiento, Plan/Riesgo, Risk Engine, Pattern Engine, Discipline
Score, NEXO, navegación, y el selector de temporalidad de Journal (que usa
una constante distinta y separada de la del módulo Analizar — ambas
conviven en el código sin pisarse). Tampoco se conectó IA, voz ni backend.

**Confirmación de compilación:** corrí `npm install && npm run build` real
sobre este proyecto en este mismo entorno de trabajo y compiló sin errores
(2298 módulos, build de producción generado correctamente). Esto es más
fuerte que una revisión estática de código, pero sigue sin ser lo mismo que
probarlo en un navegador real — no reemplaza el testing manual de ustedes.

## Cómo probar V1.2 manualmente

1. Seguí los pasos A-H de más abajo (instalación y `npm run dev`) para
   levantarla local, o desplegala en un proyecto de Vercel aparte (no el de
   producción) para probarla desde el celular.
2. Andá a la pestaña **Analizar**.
3. Tocá **"+ Agregar temporalidad"** dos o tres veces seguidas.
4. En un bloque, elegí **15M**; en otro, elegí **15M** de nuevo (repetida a
   propósito) — confirmá que ambos bloques quedan separados, cada uno con
   su propia captura y comentario, sin pisarse.
5. En otro bloque, elegí **"Personalizada"** y escribí un nombre propio
   (ej. "4H heikin-ashi") — confirmá que aparece el campo de texto y que
   se guarda ese nombre, no la palabra "Personalizada".
6. Adjuntá una captura distinta a cada bloque y escribí un comentario
   distinto en cada uno.
7. Eliminá uno de los bloques con el botón de basura — confirmá que
   desaparece solo ese, sin afectar a los demás.
8. Completá el campo general "Contexto / hipótesis" y confirmá que es un
   campo aparte, no se mezcla con los comentarios individuales.
9. Tocá "Analizar" (va a mostrar "Análisis IA no conectado" — es
   esperado, todavía no se conectó IA) y después "Guardar análisis en
   Journal".
10. Recargá la página y confirmá que el análisis guardado sigue apareciendo
    en "Análisis guardados", con las temporalidades correctas listadas.
11. Andá a **Journal** → Nueva operación y confirmá que el selector de
    temporalidad ahí sigue mostrando solo las 5 opciones de siempre
    (4H/1H/15M/5M/1M) — no debería haberse contaminado con las 17 nuevas.
12. Cargá datos demo desde Configuración y confirmá que las operaciones
    demo se generan igual que antes (con una de esas 5 temporalidades).

## Qué cambia en V1.1 respecto a V1.0

**El bug de cumplimiento está corregido.** Antes, "Cumplimiento del plan"
en Rendimiento leía el campo manual (`cumplioPlan`, Sí/No que vos tildás a
mano). Ahora lee exclusivamente `planStatus`, calculado por el Risk Engine
(`evaluarRiesgo`) — el campo manual sigue existiendo como reflexión
subjetiva tuya, pero ya no alimenta ninguna estadística, ni el Pattern
Engine, ni el Discipline Score. Una operación puede ser GANADA y
FUERA DEL PLAN al mismo tiempo — el resultado financiero nunca cambia el
`planStatus`.

**Riesgo estructurado (% o USD).** Plan/Riesgo ahora tiene un campo
numérico + un selector de unidad, en vez de un texto libre ambiguo tipo
`"1%"`. El riesgo porcentual se calcula sobre el **saldo previo a esa
operación puntual** (capital inicial + movimientos + P&L de las demás
operaciones ya registradas) — nunca sobre un capital fijo ni sobre el
resultado de la operación que se está evaluando. Se muestra siempre el
equivalente en $ en vivo.

**Saldo real vs P&L de trading — separados a propósito.**
```
P&L Trading      = suma exclusiva de resultados de operaciones
Saldo Actual     = capital inicial + depósitos − retiros + P&L Trading
Rentabilidad     = P&L Trading / capital inicial × 100   (sobre capital inicial,
                   NO incluye depósitos/retiros en el numerador)
```
Un depósito nunca aparece como ganancia de trading, y un retiro nunca
aparece como pérdida de trading.

**Gestión de cuenta.** Nueva sección en Plan/Riesgo con `+ Depósito` /
`− Retiro`. Cada movimiento guarda id, fecha, hora, tipo, monto y nota
opcional. Se guardan en una clave propia, `account-movements`, separada de
`trades` — las estadísticas de trading nunca las leen.

**Discipline Score (0–100), determinístico, sin IA.**
```
Componente Plan (70%):      dentro_del_plan=100, advertencia=50, fuera_del_plan=0
Componente Checklist (30%): 100 × (ítems tildados / ítems totales)
Si no había checklist aplicable, el 100% del peso queda en el Componente Plan.
```
El resultado financiero (Ganada/Perdida/$) nunca entra en esta fórmula.
Se muestra el desglose (Riesgo, Setup, Sesión, Stop loss, Checklist) cuando
está disponible; para operaciones guardadas antes de esta actualización,
el desglose por categoría se marca honestamente como "no disponible" en
vez de inventarse.

**Compatibilidad hacia atrás — nada se reescribe a la fuerza.**
- `planStatus` viejo (`'cumple'`) se interpreta como `'dentro_del_plan'` al leerlo, sin tocar el dato guardado.
- `riesgoPorOperacion` viejo (texto tipo `"1%"`) se sigue leyendo si todavía no existe `riskValue`/`riskUnit`.
- Un backup V1.0 (sin `account-movements`) se importa igual — esa clave simplemente queda en `[]`, no rompe nada.
- Ninguna clave de `localStorage` cambió de nombre: `trades`, `plan-riesgo`, `analisis`, `bot-chat-history`, y la nueva `account-movements`.


## Qué funciona hoy y qué no

✅ **Funciona 100% local, sin depender de nada externo:**
Journal, Historial, Rendimiento (estadísticas y gráficos), Plan/Riesgo,
motor de riesgo (`evaluarRiesgo`), checklist pre-operación, `planStatus`,
motor de patrones, modo demo, exportar/importar backup, navegación,
dictado por voz y lectura en voz alta.

⚠️ **Todavía no conectado (a propósito, no es un bug):**
NEXO (chat) y el módulo Analizar necesitan un modelo de IA, y eso requiere
un backend propio que guarde la API key del lado servidor — nunca en el
navegador. Por ahora ambos módulos muestran claramente
"NEXO AI no conectado" / "Análisis IA no conectado" en vez de simular una
respuesta. Toda la conexión de IA pasa por un único archivo,
`src/aiService.js` — el día que haya backend, ese es el único archivo que
hay que tocar.

---

## A. Qué instalar en tu PC

Necesitás **Node.js** (incluye `npm`). Si no lo tenés:

1. Andá a **https://nodejs.org**
2. Descargá la versión **LTS** (la recomendada, no la "Current").
3. Instalala como cualquier programa (Siguiente, Siguiente, Instalar).
4. Para confirmar que quedó instalado, abrí una terminal (ver paso D) y escribí:
   ```
   node -v
   ```
   Si te muestra un número de versión (ej: `v20.11.0`), está listo.

## B. Dónde guardar la carpeta

1. Descargá/copiá la carpeta `journal-capital` completa a un lugar fácil de
   encontrar, por ejemplo `Documentos/journal-capital`.
2. Adentro tiene que verse así:
   ```
   journal-capital/
   ├── src/
   │   ├── App.jsx
   │   ├── main.jsx
   │   └── aiService.js
   ├── public/
   ├── index.html
   ├── package.json
   ├── vite.config.js
   └── README.md
   ```

## C. Cómo copiar los archivos

Si te los pasé como archivos sueltos, armá vos esa misma estructura de
carpetas antes de seguir — los nombres y ubicaciones tienen que ser
exactamente esos.

## D. Cómo abrir la terminal ahí

**Windows:** abrí la carpeta `journal-capital` en el Explorador de archivos,
hacé clic en la barra de direcciones de arriba, escribí `cmd` y presioná Enter.

**Mac:** abrí la carpeta en Finder, click derecho → "Nueva Terminal en la
carpeta" (o abrí la app Terminal y escribí `cd ` seguido de arrastrar la
carpeta ahí adentro, y Enter).

## E. Instalar y ejecutar

En esa terminal, escribí y presioná Enter después de cada línea:

```
npm install
```

Esto descarga las piezas necesarias (React, los gráficos, los íconos). Tarda
un par de minutos la primera vez. Vas a ver una carpeta nueva `node_modules`
aparecer — es normal, no la toques.

Cuando termine, escribí:

```
npm run dev
```

Vas a ver algo como:

```
  VITE ready
  ➜  Local:   http://localhost:5173/
```

## F. Qué dirección abrir

Copiá **http://localhost:5173** y pegala en Chrome (recomendado, por el
dictado de voz). La app va a abrir ahí, igual que en el artifact.

## G. Cómo detenerlo

Volvé a la terminal donde corre y presioná **Ctrl + C**. Se apaga el servidor.

## H. Cómo volver a iniciarlo otro día

Repetí solo el paso E, pero esta vez **no hace falta correr `npm install`
de nuevo** (a menos que yo te pase archivos nuevos) — directamente:

```
npm run dev
```

---

## Migrar tus datos del artifact a esta versión

Los datos del artifact de Claude y los de esta app viven en lugares
físicamente distintos — no se copian solos. Para pasarlos:

1. En el **artifact de Claude**: andá a Configuración → "Exportar backup (JSON)".
   Se descarga un archivo `journal-capital-backup-AAAA-MM-DD.json`.
2. En **esta app (Vite)**: abrila, andá a Más → Configuración → "Importar backup".
3. Elegí ese mismo archivo `.json`.
4. Recargá la página (F5). Tus operaciones, plan y análisis deberían aparecer.

---

## Testing V1.1 — RISK & PERFORMANCE

Igual criterio que antes: **VERIFICADO ESTÁTICAMENTE** (revisé sintaxis,
balance, props, referencias, sin ejecutar en navegador) vs **PROBADO EN
NAVEGADOR** (lo corrieron ustedes y lo clickearon). Todo lo de V1.0 sigue
en pie. Lo nuevo de V1.1, abajo — todo en estado "Sin probar", a propósito:
no voy a declarar nada validado sin que ustedes lo confirmen en Vercel/local.

| # | Prueba | Estado | Resultado esperado | Resultado real | Bug | Prioridad |
|---|--------|--------|---------------------|-----------------|-----|-----------|
| A | Ganada + dentro del plan | Sin probar | resultado=Ganada, planStatus=dentro_del_plan | — | — | — |
| B | Ganada + fuera del plan | Sin probar | resultado=Ganada, planStatus=fuera_del_plan (no se mezclan) | — | — | — |
| C | Perdida + dentro del plan | Sin probar | resultado=Perdida, planStatus=dentro_del_plan | — | — | — |
| D | Perdida + fuera del plan | Sin probar | resultado=Perdida, planStatus=fuera_del_plan | — | — | — |
| E | Riesgo máximo definido en % | Sin probar | Se calcula sobre saldo previo, no sobre capital fijo; muestra equivalente en $ | — | — | — |
| F | Riesgo máximo definido en USD | Sin probar | Compara directo contra el monto en $ | — | — | — |
| G | Depósito | Sin probar | Se guarda en account-movements, Saldo actual sube, P&L Trading NO cambia | — | — | — |
| H | Retiro | Sin probar | Se guarda en account-movements, Saldo actual baja, P&L Trading NO cambia | — | — | — |
| I | Persistencia tras cerrar navegador | Sin probar | trades, plan, movimientos, análisis, historial NEXO siguen ahí | — | — | — |
| J | Datos de la V1 desplegada siguen funcionando | Sin probar | Trades viejos visibles, planStatus 'cumple' se ve como "DENTRO DEL PLAN" | — | — | — |
| K | Cumplimiento correcto | Sin probar | % de Rendimiento coincide con planStatus, no con el campo manual | — | — | — |
| L | Discipline Score | Sin probar | Score 0-100 visible por operación, desglose determinístico, resultado financiero no lo altera | — | — | — |
| M | Estadísticas (winrate, P&L, profit factor, expectativa, drawdown, rachas, R) | Sin probar | Coinciden con cálculo manual | — | — | — |
| N | Pattern Engine (por cumplimiento, incluyendo R promedio cuando hay riesgo cargado) | Sin probar | "Dentro del plan"/"Fuera del plan" con winrate + n correctos | — | — | — |
| O | Exportar backup V1.1 | Sin probar | El JSON incluye trades, plan-riesgo, analisis, bot-chat-history, account-movements | — | — | — |
| P | Importar backup V1.1 | Sin probar | Todos los datos, incluidos movimientos, se recuperan | — | — | — |
| Q | Importar backup V1.0 (sin account-movements) | Sin probar | Importa igual; movimientos queda en [] sin romper nada | — | — | — |

**Prioridades:** P0 = rompe app/datos · P1 = funcionalidad importante rota ·
P2 = problema de UX · P3 = mejora visual.

**Regla acordada:** no se agregan funciones nuevas mientras haya bugs P0 o P1
sin resolver.

## Próximo paso (cuando esta V1 pase las pruebas)

Conectar NEXO y Analizar a un modelo real requiere un backend propio (no
Supabase todavía, no pagos, no RAG — solo un servidor mínimo que reciba la
pregunta del frontend, la mande al modelo con la API key guardada del lado
servidor, y devuelva la respuesta). El único archivo del frontend que va a
cambiar en ese momento es `src/aiService.js`.
