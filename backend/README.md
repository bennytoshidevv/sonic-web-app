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
3. Run the tests (needs the seeded database): `npm test`. Test files run one at a time because some
   tests briefly change shared demo rows (e.g. hide a barangay) and put them back.

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
| GET | `/api/restaurants` | anyone | → active restaurants, each with `cuisines` (names), `hours`, `open_status`, and `average_rating` + `review_count` calculated in SQL (`getRestaurants`) |
| GET | `/api/restaurants/:id` | anyone | → one active restaurant (same fields); 404 `not_found` if missing or disabled (`getRestaurant`) |
| GET | `/api/restaurants/:id/menu` | anyone | → active categories in display order, each with active `items` incl. sold out; 404 `not_found` if missing or disabled (`getMenu`) |
| GET | `/api/restaurants/:id/reviews` | anyone | → review rows; 404 `not_found` if missing or disabled (`getRestaurantReviews`) |
| GET | `/api/rate-settings/current` | anyone | → latest rate with `effective_from <= now()` (`getRateSettings`) |
| GET | `/api/menu-items?ids=1,2,3` | anyone | → items with `restaurant: { restaurant_id, name, description, open_status, is_active }` (`getCartItemDetails`); error `too_many_items` (> 100) |
| GET | `/api/restaurants/:id/favorite` | customer | → `{ favorite }` for the logged-in customer (`isFavoriteRestaurant`) |
| PUT | `/api/restaurants/:id/favorite` | customer | `{ liked: true|false }` → `{ ok }`; errors `invalid_liked`, 404 for a disabled restaurant (`setFavoriteRestaurant`) |
| **Customer addresses** (module 2) | | | Own addresses only; someone else's address → 404 `not_found` |
| GET | `/api/addresses` | customer | → my active addresses with `barangay_name`, `city_municipality`, `delivery_fee` (`getCustomerAddresses`) |
| POST | `/api/addresses` | customer | `{ label, barangay_id, street_address, landmark, is_default }` → the new address (first one becomes default); errors `missing_fields`, `invalid_barangay`, `too_long` (`addCustomerAddress`) |
| PUT | `/api/addresses/:id` | customer | same body → `{ ok }` (`updateCustomerAddress`) |
| PUT | `/api/addresses/:id/default` | customer | → `{ ok }` (`setDefaultAddress`) |
| DELETE | `/api/addresses/:id` | customer | → `{ ok }`; soft delete, the oldest remaining address becomes default (`deleteCustomerAddress`) |
| **Customer orders + reviews** (module 3) | | | Own orders only; someone else's order → 404 `not_found` |
| POST | `/api/orders` | customer | `{ address_id, lines: [{ item_id, quantity }], payment_method, order_notes }` → `{ order }`. Prices, fees and total are computed by the API; the first line's store is the primary store. Errors: 409 `unavailable` (sold out / closed / disabled), `empty_cart`, `invalid_quantity` (1–99), `duplicate_item`, `invalid_payment_method`, `invalid_address` (`placeOrder`) |
| GET | `/api/orders` | customer | → my orders, newest first: `[{ order, stores, history, payment, rider, reviews }]` (`getCustomerOrders`) |
| GET | `/api/orders/:id` | customer | → `{ order, stores, history, payment, rider }` (`getOrderDetails`) |
| POST | `/api/orders/:id/cancel` | customer | `{ reason }` → `{ order }`; only while `pending`, else 409 `not_cancellable`. A paid online payment gets a pending `refunds` row (`cancelOrder`) |
| GET | `/api/orders/:id/reviews` | customer | → `{ restaurantReviews, riderReview }` (`getOrderReviews`) |
| POST | `/api/orders/:id/reviews` | customer | `{ restaurantRatings: [{ restaurant_id, rating, comment }], riderRating }` → `{ ok }`; errors 409 `not_delivered`, 409 `already_rated`, 400 `invalid` (`submitOrderReviews`) |
| GET | `/api/riders/:id/reviews` | logged in | → reviews of the rider's completed deliveries (`getRiderReviews`) |
| **Operator orders + riders** (module 4) | | | Operator and admin only |
| GET | `/api/staff/orders` | operator, admin | → every order, newest first: `{ order, stores (+ address, contact_number), history (+ changed_by_name), payment, rider, customer, delivery, assignments, currentAssignment }` (`getLiveOrders`) |
| GET | `/api/staff/orders/:id` | operator, admin | → one order, same shape; 404 `not_found` (`getOrderForStaff`) |
| POST | `/api/staff/orders/:id/advance` | operator, admin | → `{ order }`: pending → confirmed → preparing → ready_for_pickup; else 409 `not_allowed`, or 409 `payment_required` when confirming an unpaid online order. Notifies the customer (`advanceOrderByStaff`) |
| POST | `/api/staff/orders/:id/reject` | operator, admin | `{ reason }` → `{ order }`; until ready_for_pickup (409 `not_allowed`), 400 `reason_required`. Ends the assignment (rider freed), pending refund if paid online, notifies customer + rider (`rejectOrderByStaff`) |
| POST | `/api/staff/orders/:id/assign` | operator, admin | `{ rider_id }` → `{ ok }`; 409 `not_assignable` (not confirmed yet / picked up), 409 `rider_unavailable`. Reassigning ends the old assignment. Notifies the rider (`assignRider`) |
| GET | `/api/staff/riders` | operator, admin | → `[{ user, profile, openShift, deliveriesThisShift, pettyCash, jobs, reviews }]` (`getRidersOverview`) |
| **Rider** (module 5) | | | Riders only, always the logged-in rider; another rider's delivery → 404 |
| GET | `/api/rider/dashboard` | rider | → `{ profile, shift, hasShiftToday, deliveries, deductions, pettyCash, activeDelivery }` (`getRiderDashboard`) |
| POST | `/api/rider/shift/start` | rider | → `{ shift }`; charges per-shift deductions (+ savings deposit), rider available; 409 `already_open`, `already_today` (`startShift`) |
| POST | `/api/rider/shift/end` | rider | → `{ shift }`; rider offline; 409 `no_open_shift`, `delivery_in_progress` (`endShift`) |
| PUT | `/api/rider/availability` | rider | `{ availability_status }` → `{ ok }`; 400 `invalid_status`, 409 `no_open_shift` (`setRiderAvailability`) |
| GET | `/api/rider/deliveries` | rider | → `{ pending, active, shiftIsOpen, availability, tiers, rate }` (`getRiderDeliveries`) |
| POST | `/api/rider/assignments/:id/accept` | rider | → `{ ok }`; rider busy; 404 `not_found`, 409 `no_open_shift` (`acceptAssignment`) |
| POST | `/api/rider/assignments/:id/reject` | rider | → `{ ok }`; assignment ends as rejected; 404 `not_found` (`rejectAssignment`) |
| POST | `/api/rider/deliveries/:orderId/advance` | rider | → `{ order }`: ready_for_pickup → picked_up → on_the_way → delivered. Delivered = COD paid + pay snapshot + per-delivery deductions + assignment completed + rider free. 404 `not_assigned`, 409 `not_ready`, `no_open_shift` (`advanceDelivery`) |
| GET | `/api/rider/deliveries/:orderId` | rider | → order + `{ assignment, earning, shiftPettyCash, orderPurchases, shiftIsOpen, tiers, rate }` (`getRiderDeliveryDetails`) |
| POST | `/api/rider/deliveries/:orderId/purchases` | rider | `{ amount }` → `{ ok }`; 404 `not_assigned`, 409 `no_open_shift`, 400 `invalid_amount`, 409 `not_enough` (`recordPettyPurchase`) |
| GET | `/api/rider/history` | rider | → `[{ shift, runs, deductions, settlement, pettyCash }]`, newest first (`getRiderHistory`) |
| GET | `/api/rider/wallet` | rider | → `{ shift, pettyCash, savings, savingsPerShift }` (`getRiderWallet`) |
| **Operator management** (module 6) | | | Operator and admin only; every change is written to `audit_logs` |
| GET | `/api/staff/restaurants` | operator, admin | → every restaurant (disabled too) with `cuisines`, `cuisine_ids`, `hours` (`getRestaurantsForStaff`) |
| POST | `/api/staff/restaurants` | operator, admin | `{ name, description, address, contact_number, cuisine_ids, hours: [{ day_of_week, open_time, close_time }], logo_url? }` → `{ restaurant }` (starts closed); 400 `invalid` (`saveRestaurant`) |
| PUT | `/api/staff/restaurants/:id` | operator, admin | same body → `{ restaurant }` (`saveRestaurant`) |
| PUT | `/api/staff/restaurants/:id/open-status` | operator, admin | `{ open_status }` → `{ ok }` (`setRestaurantOpenStatus`) |
| PUT | `/api/staff/restaurants/:id/active` | operator, admin | `{ is_active }` → `{ ok }`; disabling also closes it (`setRestaurantActive`) |
| GET | `/api/staff/menus/:restaurantId` | operator, admin | → all categories in display order with active items (`getMenuForStaff`) |
| POST | `/api/staff/menus/:restaurantId/categories` | operator, admin | `{ category_name }` → `{ category }` (added last); 409 `duplicate` (`saveMenuCategory`) |
| PUT | `/api/staff/menus/categories/:id` | operator, admin | `{ category_name }` → `{ category }` (`saveMenuCategory`) |
| POST | `/api/staff/menus/categories/:id/move` | operator, admin | `{ direction: -1|1 }` → `{ ok }` (audited); 409 `edge` (`moveMenuCategory`) |
| POST | `/api/staff/menus/items` | operator, admin | `{ menu_category_id, name, description, price, is_available, photo_url? }` → `{ item }`; 400 `invalid` (`saveMenuItem`) |
| PUT | `/api/staff/menus/items/:id` | operator, admin | same body → `{ item }`; old and new price in the audit log (`saveMenuItem`) |
| PUT | `/api/staff/menus/items/:id/availability` | operator, admin | `{ is_available }` → `{ ok }` (`setMenuItemAvailable`) |
| POST | `/api/staff/menus/items/:id/archive` | operator, admin | → `{ ok }`; soft delete (`archiveMenuItem`) |
| GET | `/api/staff/users/customers` | operator, admin | → `[{ user, order_count, delivered_count, total_spent }]` (`getCustomersForStaff`) |
| GET | `/api/staff/users/operators` | operator, admin | → operator users (`getOperatorsForStaff`) |
| POST | `/api/staff/users/riders` | operator, admin | `{ full_name, email, contact_number, password, vehicle_type, plate_number }` → `{ user }` (active); 409 `email_taken` (`createRiderAccount`) |
| PUT | `/api/staff/users/:id/status` | operator, admin | `{ account_status, reason }` → `{ ok }`; operators manage riders + customers, only the admin manages operators, nobody changes the admin or their own account: 403 `not_allowed`; 400 `invalid_status` (`setAccountStatus`) |
| GET | `/api/staff/users/:id/latest-change` | operator, admin | → latest audit row about the user, or null (`getLatestAccountChange`) |
| GET | `/api/staff/users/names?ids=1,2` | operator, admin | → `{ "1": "name", ... }`, unknown = 'System' (`getUserNames`) |
| **Settlements** (module 7) | | | Operator and admin only |
| GET | `/api/staff/shifts?date=YYYY-MM-DD` | operator, admin | → shifts that started that day: `[{ shift, runs, deductions, settlement, pettyCash, rider, profile, money }]`; `money = { gross, deductions, net, cod, toRemit, toPayRider, pettyOnHand }` is calculated with calc.js on every read (never stored); 400 `invalid_date` (`getShiftsOnDate`) |
| POST | `/api/staff/shifts/:id/settlement` | operator, admin | `{ cash_received, payout_method, payout_reference, notes, return_petty_cash }` → `{ ok }`. The payout is computed by the API (`settlementAmounts`). 409 `shift_not_closed`, `already_settled`; 400 `reference_required` (GCash payout), `invalid` (`recordSettlement`) |
| POST | `/api/staff/shifts/:id/petty-cash` | operator, admin | `{ txn_type: cash_issued|gcash_topup|cash_returned|adjustment, amount, gcash_reference_id, note }` → `{ ok }`; 400 `invalid_type`, `invalid_amount`, `reference_required`; 409 `not_enough`, `already_settled` (`addPettyCashTransaction`) |
| **Admin** (module 8) | | | The admin only (operators get 403); every settings change is written to `audit_logs` |
| GET | `/api/admin/reports?from=YYYY-MM-DD&to=YYYY-MM-DD` | admin | → `{ orders (staff view + earning), riders, deductions (+ type), summary }` (`getReportData`). `summary` (only with from/to) is computed in SQL from the orders placed in the range: `totals` (orders, delivered, cancelled, sales, delivery_fees, fee_share, rider_fees, sonic_income), `perRestaurant`, `topItems` (top 8), `riders` (delivered, gross_pay, avg_minutes, rating), `payments` (every method). 400 `invalid_date` |
| GET | `/api/admin/settings` | admin | → `{ barangays, tiers (active), deductionTypes, rates (+ created_by_name, state: upcoming|active|superseded) }` (`getSettingsData`) |
| POST / PUT | `/api/admin/barangays`, `/api/admin/barangays/:id` | admin | `{ barangay_name, city_municipality, delivery_fee, is_active }` → `{ barangay }`; 400 `invalid`, 409 `duplicate` (`saveBarangay`) |
| PUT | `/api/admin/gas-tiers` | admin | `{ tiers: [{ min_delivery_fee, max_delivery_fee (null = no limit), allowance_amount }] }` → `{ ok }`; all replaced in one transaction, old ones kept inactive; 400 `invalid_tiers` with the problem as message (`saveGasTiers`) |
| POST / PUT | `/api/admin/deduction-types`, `/api/admin/deduction-types/:id` | admin | `{ name, amount, frequency, is_rider_savings, is_active }` → `{ deductionType }`; 400 `invalid`, 409 `duplicate` (`saveDeductionType`) |
| POST | `/api/admin/rate-settings` | admin | `{ extra_store_fee, rider_share_pct, effective_from: 'YYYY-MM-DDTHH:MM' }` → `{ rate }` (always a new row; the audit keeps the previous rate as old value); 400 `invalid` (`addRateSetting`) |
| GET | `/api/admin/savings` | admin | → `[{ user, profile, entries (+ shift_date, processed_by_name), lastShift }]` (`getSavingsOverview`) |
| POST | `/api/admin/savings/:riderId/withdrawals` | admin | `{ amount, note }` → `{ entry }` (the audit keeps the balance before and after); 400 `invalid_amount`, `note_required`; 409 `not_enough` (`recordSavingsWithdrawal`) |
| **Notifications** | | | Every role; own notifications only, someone else's → 404 `not_found` |
| GET | `/api/notifications?unread=true` | logged in | → my newest 50: `[{ notification_id, order_id, order_number, type, message, is_read, created_at, read_at }]`; `unread` is optional; 400 `invalid` |
| GET | `/api/notifications/unread-count` | logged in | → `{ count }` |
| PUT | `/api/notifications/:id/read` | logged in | → `{ ok }`; repeating it keeps the first `read_at` |
| PUT | `/api/notifications/read-all` | logged in | → `{ ok, updated }` |
| **Online payments** (module 10) | | | Off (503 `payments_unavailable`) while the PayMongo keys are empty; COD is not affected |
| POST | `/api/payments/orders/:id/checkout` | customer | → `{ checkout_url }` (PayMongo page for my unpaid gcash/maya/qr_ph/card order; an open session is reused). 404 `not_found`; 409 `not_online`, `already_paid`, `not_payable`; 502 `payment_provider_error` |
| POST | `/api/payments/webhook` | PayMongo (signed) | PayMongo event → `{ ok }`; 401 `invalid_signature`. Raw event stored once; `checkout_session.payment.paid` marks the payment paid |

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
    utils/        validate.js, audit.js, notify.js (in-app notifications), calc.js (copy of frontend/src/shared/utils/calc.js)
    modules/
      auth/       auth.routes.js
      catalog/    catalog.routes.js
      addresses/  addresses.routes.js
      orders/     orders.routes.js, orders.service.js (order details queries, checkout transaction)
      dispatch/   dispatch.routes.js (operator: live orders, status, reject, assign rider, riders overview)
      rider/      rider.routes.js, rider.service.js (shifts, deductions, pay snapshots, shift view)
      management/ restaurants.routes.js, menus.routes.js, users.routes.js (operator management)
      settlements/ settlements.routes.js (end-of-shift settlement, petty cash)
      admin/      admin.routes.js (reports, settings, rider savings), reports.service.js (report totals in SQL)
      notifications/ notifications.routes.js (my notifications: list, unread count, mark as read)
      payments/   payments.routes.js, payments.service.js, paymongo.js (the only file that knows PayMongo's format)
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

## Online payments (PayMongo)

Two values go in `backend/.env` (never commit them); restart the backend afterwards:

| Variable | Where to get it (Dashboard in **Test mode**) |
|---|---|
| `PAYMONGO_SECRET_KEY` | Settings > Product Settings > Developers: the **secret** test key `sk_test_...` |
| `PAYMONGO_WEBHOOK_SECRET` | Developers > Webhooks > Add Endpoint: `whsk_...`, shown after saving |

The public key (`pk_test_...`) is not used, because customers pay on PayMongo's own page.

Test the webhook locally. PayMongo needs a public HTTPS address, so use a tunnel to your computer:
1. Start the backend, then in another window: `cloudflared tunnel --url http://localhost:4000`
   (or `ngrok http 4000`). Copy the `https://...` address.
2. Add an endpoint in the Dashboard: `https://<address>/api/payments/webhook`, event `checkout_session.payment.paid`.
3. Put its `whsk_...` secret in `.env` and restart the backend.
4. Place an online order on the site (it opens the PayMongo page) and pay with a test method: card
   `4343434343434345` (any future date, any CVC), or choose **Authorize** for GCash/Maya. For QR Ph use the test
   page; never pay the QR with a real account.
5. Check `payments` (paid) and `payment_webhook_events` (one row, `processed_at` filled). Resend the event from the
   Dashboard: nothing may change.

Without a tunnel you can still test paying with only `PAYMONGO_SECRET_KEY`: after paying, press **Pay now** on the order
once more. The API then asks PayMongo, sees the payment and marks the order paid.

A free tunnel gets a new address each time, so update the endpoint's URL when you restart it. Stop the tunnel when done:
while it runs, your whole API is public.

## Deployment to Google Cloud

**Nothing here has been run yet.** Every command has a number, so each can be approved on its own. Run them in
**PowerShell**, in order, in one window (the variables in D0 are lost when it closes).

```
Browser ──> Firebase Hosting (the React pages)
   └──────> Cloud Run (the API) ──> Cloud SQL (PostgreSQL)
                                └─> Cloud Storage (photos) ──> read directly by the browser
            Secret Manager gives Cloud Run the database URL, JWT secret and PayMongo keys
```

### What costs money

Prices change: check the [calculator](https://cloud.google.com/products/calculator) first. Billing must be on for this setup.
New customers may get a free trial credit (the billing page shows yours).

| Service | Costs | Free part |
|---|---|---|
| **Cloud SQL** `db-f1-micro` | 💰 **The main cost. Charged every second it runs, even with no visitors.** Roughly US$10–15 a month with disk and IP (estimate; about $8 for the machine alone in the US) | None |
| Cloud SQL disk (10 GB) and public IP | 💰 Disk is charged **even while stopped**, and a stopped instance's IP may be too | None |
| Cloud Run | 💰 Only above the free part (`min-instances 0`, so it sleeps when unused) | In Singapore, per month: 2M requests, 128,571 vCPU-seconds, 257,142 GiB-seconds |
| Cloud Build | 💰 Above the free part (one build per deploy) | Daily free minutes (Firebase lists 120) |
| Artifact Registry (API images) | 💰 Above the free part. Every deploy adds an image | 0.5 GB |
| Cloud Storage (photos) | 💰 Cents. Storage, requests and downloads | The always-free 5 GB is for US regions only, **not** Singapore |
| Secret Manager | 💰 Cents above its free part (this guide makes at most 4 secrets) | Check the pricing page |
| Firebase Hosting | 💰 Above the free part | 10 GB stored, 360 MB downloaded per day |
| IAM, service accounts, enabling APIs | Free | |

**Do first, in the Console:** Billing → Budgets & alerts → a US$5 budget with alerts at 50/90/100%.
A budget only sends e-mail. It does **not** stop the charges.

### Settings used

| Setting | Value | Why |
|---|---|---|
| Region | `asia-southeast1` (Singapore) | Near the Philippines. Cloud SQL's region can't be changed later |
| Cloud SQL | PostgreSQL 16, `--edition=ENTERPRISE`, `db-f1-micro`, zonal, 10 GB SSD, no auto-increase, no backups | Cheapest. `ENTERPRISE` must be given: for version 16 the default is the expensive Enterprise Plus. No backups because demo data can be reseeded; **turn them on for real data**. Google says this size is for testing only (no SLA) |
| Cloud SQL network | Public IP, no authorized networks | Only reachable through Google's authenticated connection |
| Cloud Run | 512 MiB, 1 CPU, min 0, max 2 instances | Each instance opens up to 10 database connections, and this small database allows few |
| Cloud Run access | `--allow-unauthenticated` | The website and PayMongo must reach it. Our own JWT login protects the routes |
| Cloud Run identity | `sonic-api` service account | Only what it needs: use Cloud SQL, read its secrets, add photos |
| Bucket | Uniform access, anyone can read a photo but **not list** them | Photos are shown to everyone |

Environment variables of the API:

| Variable | Value | Kind |
|---|---|---|
| `DATABASE_URL` | `postgresql://sonic:<password>@/sonic?host=/cloudsql/<connection name>` | Secret |
| `JWT_SECRET` | new random text (not the local one) | Secret |
| `PAYMONGO_SECRET_KEY`, `PAYMONGO_WEBHOOK_SECRET` | from PayMongo (optional; without them COD works) | Secret |
| `JWT_EXPIRES_IN` | `7d` | Plain |
| `CORS_ORIGIN` | `https://<project>.web.app,https://<project>.firebaseapp.com` | Plain |
| `FRONTEND_URL` | `https://<project>.web.app` | Plain |
| `UPLOAD_DRIVER` | `gcs` | Plain |
| `GCS_BUCKET` | the bucket's name | Plain |
| `PORT` | **do not set**: Cloud Run sets it | |
| `PUBLIC_URL` | not needed with `gcs` | |

The frontend has one: `VITE_API_URL`. It is built **into** the files, so rebuild after changing it, and never put a secret in it.

### D0. Prepare (free)

Install the [Google Cloud CLI](https://cloud.google.com/sdk/docs/install), then create a project in the Console and link billing.
Choose the project id carefully: it becomes the site's address, and hosting links use it.

```powershell
$PROJECT = "your-project-id"
$REGION  = "asia-southeast1"
$BUCKET  = "$PROJECT-photos"
$SA      = "sonic-api@$PROJECT.iam.gserviceaccount.com"
cd "<the repo folder>"
```

| # | Command | Cost |
|---|---|---|
| D0.1 | `gcloud auth login` | Free |
| D0.2 | `gcloud config set project $PROJECT` | Free |
| D0.3 | `gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com sqladmin.googleapis.com secretmanager.googleapis.com storage.googleapis.com` | Free (using them is what costs) |
| D0.4 | `gcloud iam service-accounts create sonic-api --display-name="Sonic API"` | Free |
| D0.5 | `gcloud projects add-iam-policy-binding $PROJECT --member="serviceAccount:$SA" --role="roles/cloudsql.client"` | Free |
| D0.6 | `$NUM = gcloud projects describe $PROJECT --format="value(projectNumber)"` | Free |
| D0.7 | `gcloud projects add-iam-policy-binding $PROJECT --member="serviceAccount:$NUM-compute@developer.gserviceaccount.com" --role="roles/run.builder"` (lets Cloud Build build the API) | Free |

### D1. Files to create first

`backend/.gcloudignore`. **Required:** without it the deploy would upload `backend/.env` with your keys.

```
.env
.env.*
node_modules/
uploads/
test/
cloudrun-env.yaml
```

`backend/cloudrun-env.yaml` (plain settings only, no secrets):

```yaml
JWT_EXPIRES_IN: "7d"
CORS_ORIGIN: "https://your-project-id.web.app,https://your-project-id.firebaseapp.com"
FRONTEND_URL: "https://your-project-id.web.app"
UPLOAD_DRIVER: "gcs"
GCS_BUCKET: "your-project-id-photos"
```

`frontend/firebase.json` (every path opens index.html, so refreshing `/customer/orders` works):

```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  }
}
```

No Dockerfile is needed: Google detects Node and runs `npm start`.

### D2. Database: Cloud SQL

```powershell
$DBPASS = node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"   # hex: safe inside a URL
$ROOTPASS = node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

| # | Command | Cost |
|---|---|---|
| D2.1 | `gcloud sql instances create sonic-db --database-version=POSTGRES_16 --edition=ENTERPRISE --tier=db-f1-micro --region=$REGION --availability-type=zonal --storage-type=SSD --storage-size=10 --no-storage-auto-increase --no-backup --root-password=$ROOTPASS` | 💰 **Charges start now** |
| D2.2 | `gcloud sql databases create sonic --instance=sonic-db` | Included |
| D2.3 | `gcloud sql users create sonic --instance=sonic-db --password=$DBPASS` | Included |
| D2.4 | `$CONN = gcloud sql instances describe sonic-db --format="value(connectionName)"` | Free |

Load the tables and demo data from your computer, through the encrypted
[Cloud SQL Auth Proxy](https://docs.cloud.google.com/sql/docs/postgres/connect-auth-proxy)
(download it and rename it to `cloud-sql-proxy.exe`). Port 5433, because your own PostgreSQL uses 5432.

| # | Command | Cost |
|---|---|---|
| D2.5 | `gcloud auth application-default login` | Free |
| D2.6 | In a **second** window: `.\cloud-sql-proxy.exe --port 5433 <the value of $CONN>` (leave it open) | Free |
| D2.7 | `cd backend; $env:DATABASE_URL = "postgresql://sonic:$($DBPASS)@127.0.0.1:5433/sonic"; npm run db:reset; Remove-Item Env:DATABASE_URL; cd ..` | Included |

⚠️ D2.7 **erases** the database that `DATABASE_URL` points to. Check the `5433` before pressing Enter, and never run it
again once the site holds real data. If it says `must be owner of schema public`, stop: the `sonic` user's rights need fixing first.

⚠️ **The demo accounts, including the admin, all use `sonic1234`, and the password is in this repository.** Before sharing
the link, do D6.

### D3. Secrets: Secret Manager

Written through a temporary file, because PowerShell's pipe adds a line break that would break the secret.

```powershell
function Add-Secret($name, $value) {
  $file = New-TemporaryFile
  [IO.File]::WriteAllText($file, $value)
  gcloud secrets create $name --replication-policy=automatic --data-file="$file"
  Remove-Item $file
  gcloud secrets add-iam-policy-binding $name --member="serviceAccount:$SA" --role="roles/secretmanager.secretAccessor"
}
```

| # | Command | Cost |
|---|---|---|
| D3.1 | `Add-Secret "sonic-database-url" "postgresql://sonic:$($DBPASS)@/sonic?host=/cloudsql/$CONN"` | 💰 Cents above the free part |
| D3.2 | `Add-Secret "sonic-jwt-secret" (node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")` | 💰 Same |
| D3.3 | Optional: `Add-Secret "sonic-paymongo-key" "sk_test_..."` | 💰 Same |
| D3.4 | Optional, after D7: `Add-Secret "sonic-paymongo-webhook" "whsk_..."` | 💰 Same |

### D4. Photos: Cloud Storage

| # | Command | Cost |
|---|---|---|
| D4.1 | `gcloud storage buckets create "gs://$BUCKET" --location=$REGION --uniform-bucket-level-access --no-public-access-prevention` | 💰 Cents, by use |
| D4.2 | `gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" --member=allUsers --role=roles/storage.legacyObjectReader` (**makes the photos public**) | 💰 Downloads |
| D4.3 | `gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" --member="serviceAccount:$SA" --role=roles/storage.objectCreator` (the API may add photos, not change or delete them) | Free |

### D5. API (Cloud Run) and website (Firebase Hosting)

| # | Command | Cost |
|---|---|---|
| D5.1 | `gcloud run deploy sonic-api --source backend --region=$REGION --service-account=$SA --allow-unauthenticated --add-cloudsql-instances=$CONN --env-vars-file=backend/cloudrun-env.yaml --update-secrets="DATABASE_URL=sonic-database-url:1,JWT_SECRET=sonic-jwt-secret:1" --memory=512Mi --cpu=1 --min-instances=0 --max-instances=2` | 💰 Build, image and use (mostly free) |
| D5.2 | `$API = gcloud run services describe sonic-api --region=$REGION --format="value(status.url)"` | Free |
| D5.3 | `Invoke-RestMethod "$API/api/restaurants"` → the restaurants (proves API + database) | Free |
| D5.4 | `npm install -g firebase-tools` | Free |
| D5.5 | `firebase login` | Free |
| D5.6 | `firebase projects:addfirebase $PROJECT` (or do it in the Firebase Console) | Free |
| D5.7 | `cd frontend; "VITE_API_URL=$API/api" \| Out-File .env.production -Encoding ascii; npm ci; npm run build` | Free |
| D5.8 | `firebase deploy --only hosting --project $PROJECT` | 💰 Above the free part |

(In D5.7 type a plain `|`; the backslash is only for this table.) Then open `https://<project>.web.app`.

### D6. Before sharing the link

1. Change the password of **every** demo account you keep: operator and admin first. In the repo folder, per account:

   ```powershell
   $login = Invoke-RestMethod "$API/api/auth/login" -Method Post -ContentType "application/json" -Body '{"email":"admin@sonic.ph","password":"sonic1234"}'
   $body = @{ current_password = "sonic1234"; new_password = (Read-Host "New password") } | ConvertTo-Json
   Invoke-RestMethod "$API/api/auth/change-password" -Method Post -ContentType "application/json" -Headers @{ Authorization = "Bearer $($login.token)" } -Body $body
   ```

   Accounts: `customer`, `liza`, `rider`, `carlo`, `operator`, `admin` (all `@sonic.ph`). `suspended` and `ramon` can't log in yet,
   but they also have `sonic1234`: change Ramon's after approving him. Ask testers to use the new passwords.
2. Check: log in as each role, refresh on an inner page, place and cancel a COD order.
3. Photos have no button in the pages yet, so test with the API: `curl.exe -H "Authorization: Bearer <operator token>" -F "photo=@C:\path\photo.jpg" "$API/api/uploads/restaurants"`, then open the returned URL.

### D7. PayMongo (optional)

Use **test** keys. In the PayMongo Dashboard add the endpoint `<API>/api/payments/webhook` with the event
`checkout_session.payment.paid` (no tunnel needed now). Save the keys with D3.3 and D3.4, then:

| # | Command | Cost |
|---|---|---|
| D7.1 | `gcloud run services update sonic-api --region=$REGION --update-secrets="PAYMONGO_SECRET_KEY=sonic-paymongo-key:1,PAYMONGO_WEBHOOK_SECRET=sonic-paymongo-webhook:1"` | Free |

Known limit: closing the PayMongo page of a cancelled order happens after the answer is sent, when Cloud Run may pause the
CPU, so it can be late. If the customer pays meanwhile, a pending refund is recorded.

### Later: update, look for problems, save money, remove

| # | Command | Cost |
|---|---|---|
| Update the API | D5.1 again | 💰 Adds an image |
| Update the website | D5.7 (without `npm ci`) + D5.8 | Free part |
| Change a secret | `gcloud secrets versions add <name> --data-file=<file>`, then `gcloud run services update ... --update-secrets="NAME=<name>:2"` | Cents |
| Read the API's errors | `gcloud run services logs read sonic-api --region=$REGION --limit=50` | Free |
| **Stop the database** | `gcloud sql instances patch sonic-db --activation-policy=NEVER` | Stops the machine's cost; disk (and possibly IP) still cost. The site stops working |
| Start it again | `gcloud sql instances patch sonic-db --activation-policy=ALWAYS` | 💰 |
| Back up by hand | `gcloud sql backups create --instance=sonic-db` | 💰 Backup storage |

Remove everything after the defense. ⚠️ **These can't be undone:**

| # | Command |
|---|---|
| R1 | `gcloud sql instances delete sonic-db` (ends the main cost; all data is lost) |
| R2 | `gcloud run services delete sonic-api --region=$REGION` |
| R3 | `gcloud storage rm --recursive "gs://$BUCKET"` |
| R4 | `gcloud artifacts repositories delete cloud-run-source-deploy --location=$REGION` |
| R5 | `gcloud secrets delete <name>` for each secret |
| R6 | `firebase hosting:disable --project $PROJECT` |
| All of it | `gcloud projects delete $PROJECT` |
