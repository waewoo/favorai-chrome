---
objective: "Permettre de sauvegarder localement l’arbre des favoris, de l’exporter, de le comparer à l’état courant et de le restaurer séquentiellement avec confirmation et erreurs visibles."
status: in-progress
---

# Plan: Snapshots de favoris et restauration complète

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Ajouter des snapshots locaux complets, un export téléchargeable, une capture automatique avant `apply`, puis une prévisualisation et une restauration contrôlée. |
| **Source** | [GitHub issue #12](https://github.com/waewoo/favorai-chrome/issues/12) |

## Phases

| # | Phase | File |
| --- | --- | --- |
| 1 | Contrat local et capture automatique | [`phase-1.md`](./phase-1.md) |
| 2 | Export, diff et interface de prévisualisation | [`phase-2.md`](./phase-2.md) |
| 3 | Restauration séquentielle et tests | [`phase-3.md`](./phase-3.md) |

## Resources

| Source | Verified |
| ------ | -------- |
| https://github.com/waewoo/favorai-chrome/issues/12 | Objectif « bookmark snapshots and full restore » et périmètre demandé vérifiés le 2026-07-25 |

## Decisions

| Decision | Why |
| -------- | ----- |
| Conserver les snapshots dans `chrome.storage.local`, séparés de `reorgHistory` | Les snapshots sont un état local de récupération et ne doivent contenir ni secrets ni configuration provider. |
| Représenter un snapshot par un arbre complet sérialisable avec métadonnées de favoris uniquement | Les IDs Chrome peuvent changer lors d’une recréation ; le diff et la restauration doivent pouvoir remapper les nœuds. |
| Réutiliser les mutations séquentielles et le reporting d’erreurs de `apply.js` | La restauration doit rester réversible, explicite en cas d’échec et cohérente avec les garde-fous existants. |
