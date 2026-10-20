# SongDisplay — Vite + React + Tailwind (Preview)

This is a frontend preview project for the SongDisplay app (Control + Display pages).
It uses **mocked data** and a **mock realtime emitter** so you can run and test the UI.

## Quick start

1. Install dependencies:
```bash
npm install
```

2. Start dev server:
```bash
npm run dev
```

3. Open:
- Controller: http://localhost:5173/#control
- Display: http://localhost:5173/#display

## Notes

- The project uses mock data in `src/api/mockApi.js`. Replace those calls with your backend endpoints.
- The app is prepared for realtime updates: the mock realtime emitter is in `src/hooks/useRealtime.js`. Replace it with a real WebSocket or Server-Sent Events client that listens to your backend.
- The backend should implement endpoints such as:
  - `GET /api/categories`
  - `GET /api/songs?category=...`
  - `GET /api/songs/:id`
  - `POST /api/psalm/load`
  - `GET/POST /api/state`
  - and a WebSocket/SSE stream to broadcast state changes.

## Deploying backend on Synology NAS

We recommend packaging the backend as a Docker container. If you want, I can prepare:
- `backend/` Express + ws + scraper
- `Dockerfile` for backend
- Compose file to run backend + (optional) Caddy or nginx reverse proxy
