# Journal Capital Trading — V1 local

Versión React real (fuera del artifact de Claude), migrada para correr en tu
propia PC con Vite.

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

## Testing V1

Distingo dos niveles, porque no es lo mismo:

- **VERIFICADO ESTÁTICAMENTE** = revisé el código (sintaxis, balance de
  JSX, props, referencias) sin ejecutarlo en un navegador real. Da
  confianza de que no hay errores obvios, pero no reemplaza probarlo.
- **PROBADO EN NAVEGADOR** = lo corriste vos con `npm run dev` y lo
  clickeaste. Solo esto confirma que funciona de verdad.

Todo lo de abajo está, hasta ahora, en estado **VERIFICADO ESTÁTICAMENTE**.
Nada está marcado como "probado en navegador" todavía — eso lo completás
vos (o lo hacemos juntos en la próxima sesión) siguiendo esta lista:

| # | Prueba | Estado | Resultado esperado | Resultado real | Bug | Prioridad |
|---|--------|--------|---------------------|-----------------|-----|-----------|
| 1 | Navegación entre Inicio/Journal/Analizar/Rendimiento/NEXO/Más | Sin probar | Cambia de pantalla sin errores | — | — | — |
| 2 | Menú "Más" abre Plan/Riesgo, Calendario, Aprender, Configuración | Sin probar | Se despliega y navega bien | — | — | — |
| 3 | Crear operación completa (todos los campos + detalle avanzado) | Sin probar | Se guarda y aparece en Historial | — | — | — |
| 4 | Compra/Venta, Ganada/Perdida/Empate, Sí/No — un solo seleccionado a la vez | Sin probar | Selección inequívoca, un solo activo | — | — | — |
| 5 | Cargar Plan/Riesgo de prueba (capital 1000, riesgo 1%, límite diario 30, etc.) | Sin probar | Se guarda y persiste tras cerrar/reabrir | — | — | — |
| 6 | Operación dentro del plan | Sin probar | Control de riesgo: ✅ Cumple | — | — | — |
| 7 | Operación con riesgo excesivo | Sin probar | ❌ Fuera del plan | — | — | — |
| 8 | Operación en sesión no permitida | Sin probar | ⚠️/❌ según corresponda | — | — | — |
| 9 | Operación con setup no válido | Sin probar | ❌ Fuera del plan | — | — | — |
| 10 | Operación GANADA pero fuera del plan | Sin probar | resultado=Ganada, planStatus=fuera_del_plan (no se mezclan) | — | — | — |
| 11 | Operación PERDIDA pero dentro del plan | Sin probar | resultado=Perdida, planStatus=cumple | — | — | — |
| 12 | Dos pérdidas consecutivas → tercera operación | Sin probar | Aparece advertencia/regla de pausa | — | — | — |
| 13 | Rendimiento: métricas y gráficos | Sin probar | Coinciden con cálculo manual | — | — | — |
| 14 | Cargar datos demo (~25 operaciones) | Sin probar | Aparecen marcadas, no rompen nada | — | — | — |
| 15 | Borrar datos demo | Sin probar | Desaparecen solo las demo, reales intactas | — | — | — |
| 16 | Exportar backup (Vite) | Sin probar | Se descarga JSON válido | — | — | — |
| 17 | Importar backup (de artifact a Vite) | Sin probar | Datos recuperados correctamente | — | — | — |
| 18 | NEXO: los 6 modos son seleccionables | Sin probar | Cambian sin error | — | — | — |
| 19 | NEXO: enviar consulta | Sin probar | Muestra "NEXO AI no conectado" (no simula respuesta) | — | — | — |
| 20 | Analizar: adjuntar capturas por temporalidad | Sin probar | Preview funciona, botón Analizar muestra "no conectado" | — | — | — |
| 21 | Voz: dictado (mic) | Sin probar | Pide permiso de mic real y transcribe (Chrome) | — | — | — |
| 22 | Voz: lectura en voz alta | Sin probar | Lee el texto en es-AR | — | — | — |
| 23 | Persistencia tras cerrar navegador y reabrir | Sin probar | Trades, plan, análisis, historial NEXO siguen ahí | — | — | — |
| 24 | Responsive: desktop 1920×1080, laptop 1366×768, mobile ~390×844 | Sin probar | Nada se corta, "Más" funciona, capturas se ven bien | — | — | — |

**Prioridades:** P0 = rompe app/datos · P1 = funcionalidad importante rota ·
P2 = problema de UX · P3 = mejora visual.

**Regla acordada:** no se agregan funciones nuevas mientras haya bugs P0 o P1
sin resolver.

---

## Próximo paso (cuando esta V1 pase las pruebas)

Conectar NEXO y Analizar a un modelo real requiere un backend propio (no
Supabase todavía, no pagos, no RAG — solo un servidor mínimo que reciba la
pregunta del frontend, la mande al modelo con la API key guardada del lado
servidor, y devuelva la respuesta). El único archivo del frontend que va a
cambiar en ese momento es `src/aiService.js`.
