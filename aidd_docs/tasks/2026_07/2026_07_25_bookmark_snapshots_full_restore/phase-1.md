---
status: done
---

# Instruction: Contrat de snapshot et capture avant application

## Architecture projection

> Tree of the final files. ✅ create · 🛠️ modify · ❌ delete

```txt
.
├── src/background/snapshots.js ✅
├── src/background/apply.js 🛠️
├── src/background/orchestrator.js 🛠️
├── src/utils/constants.js 🛠️
└── tests/unit/snapshots.test.js ✅
```

## Tasks to do

### `1)` Définir le modèle local

> Garantir qu’un snapshot est complet, sérialisable et exempt de secrets.

1. Stocker version, identifiant, date, portée éventuelle et arbre des nœuds.
2. Inclure uniquement `id`, `title`, `url`, `parentId` et `children` nécessaires à la restauration.
3. Exclure API keys, provider, modèle, prompts et toute configuration LLM.
4. Persister les snapshots dans une clé dédiée de `chrome.storage.local`, avec limite de rétention explicite.

### `2)` Capturer avant `apply`

> Garantir qu’un état antérieur existe avant toute mutation approuvée.

1. Lire l’arbre complet juste avant `applyChanges` et enregistrer le snapshot avant la première mutation.
2. Ne pas créer de snapshot si la vérification de cohérence échoue ou si aucune mutation ne peut être appliquée.
3. Retourner l’identifiant du snapshot créé dans la réponse d’application et préserver l’historique d’undo existant.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | Un snapshot sauvegardé puis relu contient l’arbre complet et aucune clé de secret ou de configuration provider. |
| 2 | Une application réussie crée un snapshot daté avant les mutations ; une application refusée ne modifie ni l’arbre ni les snapshots. |
