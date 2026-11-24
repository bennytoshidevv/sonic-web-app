# Prompt: finish Super Sonic Delivery (paste this into Claude Code)

You are helping me finish my capstone, **Super Sonic Delivery**: a food delivery web app for Sonic, a local
delivery company in Sipocot, Philippines. Sonic has no kitchen; it delivers orders from many partner
restaurants, and riders buy the food at the stores.

**Stack:** PERN – PostgreSQL 16, Express 5, React 19 + Vite + Tailwind CSS v4, Node. Plain JavaScript (no TypeScript).
**Deadline:** end of November 2026. Today's work must move us toward a working demo.
**Audience:** this is a student project we must explain in a presentation. Explain every decision in
beginner-friendly language and keep the code simple.

---

## 1. First, check where we are (read only, change nothing)

Run `git status`, `git branch`, `git log --oneline -5` and list the top-level folders. Then tell me which of
these situations we are in:

- **A. Restructure not finished:** the React app is still at the repo root (`src/`, `package.json`, ...) and the
  backend is in `server/`. → Do **Task 1** first.
- **B. Restructure finished:** the repo has `frontend/`, `backend/` and `docs/erd/`. → Go to **Task 2**.

Also check: is a Vite dev server running on port 5173 from the old root (it locks `src/` and makes `git mv`
fail)? Is PostgreSQL running, and does `backend/.env` (or `server/.env`) exist?
If something must be stopped or installed, tell me the exact command and let me run it.

---

## 2. Task 1 – Finish the restructure (branch `restructure-frontend-backend`)

Goal: two folders, `frontend/` and `backend/`, **without changing how the app behaves**. Move-and-fix-paths only.

Target tree:
```
frontend/   src/ public/ stitch-exports/ index.html vite.config.js jsconfig.json .oxlintrc.json
            package.json package-lock.json DESIGN.md CLAUDE.md README.md
backend/    (the old server/) db/ scripts/ src/ test/ package.json package-lock.json .env.example README.md CLAUDE.md
docs/erd/   SonicDelivery_ERD_v6_MySQL.sql
README.md   CLAUDE.md   package.json (scripts via npm --prefix)   .gitignore
```

Steps:
1. Use `git mv` for every move (history must show renames, not delete + add).
2. Path fixes that may already be made in the working tree (check with `git diff` before redoing them):
   `seed.js` reads `../../frontend/src`; `server/` → `backend/` in messages, comments, `.env.example`,
   `schema.sql` and the backend README; frontend `CLAUDE.md` points to `../backend/db/schema.sql` (ERD v7) and
   `../docs/erd/`, and uses `src/shared/utils/format.js`, `src/shared/utils/calc.js`, `src/shared/assets/logo.jpg`;
   `.gitignore` ignores `.env`, `.env.*` (not `.env.example`) and `backend/uploads/`.
3. Add the short root `README.md`, `CLAUDE.md` and `package.json` (`install:all`, `dev:frontend`,
   `dev:backend`, `build`, `test`).
4. Delete `dist/` and `node_modules/`, then `npm install` in each folder.
5. Create `backend/.env` from `.env.example` (local DB: `postgres://sonic:sonic@localhost:5432/sonic`,
   a random `JWT_SECRET`). Never commit it.
6. Verify and show me the output: frontend `npm run build` + `npm run lint`; dev server loads `/`,
   `/customer/login`, `/operator`; backend `npm run db:reset && npm test`; `git status` shows renames;
   search for leftover old paths (`server/`, `../../src`, `src/lib/`, the ERD file at the root).
7. Commit on the branch. **Don't push or merge.** Show me the final tree (2 levels), the files whose
   content changed and why, and anything you were unsure about.

---

## 3. Task 2 – Build the backend, one module at a time (branch `backend`)

Before coding, read `backend/CLAUDE.md` (the backend rules), `backend/README.md`, `backend/db/schema.sql`,
everything in `backend/src`, and the parts of `frontend/src/mock/mock.js` for the module you are building,
plus the pages that call those functions.

### The most important rule
`frontend/src/mock/mock.js` **is the spec.** Each exported function = one endpoint with the **same response
shape**, the **same error codes** (sent as `{ error: '<code>', message }`) and the **same business rules**.
The one difference: the API never trusts user ids from the request; the acting user always comes from the
JWT (`req.user`). If the mock and these instructions disagree, stop and ask me.

