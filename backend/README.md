# Super Sonic Delivery – Backend

Express 5 + PostgreSQL. Plain parameterized SQL through `pg` (no ORM), bcrypt passwords, JWT login.

## Run it locally

1. Install PostgreSQL 16 and create a database:
   ```
   createuser -P sonic          # password: sonic
   createdb -O sonic sonic
   ```
2. Set up the server:
   ```
   cd backend
   cp .env.example .env         # then edit DATABASE_URL / JWT_SECRET if needed
   npm install
   npm run db:reset             # creates all tables, then loads the demo data
   npm run dev                  # http://localhost:4000/api/health
   ```
3. Run the tests (needs the seeded database): `npm test`

`db:reset` wipes the database. The demo orders and shifts are dated "today", so run it again before a demo.

## Database

- `db/schema.sql` – the ERD v7 in PostgreSQL (same design as `../docs/erd/SonicDelivery_ERD_v6_MySQL.sql`, plus
  `favorite_restaurants`, CHECK constraints and partial unique indexes for rules like
  "one open shift per rider" and "one primary store per order").
  To view it in dbdiagram.io: **Import → PostgreSQL** and paste the file.
- `scripts/seed.js` – loads the dummy data straight from the frontend's `frontend/src/mock/mock.js`,
  so there is only one copy of the demo data. All demo accounts use the password `sonic1234`
  (stored as bcrypt hashes). Mock reviews for orders 1–6 are skipped because those orders don't exist.

## API so far

All responses are JSON. Errors look like `{ "error": "email_taken", "message": "..." }` and use the same
error codes as the mock functions, so the pages' error handling keeps working.
Protected routes need the header `Authorization: Bearer <token>`.
An id in the path or query that is not a positive whole number gives 400 `invalid_id`.

| Method | Path | Who | Body → Response |
|---|---|---|---|
| GET | `/api/health` | anyone | → `{ ok }` |
| POST | `/api/auth/login` | anyone | `{ email, password }` → `{ token, user }`; errors `invalid`, `suspended`, `inactive` |
| POST | `/api/auth/register` | anyone | `{ full_name, email, contact_number, password }` → `{ token, user }` (customer, active) |
| POST | `/api/auth/apply` | anyone | `{ role: rider\|operator, ..., vehicle_type?, plate_number? }` → `{ ok }` (inactive until approved) |
| GET | `/api/auth/me` | logged in | → `{ user }` |
| PATCH | `/api/auth/me` | logged in | `{ full_name, email, contact_number }` → `{ user }` |
| POST | `/api/auth/change-password` | logged in | `{ current_password, new_password }` → `{ ok }`; error `wrong_password` |
| POST | `/api/uploads/:folder` | operator, admin | multipart field `photo` (JPG/PNG/WEBP, ≤ 2 MB); folder `restaurants` or `menu-items` → `{ url }` |
| **Catalog** (module 1) | | | |
| GET | `/api/barangays` | anyone | → active barangays (`getBarangays`) |
| GET | `/api/cuisine-types` | anyone | → `[{ cuisine_id, cuisine_name }]` (`getCuisineTypes`) |
| GET | `/api/restaurants` | anyone | → active restaurants, each with `cuisines` (names) and `hours` (`getRestaurants`) |
| GET | `/api/restaurants/:id` | anyone | → one active restaurant; 404 `not_found` if missing or disabled (`getRestaurant`) |
| GET | `/api/restaurants/:id/menu` | anyone | → active categories in display order, each with active `items` incl. sold out (`getMenu`) |
| GET | `/api/restaurants/:id/reviews` | anyone | → review rows (`getRestaurantReviews`) |
| GET | `/api/rate-settings/current` | anyone | → latest rate with `effective_from <= now()` (`getRateSettings`) |
| GET | `/api/menu-items?ids=1,2,3` | anyone | → items with `restaurant: { restaurant_id, name, description, open_status, is_active }` (`getCartItemDetails`); error `too_many_items` (> 100) |
| GET | `/api/restaurants/:id/favorite` | customer | → `{ favorite }` for the logged-in customer (`isFavoriteRestaurant`) |
| PUT | `/api/restaurants/:id/favorite` | customer | `{ liked: true|false }` → `{ ok }`; errors `invalid_liked`, 404 for a disabled restaurant (`setFavoriteRestaurant`) |

## Folder structure

```
backend/
  db/schema.sql
  scripts/        run-sql.js, seed.js
  src/
    index.js      starts the server
    app.js        builds the Express app and mounts each module's router
    config.js     reads .env
    db.js         connection pool, query(), withTransaction()
    middleware/   auth.js (requireAuth, requireRole), errors.js
    utils/        validate.js, audit.js, calc.js (copy of frontend/src/shared/utils/calc.js)
    modules/
      auth/       auth.routes.js
      catalog/    catalog.routes.js
      uploads/    uploads.routes.js, storage.js (local or Google Cloud Storage)
  test/           helpers.js (starts the API for tests), <module>.test.js
```

## Security rules followed everywhere

- Values always go in as query parameters (`$1, $2`), never pasted into SQL (prevents SQL injection).
- The user id comes from the login token, never from the request, so a customer can't read another
  customer's data by changing an id.
- The account is re-checked on every request, so suspending a user locks them out right away.
- `password_hash` is never sent to the browser. Login gives the same error for "no such email" and
  "wrong password".
- Saves that touch several tables run in one transaction (all or nothing).
- Users, restaurants and menu items are never hard-deleted (soft delete via status / `is_active`).

## Photo uploads in production

Set `UPLOAD_DRIVER=gcs` and `GCS_BUCKET=<bucket>`. The bucket must allow public reads of objects
(`allUsers` → Storage Object Viewer) and the Cloud Run service account needs Storage Object Creator.
