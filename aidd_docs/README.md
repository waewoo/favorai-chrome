# Project AI Docs

Structured context the AI assistant reads at the start of a session, so it does not rediscover the project each time. AIDD generates and keeps this folder in sync.

## What lives here

- `memory/`: the project memory bank loaded each session. See [`memory/README.md`](memory/README.md).
- `GUIDELINES.md`: how this team works with AI on this project.
- `CONTRIBUTING.md`: how to change the AI context safely.
- `tasks/`: specs, plans, and run summaries, created as work happens.

## The framework

AIDD ships skills, agents, rules, and generators as a plugin marketplace. For the full catalog and workflow, see <https://github.com/ai-driven-dev/framework>.