### For every module
1. Build the routes in `backend/src/modules/<name>/<name>.routes.js` (+ `<name>.service.js` only for big logic).
2. Add `backend/test/<name>.test.js`: happy path, wrong role, someone else's data, each error code.
3. Run `npm run db:reset && npm test` and show me the results.
4. Update the API table in `backend/README.md`.
5. Commit the module on its own. Summarize what you built, the test results and anything left out.
   **Wait for my OK before the next module.**

### Modules, in order (★ = needed for the demo)
| # | Module | Mock functions |
|---|---|---|
| 1 ★ | Catalog | `getBarangays`, `getCuisineTypes`, `getRestaurants`, `getRestaurant`, `getMenu`, `getRestaurantReviews`, `getRateSettings`, `isFavoriteRestaurant`, `setFavoriteRestaurant`, `getCartItemDetails` |
| 2 ★ | Customer addresses | `getCustomerAddresses`, `addCustomerAddress`, `updateCustomerAddress`, `setDefaultAddress`, `deleteCustomerAddress` |
| 3 ★ | Customer orders + reviews | `placeOrder`, `getCustomerOrders`, `getOrderDetails`, `cancelOrder`, `getOrderReviews`, `submitOrderReviews`, `getRiderReviews` |
| 4 ★ | Operator orders + riders | `getLiveOrders`, `getOrderForStaff`, `advanceOrderByStaff`, `rejectOrderByStaff`, `getRidersOverview`, `assignRider` |
| 5 ★ | Rider | `getRiderDashboard`, `startShift`, `endShift`, `setRiderAvailability`, `getRiderDeliveries`, `acceptAssignment`, `rejectAssignment`, `advanceDelivery`, `getRiderDeliveryDetails`, `recordPettyPurchase`, `getRiderHistory`, `getRiderWallet` |
| 6 ★ | Operator management | restaurants, menus, users and approvals (`getRestaurantsForStaff` … `getUserNames`) |
| 7 ★ | Settlement | `getShiftsOnDate`, `recordSettlement`, `addPettyCashTransaction` |
| 8 ★ | Admin | `getReportData`, `getSettingsData`, `saveBarangay`, `saveGasTiers`, `saveDeductionType`, `addRateSetting`, `getSavingsOverview`, `recordSavingsWithdrawal` |
| 9 | Notifications | no mock function and no page yet – ask me before building a page |
| 10 | PayMongo sandbox | Checkout Session for gcash/maya/qr_ph/card + signed webhook; COD must keep working without it |

Decisions already made:
- Module 1: keep the mock's response shape (no extra `average_rating` field; pages compute it from reviews).
  Catalog reads are public; favorites need a customer login. Copy `frontend/src/shared/utils/calc.js` into
  `backend/src/utils/calc.js` with the same function names.
- The cart stays in the frontend (`CartContext`); checkout sends item ids and quantities. Ask before using `cart_items`.

---

## 4. Task 3 – Connect the frontend (after modules 1–8 pass)

1. `frontend/src/api/client.js`: base URL from `VITE_API_URL`, adds `Authorization: Bearer <token>`, turns
   error responses into `{ error }` like the mock functions.
2. `frontend/src/api/index.js`: **the same function names and return shapes as `mock.js`.**
3. Switch pages from `@mock/mock` to the API **one role at a time** (customer → rider → operator → admin) and
   test each role in the browser with the demo accounts (password `sonic1234`).
4. `AuthContext`: save `{ token, user }` in sessionStorage; call `GET /api/auth/me` on load.
5. Keep `mock.js` (the seed script uses it). Ask before changing a page beyond its import line and the id
   arguments it no longer needs.

## 5. Task 4 – Deployment (only after I say so)
Cloud SQL for PostgreSQL, the API on Cloud Run, photos with `UPLOAD_DRIVER=gcs`, the frontend on Firebase Hosting
or Cloud Run. Write the steps in `backend/README.md`.

---

## 6. Rules for working with me
- Explain decisions simply; I must defend them in the presentation.
- Don't invent requirements. If `mock.js`, `schema.sql` and this prompt don't answer something, ask me.
- Ask before: adding an npm package, changing `db/schema.sql`, changing a page's behavior, building features
  not in `frontend/DESIGN.md` or the ERD (no dark mode, maps, chat, vouchers or push notifications).
- Never commit `.env` or keys. **Never push or merge unless I ask.**
- Open questions I still have to answer (don't decide them for me): refunds for rejected online-paid orders;
  a "declined" status for rejected rider/operator applications; whether the operator "Delivered today" filter
  shows today only.

**Start with section 1 and report what you find.**
