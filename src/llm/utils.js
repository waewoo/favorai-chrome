import { LLM_TIMEOUT_MS } from '../utils/constants.js';

/**
 * Nettoie et parse robustement une chaîne JSON renvoyée par le LLM.
 * Gère les blocs markdown ```json``` et le texte environnant.
 * @param {string|any} text
 * @returns {any}
 */
export function cleanAndParseJSON(text) {
  if (typeof text !== 'string') return text;

  let cleanText = text.trim();

  // Retirer les blocs markdown ```json ... ```
  const markdownMatch = cleanText.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (markdownMatch) {
    cleanText = markdownMatch[1].trim();
  }

  try {
    return JSON.parse(cleanText);
  } catch (_) {
    // Tenter d'extraire le JSON depuis du texte entourant
    const fb = cleanText.indexOf('{');
    const lb = cleanText.lastIndexOf('}');
    const fBr = cleanText.indexOf('[');
    const lBr = cleanText.lastIndexOf(']');

    let start = -1, end = -1;
    if (fb !== -1 && lb !== -1) {
      start = (fBr !== -1 && fBr < fb) ? fBr : fb;
      end   = (fBr !== -1 && fBr < fb) ? lBr : lb;
    } else if (fBr !== -1 && lBr !== -1) {
      start = fBr; end = lBr;
    }

    if (start !== -1 && end > start) {
      try {
        return JSON.parse(cleanText.substring(start, end + 1));
      } catch (__) { /* ignore */ }
    }
    // Detect if the JSON was truncated (LLM hit max_tokens)
    const trimmed = text.trimEnd();
    const isLikelyTruncated = trimmed.length > 2000 &&
      !trimmed.endsWith('}') && !trimmed.endsWith(']');

    if (isLikelyTruncated) {
      console.error('[FavorAI] LLM response truncated (max_tokens reached). Full response:', text);
      const e = new Error(
        'La réponse de l\'IA est incomplète : le modèle a atteint sa limite de tokens.\n' +
        '→ Solutions : réduire le nombre de favoris analysés (choisir un sous-dossier), ' +
        'ou augmenter max_tokens dans les paramètres avancés.'
      );
      e.isTokenLimit = true;
      throw e;
    }

    console.error('[FavorAI] Invalid JSON response:', text.substring(0, 500));
    throw new Error(`Réponse de l'IA invalide (non JSON). Voir la console pour le détail.`);
  }
}

/**
 * fetch avec timeout et signal d'annulation externe.
 * @param {string} url
 * @param {RequestInit & {signal?: AbortSignal}} options
 * @param {number} [timeoutMs]
 */
export async function fetchWithTimeout(url, options, timeoutMs = LLM_TIMEOUT_MS) {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);

  const userSignal = options.signal;
  const onAbort = () => controller.abort();
  if (userSignal) userSignal.addEventListener('abort', onAbort);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      if (userSignal?.aborted) throw new DOMException('Aborted', 'AbortError');
      throw new Error(`Délai d'attente dépassé (${timeoutMs / 1000}s)`);
    }
    throw error;
  } finally {
    clearTimeout(tid);
    if (userSignal) userSignal.removeEventListener('abort', onAbort);
  }
}