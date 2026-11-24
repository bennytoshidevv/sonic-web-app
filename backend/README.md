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
| POST | `/api/staff/orders/:id/advance` | operator, admin | → `{ order }`: pending → confirmed → preparing → ready_for_pickup; else 409 `not_allowed`. Notifies the customer (`advanceOrderByStaff`) |
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
| POST | `/api/staff/menus/categories/:id/move` | operator, admin | `{ direction: -1|1 }` → `{ ok }`; 409 `edge` (`moveMenuCategory`) |
| POST | `/api/staff/menus/items` | operator, admin | `{ menu_category_id, name, description, price, is_available, photo_url? }` → `{ item }`; 400 `invalid` (`saveMenuItem`) |
| PUT | `/api/staff/menus/items/:id` | operator, admin | same body → `{ item }`; old and new price in the audit log (`saveMenuItem`) |
| PUT | `/api/staff/menus/items/:id/availability` | operator, admin | `{ is_available }` → `{ ok }` (`setMenuItemAvailable`) |
| POST | `/api/staff/menus/items/:id/archive` | operator, admin | → `{ ok }`; soft delete (`archiveMenuItem`) |
| GET | `/api/staff/users/customers` | operator, admin | → `[{ user, order_count, delivered_count, total_spent }]` (`getCustomersForStaff`) |
| GET | `/api/staff/users/operators` | operator, admin | → operator users (`getOperatorsForStaff`) |
| POST | `/api/staff/users/riders` | operator, admin | `{ full_name, email, contact_number, password, vehicle_type, plate_number }` → `{ user }` (active); 409 `email_taken` (`createRiderAccount`) |
| PUT | `/api/staff/users/:id/status` | operator, admin | `{ account_status, reason }` → `{ ok }`; operators manage riders + customers, only the admin manages operators, nobody changes the admin: 403 `not_allowed`; 400 `invalid_status` (`setAccountStatus`) |
| GET | `/api/staff/users/:id/latest-change` | operator, admin | → latest audit row about the user, or null (`getLatestAccountChange`) |
| GET | `/api/staff/users/names?ids=1,2` | operator, admin | → `{ "1": "name", ... }`, unknown = 'System' (`getUserNames`) |
| **Settlements** (module 7) | | | Operator and admin only |
| GET | `/api/staff/shifts?date=YYYY-MM-DD` | operator, admin | → shifts that started that day: `[{ shift, runs, deductions, settlement, pettyCash, rider, profile }]`; 400 `invalid_date` (`getShiftsOnDate`) |
| POST | `/api/staff/shifts/:id/settlement` | operator, admin | `{ cash_received, payout_method, payout_reference, notes, return_petty_cash }` → `{ ok }`. The payout is computed by the API (`settlementAmounts`). 409 `shift_not_closed`, `already_settled`; 400 `reference_required` (GCash payout), `invalid` (`recordSettlement`) |
| POST | `/api/staff/shifts/:id/petty-cash` | operator, admin | `{ txn_type: cash_issued|gcash_topup|cash_returned|adjustment, amount, gcash_reference_id, note }` → `{ ok }`; 400 `invalid_type`, `invalid_amount`, `reference_required`; 409 `not_enough`, `already_settled` (`addPettyCashTransaction`) |
| **Admin** (module 8) | | | The admin only (operators get 403); every settings change is written to `audit_logs` |
| GET | `/api/admin/reports` | admin | → `{ orders (staff view + earning), riders, deductions (+ type) }`; the Reports page picks the dates and computes totals with calc.js (`getReportData`) |
| GET | `/api/admin/settings` | admin | → `{ barangays, tiers (active), deductionTypes, rates (+ created_by_name, state: upcoming|active|superseded) }` (`getSettingsData`) |
| POST / PUT | `/api/admin/barangays`, `/api/admin/barangays/:id` | admin | `{ barangay_name, city_municipality, delivery_fee, is_active }` → `{ barangay }`; 400 `invalid`, 409 `duplicate` (`saveBarangay`) |
| PUT | `/api/admin/gas-tiers` | admin | `{ tiers: [{ min_delivery_fee, max_delivery_fee (null = no limit), allowance_amount }] }` → `{ ok }`; all replaced in one transaction, old ones kept inactive; 400 `invalid_tiers` with the problem as message (`saveGasTiers`) |
| POST / PUT | `/api/admin/deduction-types`, `/api/admin/deduction-types/:id` | admin | `{ name, amount, frequency, is_rider_savings, is_active }` → `{ deductionType }`; 400 `invalid`, 409 `duplicate` (`saveDeductionType`) |
| POST | `/api/admin/rate-settings` | admin | `{ extra_store_fee, rider_share_pct, effective_from: 'YYYY-MM-DDTHH:MM' }` → `{ rate }` (always a new row); 400 `invalid` (`addRateSetting`) |
| GET | `/api/admin/savings` | admin | → `[{ user, profile, entries (+ shift_date, processed_by_name), lastShift }]` (`getSavingsOverview`) |
| POST | `/api/admin/savings/:riderId/withdrawals` | admin | `{ amount, note }` → `{ entry }`; 400 `invalid_amount`, `note_required`; 409 `not_enough` (`recordSavingsWithdrawal`) |

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
      admin/      admin.routes.js (reports, settings, rider savings)
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
