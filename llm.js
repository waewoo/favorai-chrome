/**
 * Module llm.js - Gestion des appels aux différents fournisseurs de LLM.
 */

const SYSTEM_PROMPT_COMMON = `Vous êtes un assistant spécialisé dans l'organisation de favoris de navigateurs web.
On vous fournit une arborescence de favoris sous forme de JSON.
Votre tâche est de réorganiser cette structure selon le mode demandé en respectant scrupuleusement les règles suivantes :

RÈGLES STRICTES :
1. Vous devez renvoyer UNIQUEMENT un objet JSON valide avec deux clés principales :
   - "reorganizedTree": la structure complète réorganisée.
   - "explanation": une explication globale en français de la réorganisation.
2. Pour optimiser la vitesse et réduire la taille de la réponse, vous devez OMETTRE le champ "url" dans l'objet "reorganizedTree" de sortie. Renvoyez uniquement :
   - Un favori : { "id": "string", "title": "string" }
   - Un dossier : { "id": "string", "title": "string", "children": [...] }
3. Ne perdez AUCUN favori. Tous les identifiants "id" présents dans le JSON d'entrée doivent exister dans le JSON de sortie (dans leurs dossiers respectifs).
4. Conservez l'identifiant "id" pour tous les favoris et dossiers existants afin qu'on puisse identifier les déplacements.
5. Si vous devez créer un dossier, attribuez-lui un ID temporaire commençant par "new_" (par exemple : "new_folder_1", "new_folder_dev", etc.).
6. Ne modifiez pas l'ID d'un élément existant.`;

const PROMPT_MINIMAL_MODE = `MODE : Réorganisation minimale.
Règles spécifiques :
- Vous devez uniquement ranger les favoris (les liens individuels) qui semblent mal classés ou orphelins.
- Vous devez RESPECTER STRICTEMENT les dossiers existants.
- Ne renommez JAMAIS un dossier existant.
- Ne déplacez JAMAIS un dossier existant.
- Ne supprimez pas de dossier existant.
- Ne réinventez pas toute l'arborescence.
- Créez un nouveau dossier uniquement si c'est absolument nécessaire pour classer un favori qui ne correspond à aucun dossier actuel.
- La structure globale des dossiers doit rester inchangée. Seuls les favoris eux-mêmes peuvent être déplacés de dossier.`;

const PROMPT_COMPLETE_MODE = `MODE : Réorganisation complète.
Règles spécifiques :
- Vous pouvez repenser toute l'organisation de l'arborescence si vous estimez que c'est pertinent.
- Vous pouvez créer de nouveaux dossiers, renommer des dossiers existants, fusionner des dossiers ou déplacer des dossiers entiers.
- Vous pouvez proposer une nouvelle arborescence propre, catégorisée de façon thématique et moderne (ex: "Développement", "Loisirs", "Finance", "Actualités", etc.).
- Expliquez clairement vos choix structurels dans le champ "explanation" pour aider l'utilisateur à comprendre les changements.`;

/**
 * Envoie une requête à l'API LLM configurée.
 * 
 * @param {Object} config Configuration de l'API (provider, apiUrl, apiKey, modelName)
 * @param {Object} bookmarksTree Arborescence des favoris (JSON nettoyé)
 * @param {string} mode "minimal" ou "complete"
 * @returns {Promise<Object>} L'objet JSON retourné par le LLM { reorganizedTree, explanation }
 */
