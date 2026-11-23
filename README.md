# Super Sonic Delivery – Frontend

React + Vite + Tailwind CSS v4. See `CLAUDE.md` and `DESIGN.md` for project rules.

```
npm install
npm run dev     # http://localhost:5173
npm run build
```

## Demo accounts (mock data)

All mock accounts use the password `sonic1234`. Only its SHA-256 hash is stored in `src/data/mock.js`.

| Email | Role | Goes to |
|---|---|---|
| customer@sonic.ph | customer | /customer |
| rider@sonic.ph | rider | /rider |
| operator@sonic.ph | operator | /operator |
| admin@sonic.ph | admin | /admin (can also open /operator) |
| suspended@sonic.ph | rider (suspended) | shows "Account suspended" |

New customers created on `/register` are kept in memory only and are lost on page refresh.
