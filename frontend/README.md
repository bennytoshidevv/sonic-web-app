# Super Sonic Delivery – Frontend

React + Vite + Tailwind CSS v4. See `CLAUDE.md` and `DESIGN.md` for project rules.
Run these commands inside the `frontend/` folder (the API is in `../backend`).

```
cd frontend
npm install
npm run dev     # http://localhost:5173 (start the backend first)
npm run build
```

## Links per role

| Role | Section | Login | Sign up |
|---|---|---|---|
| Everyone | `/` (welcome page: choose how to continue) | | |
| Customer | `/customer` | `/customer/login` | `/customer/register` (active right away) |
| Rider | `/rider` | `/rider/login` | `/rider/apply` (needs an operator's approval) |
| Operator | `/operator` | `/operator/login` | `/operator/apply` (needs the admin's approval) |
| Admin | `/admin` (Reports, Rider savings, Settings + all operator pages) | `/admin/login` | none |

## Demo accounts

All demo accounts use the password `sonic1234` (stored in the database as bcrypt hashes).
The demo data comes from `src/mock/mock.js`: the backend's `npm run db:reset` loads it into PostgreSQL. The pages themselves
use the real API (`src/api/`).

| Email | Role | Goes to |
|---|---|---|
| customer@sonic.ph | customer | /customer |
| liza@sonic.ph | customer (owns the rider's demo deliveries) | /customer |
| rider@sonic.ph | rider (Marcelo: open shift, on a delivery) | /rider |
| carlo@sonic.ph | rider (Carlo: available; yesterday's shift waits for settlement) | /rider |
| operator@sonic.ph | operator | /operator |
| admin@sonic.ph | admin | /admin (can also open /operator) |
| suspended@sonic.ph | rider (suspended) | shows "Account suspended" |
| ramon@sonic.ph | rider application (inactive) | shows "Account not active yet" |

New accounts, applications, orders and other changes are saved in the database, so they are still there after a refresh.
Only `npm run db:reset` (in `backend/`) erases them. Staff changes (suspensions, menu and price edits, restaurant edits)
are also written to the `audit_logs` table. The cart is kept in the browser tab until checkout.
