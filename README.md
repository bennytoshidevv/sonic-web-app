# Super Sonic Delivery

Capstone web app for Sonic, a local food delivery company in Sipocot, Philippines.
Sonic has no kitchen: it delivers orders from many partner restaurants, and riders buy the food at the stores.

Stack: PERN – PostgreSQL, Express, React (Vite + Tailwind CSS v4), Node.

| Folder | What it is |
|---|---|
| `frontend/` | The React app for customers, riders, operators and the admin. See `frontend/README.md` for links and demo accounts. |
| `backend/` | The Express + PostgreSQL API. See `backend/README.md` for setup and the API list. |
| `docs/erd/` | The original ERD export (v6, MySQL), kept for reference. The current schema is `backend/db/schema.sql`. |

## Run it

```
npm run install:all      # installs frontend/ and backend/

npm run dev:frontend     # http://localhost:5173
npm run dev:backend      # http://localhost:4000 (needs PostgreSQL and backend/.env, see backend/README.md)

npm run build            # builds the frontend
npm test                 # backend tests (needs a seeded database: cd backend && npm run db:reset)
```

All demo accounts use the password `sonic1234`.
