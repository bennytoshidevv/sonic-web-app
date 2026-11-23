# Super Sonic Delivery – Backend

Express 5 + PostgreSQL API for the React frontend in `../frontend`. Student capstone: keep code simple,
explain the "why" in comments, and ask before inventing requirements.
Commands: `npm run dev` (http://localhost:4000), `npm run db:reset` (schema + seed), `npm test`.

## The spec is `frontend/src/mock/mock.js`
- Each exported mock function = one endpoint. Copy its **response shape** (field names, nesting:
  `{ user }`, `{ ok: true }`, orders with `items`, `stores`, `payment`, `history`), its **error codes**
  (`not_allowed`, `reason_required`, `not_assigned`, `not_ready`, `no_open_shift`, `email_taken`, ...)
  and its **business rules** (read the function body). If the mock and these rules disagree, ask.
- Errors are `{ error: '<code>', message }` with a fitting HTTP status (helpers in `middleware/errors.js`).
- The mock takes `user_id` / `customer_id` / `rider_id` / `staff_id` / `admin_id` as arguments.
  The API **never** trusts ids for the acting user: it always uses `req.user` (from the JWT).
- Calculations: `src/utils/calc.js` is a copy of `frontend/src/shared/utils/calc.js` (same names).
  Totals, earnings, balances and average ratings are computed when read, never stored.

## Coding rules
- Express 5 (async errors reach the error handler, no try/catch needed), ES modules, plain JavaScript,
  `pg` with plain SQL. No ORM, no TypeScript, no new frameworks. **Ask before adding an npm package.**
- SQL is always parameterized (`$1, $2`). Prefer one readable query with JOINs; use `json_agg` /
  `json_build_object` for nested lists.
- Writes to more than one table go in `withTransaction`. Lock the changed row with `SELECT ... FOR UPDATE`
  when two people could change it at once (assigning riders, status changes, settlements).
- One folder per module: `src/modules/<name>/<name>.routes.js` (+ `<name>.service.js` only for big logic:
  orders, deliveries, shifts). Mount each router in `src/app.js`.
- Access control on every route (`requireAuth`, `requireRole`; admin passes operator routes).
  Customers see only their own data, riders only their assigned orders. Someone else's order → **404**,
  not 403, so ids can't be probed.
- Soft delete only for users, restaurants, menu categories and menu items (`account_status`, `is_active`).
  Cart items, favorites and default-address flags may be deleted.
- Snapshots: checkout copies item name/price, barangay fee, extra-store fee and address into the order;
  delivery copies gas allowance and rider share % into `delivery_earnings` and deduction amounts into
  `applied_deductions`. Settings changes never change past orders or shifts.
- `audit_logs` (same transaction) for user status changes, restaurant/menu edits (esp. price), barangay fees,
  gas tiers, deduction types, rate settings and savings withdrawals – same actions as the mock's `audit(...)`.
- Every order status change inserts into `order_status_history` (who, when, remarks).
- Notifications: where the mock creates one, and at least on order status changes (customer) and rider
  assignment (rider).
- Validate input with `src/utils/validate.js` (add helpers there); bad input → 400 with a clear message.
- Short functions; comments say **why** in plain English.

## Business rules (details in mock.js)
- Order statuses: `pending → confirmed → preparing → ready_for_pickup` (operator/admin), then
  `picked_up → on_the_way → delivered` (the assigned rider, who accepted and has an open shift).
  Customer cancels only while `pending`. Staff may reject/cancel up to `ready_for_pickup`, with a reason;
  cancelling ends the active assignment and frees the rider.
- `deliveries`: one per order, own status and timestamps. `delivery_assignments` = rider history; current
  rider = `ended_at IS NULL`. Assign only riders who are active, on an open shift and available.
  Reject ends the row with `end_reason = 'rejected'`; staff can reassign.
- Delivery fee = the customer's barangay fee. First store = primary; each extra store adds
  `rate_settings.extra_store_fee`. Total = items subtotal + barangay fee + extra-store fees.
  Sold-out items and closed/disabled restaurants are rejected again at checkout.
- Current rate = latest `rate_settings` row with `effective_from <= now()`; a future row is "upcoming".
- Rider pay: allowance = gas tier matching the barangay fee only; share = (fee − allowance) × pct;
  gross = allowance + share + all extra-store fees. (₱250 → ₱50 + ₱140 = ₱190, +₱10 per extra store.)
- Deductions: per-delivery on delivered; per-shift when the shift starts. `is_rider_savings` also inserts a
  `rider_savings_entries` deposit.
- One shift per rider per day. COD becomes `paid` when the rider marks the order delivered.
- Settlement per closed shift: COD collected vs. net pay (`settlementAmounts()`); if Sonic owes the rider,
  record `payout_amount` + `payout_method` (cash, or gcash + reference).
- Petty cash = ledger per shift; on hand is calculated. Savings balance = deposits − withdrawals; only the
  admin withdraws, never more than the balance.
- Reviews only for the customer's own delivered orders: one per restaurant per order + one rider review, 1–5.

## Workflow
- One module at a time: routes → `test/<module>.test.js` (happy path, wrong role, someone else's data,
  each error code) → `npm run db:reset && npm test` → update the API table in `README.md` → wait for OK.
- One commit per module on the `backend` branch. Don't push unless asked.
- Ask before changing `db/schema.sql`; if approved, keep `scripts/seed.js` working and say what to update
  in the dbdiagram.io ERD. Never commit `.env` or keys.
