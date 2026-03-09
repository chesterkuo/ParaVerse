# ParaVerse — Project Configuration

## Project Overview
B2B multi-agent simulation platform with dual engines (OASIS + Concordia).

## Tech Stack
- Backend: Bun + Hono + TypeScript
- Frontend: React 19 + Vite 7 + TailwindCSS v4
- Database: PostgreSQL 17 + pgvector
- Cache: Redis 7
- Simulation: Python 3.12 (OASIS via camel-oasis, Concordia via concordia)
- LLM: OpenAI SDK compatible mode → Gemini 2.5 Flash

## Commands
- Backend dev: `cd backend && bun run src/index.ts`
- Backend test: `cd backend && bun test`
- Frontend dev: `cd frontend && bun run dev`
- Frontend build: `cd frontend && bun run build`
- DB migrate: `cd backend && bun run src/db/migrate.ts`
- Docker up: `docker compose up -d`

## Conventions
- All code in English (comments, variables, commits)
- Raw SQL with pg client (no ORM)
- Shared types in `shared/types/`
- API response format: `{ success, data, error, meta }`
- Cursor-based pagination
- Async tasks return `task_id`, polled via `/tasks/:id/status`
- WebSocket auth via `?token=` query parameter
- Python IPC: stdin/stdout JSONL between Bun and Python subprocesses
- Lazy getter pattern for services: `private get svc() { return getSvc(); }`