async function queryLLM(config, bookmarksTree, mode, signal) {
  const { provider, apiUrl, apiKey, modelName, customPrompt } = config;
  
  const systemPrompt = customPrompt && customPrompt.trim()
    ? `${SYSTEM_PROMPT_COMMON}\n\nINSTRUCTIONS SUPPLÉMENTAIRES DE L'UTILISATEUR (A RESPECTER STRICTEMENT) :\n${customPrompt.trim()}`
    : SYSTEM_PROMPT_COMMON;
  
  const modeInstruction = mode === 'complete' ? PROMPT_COMPLETE_MODE : PROMPT_MINIMAL_MODE;
  const userPrompt = `${modeInstruction}\n\nVoici le JSON de mes favoris actuel à réorganiser :\n\n${JSON.stringify(bookmarksTree, null, 2)}`;
  
  switch (provider) {
    case 'openai':
      return await queryOpenAI(apiUrl || 'https://api.openai.com/v1', apiKey, modelName || 'gpt-4o-mini', userPrompt, systemPrompt, signal);
    case 'google':
      return await queryGemini(apiUrl || 'https://generativelanguage.googleapis.com', apiKey, modelName || 'gemini-1.5-flash', userPrompt, systemPrompt, signal);
    case 'mistral':
      return await queryMistral(apiUrl || 'https://api.mistral.ai/v1', apiKey, modelName || 'mistral-small-latest', userPrompt, systemPrompt, signal);
    case 'grok':
      return await queryOpenAI(apiUrl || 'https://api.x.ai/v1', apiKey, modelName || 'grok-2', userPrompt, systemPrompt, signal);
    case 'ollama':
      return await queryOllama(apiUrl || 'http://localhost:11434', modelName || 'llama3', userPrompt, systemPrompt, signal);
    case 'custom':
      return await queryCustom(apiUrl, apiKey, modelName, userPrompt, systemPrompt, signal);
    default:
      throw new Error(`Fournisseur LLM inconnu : ${provider}`);
  }
}

/**
 * Appels vers OpenAI API (compatible avec le format JSON)
 */
async function queryOpenAI(url, key, model, prompt, systemPrompt, signal) {
  const endpoint = `${url.replace(/\/$/, '')}/chat/completions`;
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${key}`
  };

  const body = {
    model: model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1
  };

  const response = await fetchWithTimeout(endpoint, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(body),
    signal: signal
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Erreur OpenAI (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  return cleanAndParseJSON(content);
}

/**
 * Appels vers Google Gemini API (REST)
 */
async function queryGemini(url, key, model, prompt, systemPrompt, signal) {
  // Par défaut : https://generativelanguage.googleapis.com
  const baseUrl = url.replace(/\/$/, '');
  const endpoint = `${baseUrl}/v1beta/models/${model}:generateContent?key=${key}`;
  
  const headers = {
    'Content-Type': 'application/json'
  };

  const body = {
    contents: [
      {
        parts: [
          { text: prompt }
        ]
      }
    ],
    systemInstruction: {
      parts: [
        { text: systemPrompt }
      ]
    },
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1
    }
  };

  const response = await fetchWithTimeout(endpoint, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(body),
    signal: signal
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Erreur Gemini (${response.status}): ${errText}`);
  }

  const data = await response.json();
  try {
    const content = data.candidates[0].content.parts[0].text;
    return cleanAndParseJSON(content);
  } catch (e) {
    throw new Error(`Gemini n'a pas renvoyé un format JSON valide: ${JSON.stringify(data)}`);
  }
}

/**
 * Appels vers Mistral API
 */
