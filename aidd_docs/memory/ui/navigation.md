# Navigation

## Routing

- There is no client router. The popup switches between panels by toggling classes in `src/popup/navigation.js`.
- The popup remembers the active tab in `chrome.storage.local`.

## Structure

```mermaid
flowchart LR
    A[Main view] --> B[Validation view]
    A --> C[Config tab]
    A --> D[History tab]
    A --> E[Forgotten tab]
    A --> F[Docs tab]
    A --> G[About tab]
```

