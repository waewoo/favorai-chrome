# memory/ - Project Memory

Structured context the AI assistant reads at the start of a session, so it does not rediscover the project each time.

## How it loads

- The files at the root of `memory/` are referenced by the `<aidd_project_memory>` block in the AI context file and load every session.
- `internal/` and `external/` are listed there too, but load on demand, only when relevant.

## Files

- `core/project-brief.md`
- `core/architecture.md`
- `core/codebase-map.md`
- `core/coding-assertions.md`
- `core/testing.md`
- `core/vcs.md`
- `ui/design.md`
- `ui/forms.md`
- `ui/navigation.md`

## How to maintain it

- One file per concern.
- Capture the macro and the non-derivable. Point to the code, do not copy it.
- Keep each file small, well under 200 lines.
- Update a file when the underlying reality changes.
- Current state only. Never personal notes or future TODOs.

## Subdirectories

- `internal/`: AIDD workflow traces, audit notes, and learn captures.
- `external/`: external references the project pulls in.

