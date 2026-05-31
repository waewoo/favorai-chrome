/* v8 ignore next */
import { LLM_TIMEOUT_MS } from '../utils/constants.js';

const HTTP_STATUS_MESSAGES = {
  400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found',
  429: 'Rate Limited', 500: 'Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable', 504: 'Gateway Timeout'
};

/**
 * Extrait un message d'erreur du payload ou retourne la description HTTP.
 * @param {string} provider - Nom du fournisseur (Gemini, OpenAI, etc.)
 * @param {number} status - Code HTTP
 * @param {string} responseText - Réponse brute du serveur
 * @returns {string}
 */
export function formatErrorMessage(provider, status, responseText) {
  let detail = HTTP_STATUS_MESSAGES[status] || 'Unknown Error';
  try {
    const json = JSON.parse(responseText);
    const message = json.error?.message || json.message || json.error || null;
    if (message && typeof message === 'string' && message.length < 200) {
      detail = message;
    }
  } catch {
    if (responseText.length > 0 && responseText.length < 200 && !responseText.includes('<')) {
      detail = responseText;
    }
  }
  return `Erreur ${provider} (${status}: ${detail})`;
}

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

  // Sanitize smart quotes using charCodeAt-based replacement to avoid linter issues
  // with raw Unicode characters in source code. Track if we are inside a string to escape
  // smart double quotes inside string values instead of producing invalid nested double quotes.
  let inString = false;
  let escapeNext = false;
  cleanText = cleanText.split('').map(ch => {
    const code = ch.charCodeAt(0);
    if (escapeNext) {
      escapeNext = false;
      return ch;
    }
    if (ch === '\\') {
      escapeNext = true;
      return ch;
    }
    if (ch === '"') {
      inString = !inString;
      return ch;
    }
    if (inString) {
      if (ch === '\n') return '\\n';
      if (ch === '\r') return '';
    }
    if (code === 0x201C || code === 0x201D) {
      return inString ? '\\"' : '"';  // Escape inside string values, otherwise replace with normal double quote
    }
    if (code === 0x2018 || code === 0x2019) return "'";  // '' -> '
    if (code === 0x2013 || code === 0x2014) return '-';  // –— -> -
    if (code === 0x2026) return '...';                    // … -> ...
    return ch;
  }).join('');

  // Normalize line endings and tabs
  cleanText = cleanText.replace(/\r\n/g, '\n').replace(/\t/g, ' ');

  // Fix LLM shorthand: replace [...] (invalid JSON) with [] (valid empty array)
  // This happens when the LLM uses [...] to mean "same children as before"
  cleanText = cleanText.replace(/\[\s*\.\.\.\s*\]/g, '[]');

  try {
    return JSON.parse(cleanText);
  /* v8 ignore next */
  } catch (e) {
    // Log the exact parsing error
    console.error('[FavorAI] JSON.parse error:', e.message);
    if (e.message.includes('position')) {
      const posMatch = e.message.match(/position (\d+)/);
      /* v8 ignore next */
      if (posMatch) {
        const pos = parseInt(posMatch[1]);
        const start = Math.max(0, pos - 50);
        const end = Math.min(cleanText.length, pos + 50);
        console.error(`[FavorAI] Error at position ${pos}. Context:`);
        console.error(`[FavorAI] ...${cleanText.substring(start, end)}...`);
        // "Unexpected non-whitespace character after JSON at position X" means valid JSON
        // ends at position X — the LLM added trailing content (e.g. explanation outside the
        // outer wrapper). Try parsing just the valid prefix.
        if (e.message.includes('Unexpected non-whitespace') || e.message.includes('after JSON')) {
          try {
            return JSON.parse(cleanText.substring(0, pos));
          /* v8 ignore next 2 */
          } catch { /* fall through to brace extraction */ }
        }
      }
    }
    // Tenter d'extraire le JSON depuis du texte entourant - avec correspondance de braces
    // en respectant les limites des strings
    const fb = cleanText.indexOf('{');
    if (fb !== -1) {
      // Compter les braces pour trouver le vrai end, en ignorant les braces dans les strings
      let braceCount = 0;
      let idx = fb;
      let endIdx = -1;
      let inString = false;
      let escapeNext = false;

      while (idx < cleanText.length) {
        const char = cleanText[idx];

        /* v8 ignore next 5 */
        if (escapeNext) {
          escapeNext = false;
          idx++;
          continue;
        }

        if (char === '\\') {
          escapeNext = true;
          idx++;
          continue;
        }

        if (char === '"') {
          inString = !inString;
          idx++;
          continue;
        }

        if (!inString) {
          if (char === '{') braceCount++;
          else if (char === '}') {
            braceCount--;
            if (braceCount === 0) {
              endIdx = idx;
              break;
            }
          }
        }

        idx++;
      }

      if (endIdx !== -1) {
        try {
          const jsonStr = cleanText.substring(fb, endIdx + 1);
          return JSON.parse(jsonStr);
        } catch (err) {
          console.error('[FavorAI] Failed to parse extracted JSON:', err.message);
        }
      }
    }

    const fBr = cleanText.indexOf('[');
    if (fBr !== -1) {
      // Bracket-counting with string-awareness (mirrors the brace extraction above)
      // to avoid a "]" inside a string value prematurely closing the array.
      let bracketCount = 0;
      let idx = fBr;
      let endIdx = -1;
      let inStr = false;
      let escNext = false;
      while (idx < cleanText.length) {
        const ch = cleanText[idx];
        if (escNext) { escNext = false; idx++; continue; }
        if (ch === '\\') { escNext = true; idx++; continue; }
        if (ch === '"') { inStr = !inStr; idx++; continue; }
        if (!inStr) {
          if (ch === '[') bracketCount++;
          else if (ch === ']') {
            bracketCount--;
            if (bracketCount === 0) { endIdx = idx; break; }
          }
        }
        idx++;
      }

      if (endIdx !== -1) {
        try {
          return JSON.parse(cleanText.substring(fBr, endIdx + 1));
        /* v8 ignore next 2 */
        } catch { /* ignore */ }
      }
    }
    // Detect if the JSON was truncated (LLM hit max_tokens)
    const trimmed = text.trimEnd();
    const isLikelyTruncated = trimmed.length > 2000 &&
      !trimmed.endsWith('}') && !trimmed.endsWith(']');

    if (isLikelyTruncated) {
      console.error('[FavorAI] LLM response truncated (max_tokens reached).');
      console.error('[FavorAI] Response ends with:', trimmed.substring(Math.max(0, trimmed.length - 200)));
      const e = new Error(
        'La réponse de l\'IA est incomplète : le modèle a atteint sa limite de tokens.\n' +
        '→ Solutions : réduire le nombre de favoris analysés (choisir un sous-dossier), ' +
        'ou augmenter max_tokens dans les paramètres avancés.'
      );
      e.isTokenLimit = true;
      /* v8 ignore next */
      throw e;
    }

    // Log detailed parsing error
    console.error('[FavorAI] JSON parsing failed. Response length:', text.length);
    console.error('[FavorAI] Response starts with:', text.substring(0, 200));
    console.error('[FavorAI] Response ends with:', text.substring(Math.max(0, text.length - 200)));
    console.error('[FavorAI] Full response:', text);
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
  /* v8 ignore next 4 */
  } finally {
    clearTimeout(tid);
    if (userSignal) userSignal.removeEventListener('abort', onAbort);
  }
}