async function queryMistral(url, key, model, prompt, systemPrompt, signal) {
  const endpoint = `${url.replace(/\/$/, '')}/chat/completions`;
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${key}`
  };

  const body = {
    model: model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1
  };

  const response = await fetchWithTimeout(endpoint, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(body),
    signal: signal
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Erreur Mistral (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  return cleanAndParseJSON(content);
}

/**
 * Appels vers Ollama local
 */
async function queryOllama(url, model, prompt, systemPrompt, signal) {
  const endpoint = `${url.replace(/\/$/, '')}/api/chat`;
  
  const headers = {
    'Content-Type': 'application/json'
  };

  const body = {
    model: model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ],
    stream: false,
    format: 'json',
    options: {
      temperature: 0.1
    }
  };

  const response = await fetchWithTimeout(endpoint, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(body),
    signal: signal
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Erreur Ollama (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const content = data.message.content;
  return cleanAndParseJSON(content);
}

/**
 * Endpoint Custom (supposé compatible OpenAI par défaut)
 */
async function queryCustom(url, key, model, prompt, systemPrompt, signal) {
  // S'assurer de rajouter /chat/completions si l'URL se termine par /v1 ou ne contient pas de chemin spécifique
  let formattedUrl = url.trim();
  if (formattedUrl.endsWith('/v1')) {
    formattedUrl = `${formattedUrl}/chat/completions`;
  } else if (!formattedUrl.includes('/chat/completions') && !formattedUrl.includes('/completions')) {
    formattedUrl = `${formattedUrl.replace(/\/$/, '')}/v1/chat/completions`;
  }
  const endpoint = formattedUrl;
  
  const headers = {
    'Content-Type': 'application/json'
  };
  if (key) {
    headers['Authorization'] = `Bearer ${key}`;
  }

  const body = {
    model: model || 'custom-model',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ],
    temperature: 0.1
  };

  const response = await fetchWithTimeout(endpoint, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(body),
    signal: signal
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Erreur Endpoint Custom (${response.status}): ${errText}`);
  }

  const data = await response.json();
  
  // Essayer de lire au format OpenAI chat completion
  if (data.choices && data.choices[0] && data.choices[0].message) {
    return cleanAndParseJSON(data.choices[0].message.content);
  }
  
  // Sinon essayer de parser directement la réponse s'il renvoie du texte brut ou un autre format
  if (typeof data === 'string') {
    return cleanAndParseJSON(data);
  }
  
  return data; // Si c'est déjà l'objet attendu
}

/**
 * Nettoie et parse de manière robuste une chaîne JSON renvoyée par le LLM,
 * en éliminant les blocs de code markdown (ex: ```json ... ```) ou le texte environnant.
 */
function cleanAndParseJSON(text) {
  if (typeof text !== 'string') return text;
  
  let cleanText = text.trim();
  
  // Enlever les blocs de code markdown ```json ... ``` ou ``` ... ```
  const markdownRegex = /^```(?:json)?\s*([\s\S]*?)\s*```$/i;
  const match = cleanText.match(markdownRegex);
  if (match) {
    cleanText = match[1].trim();
  }
  
  // Tenter de parser le texte nettoyé
  try {
    return JSON.parse(cleanText);
  } catch (e) {
    // Si le parsing échoue toujours, on peut tenter d'extraire le premier { ou [ et le dernier } ou ]
    // pour isoler le JSON s'il y a du texte explicatif autour.
    const firstBrace = cleanText.indexOf('{');
    const lastBrace = cleanText.lastIndexOf('}');
    const firstBracket = cleanText.indexOf('[');
    const lastBracket = cleanText.lastIndexOf(']');
    
    let startIndex = -1;
    let endIndex = -1;
    
    if (firstBrace !== -1 && lastBrace !== -1) {
      if (firstBracket !== -1 && firstBracket < firstBrace) {
        startIndex = firstBracket;
        endIndex = lastBracket;
      } else {
        startIndex = firstBrace;
        endIndex = lastBrace;
      }
    } else if (firstBracket !== -1 && lastBracket !== -1) {
      startIndex = firstBracket;
      endIndex = lastBracket;
    }
    
    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
      const jsonCandidate = cleanText.substring(startIndex, endIndex + 1);
      try {
        return JSON.parse(jsonCandidate);
      } catch (innerError) {
        // Laisser l'erreur d'origine être levée
      }
    }
    throw new Error(`Réponse de l'IA invalide (non JSON) : ${text.substring(0, 100)}...`);
  }
}

/**
 * Exécute une requête fetch avec un délai d'attente maximum (timeout)
 * tout en respectant un signal d'annulation externe.
 */
async function fetchWithTimeout(url, options, timeoutMs = 90000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const userSignal = options.signal;
  const onAbort = () => controller.abort();
  if (userSignal) {
    userSignal.addEventListener('abort', onAbort);
  }

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } catch (error) {
    if (controller.signal.aborted) {
      if (userSignal && userSignal.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      } else {
        throw new Error(`Délai d'attente de la requête dépassé (${timeoutMs / 1000}s)`);
      }
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    if (userSignal) {
      userSignal.removeEventListener('abort', onAbort);
    }
  }
}
