/**
 * aiService.js — Journal Capital Trading
 *
 * Punto único por el que NEXO y el módulo Analizar piden inteligencia.
 * Ningún componente de la UI debe llamar a un proveedor de IA directamente.
 *
 * HOY (V1 local): AI_CONNECTED = false.
 * No hay backend propio todavía, así que no hay ninguna API key en este
 * archivo ni en ningún otro del frontend — a propósito. Cuando exista un
 * backend seguro (Paso siguiente del roadmap), esta función es la única
 * que hay que reescribir: apuntarla a nuestro propio endpoint
 * (ej. POST /api/nexo) que guarde la key del lado servidor. El resto de
 * la app (NEXO, Analizar) no necesita cambiar nada porque solo conoce
 * esta interfaz, no el proveedor de IA detrás.
 */

export const AI_CONNECTED = false;

export const AI_DISCONNECTED_MESSAGES = {
  nexo: 'NEXO AI no conectado. El Journal, Rendimiento y Plan/Riesgo continúan funcionando normalmente.',
  analizar: 'Análisis IA no conectado.',
};

/**
 * callAI({ system, messages })
 * - system: string con el system prompt.
 * - messages: array de mensajes en formato { role, content } (content puede
 *   ser texto simple o un array de bloques text/image, igual que la API de
 *   Anthropic — así el formato no cambia cuando conectemos el backend real).
 *
 * Devuelve siempre { ok, text, error }.
 * Mientras AI_CONNECTED sea false, nunca llega a hacer red — nunca simula
 * una respuesta como si fuera del modelo.
 */
export async function callAI({ system, messages, context = 'nexo' } = {}) {
  if (!AI_CONNECTED) {
    return {
      ok: false,
      text: null,
      error: AI_DISCONNECTED_MESSAGES[context] || 'IA no conectada.',
    };
  }

  // A partir de acá es donde, cuando haya backend, se reemplaza el fetch
  // por una llamada a nuestro propio servidor, nunca directo a un proveedor
  // desde el navegador:
  //
  // const response = await fetch('/api/ai', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ system, messages }),
  // });
  // const data = await response.json();
  // return { ok: true, text: data.text, error: null };

  return { ok: false, text: null, error: 'aiService no implementado todavía.' };
}
