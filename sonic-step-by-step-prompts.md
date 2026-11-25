# Super Sonic Delivery – step-by-step prompts for Claude Code

How to use this file:
- Do the steps **in order**. Paste only the box under "Prompt" for that step.
- **Start a new Claude Code session (`/clear`) before each step.** Every prompt tells Claude Code which files to read, so it doesn't need the old conversation. Fresh sessions are faster and make fewer mistakes.
- Claude Code stops after each step and waits for your OK. Read the "Check before you approve" list first, then answer "OK, commit it" or tell it what to fix.
- If a step goes wrong, say what you saw (copy the error). Don't start the next step until the current one passes its tests.

| Step | What | Target day |
|---|---|---|
| 0 | Unblock and finish the restructure, push | Nov 25 |
| 1 | Module 1 – Catalog | Nov 25 |
| 2 | Module 2 – Customer addresses | Nov 25 |
| 3 | Module 3 – Customer orders + reviews | Nov 26 |
| 4 | Module 4 – Operator orders + rider assignment | Nov 26 |
| 5 | Module 5 – Rider | Nov 27 |
| 6 | Module 6 – Operator management | Nov 28 |
| 7 | Module 7 – Settlement | Nov 28 |
| 8 | Module 8 – Admin | Nov 29 |
| 9 | Connect the frontend (one role at a time) | Nov 29 |
| 10 | Full demo test | Nov 30 |
| 11–13 | Optional: notifications, PayMongo, deployment | only if time is left |

---

## Step 0 – Unblock and finish the restructure

**Before pasting:** close every terminal window that runs `npm run dev` for this project.

### Prompt
```
Read docs/claude-prompt.md (the "Check where we are" part and Task 1) and finish the restructure of this repo into frontend/, backend/ and docs/erd/.

1. First check if anything still locks src/: run `netstat -ano | findstr :5173` and tell me the PID. If a node process is still running, give me the exact taskkill command to run myself; don't kill processes on your own.
2. Look at `git status` and `git diff` first: some path fixes are already made on the branch restructure-frontend-backend. Don't redo them.
3. Then finish step A: git mv everything into place, add the root README.md / CLAUDE.md / package.json, delete dist/ and node_modules/ and reinstall in both folders, build + lint the frontend, start the frontend dev server and check /, /customer/login and /operator, then stop it.
4. Write backend/.env from backend/.env.example (local DATABASE_URL, a random JWT_SECRET), run `npm run db:reset && npm test` in backend/ and show me the result.
5. Search for leftover old paths (server/, ../../src, src/lib/, the ERD file at the root) and fix them.
6. Commit on restructure-frontend-backend, then push that branch: `git push -u origin restructure-frontend-backend`. Don't merge into main.

Decisions already made (save these in backend/CLAUDE.md under "Decisions" so later sessions know them):
- Notifications: the backend saves them; no notifications page for now.
- Rejecting an online-paid order creates a pending refund record; actual PayMongo refunds only if time allows.
- Rejected rider/operator applications become inactive; no new status.
- "Delivered today" means today only.
- Priority: modules 1–8 and connecting the frontend. PayMongo, notifications page and deployment only if time is left.

Finish by showing me the tree (2 levels deep), the test results and the list of changed files.
```

### What will happen
- Claude Code checks whether the old dev server is still running. If it is, it gives you a `taskkill` command; run it with `!` in front, then say "done".
- It moves the files into `frontend/`, `backend/` and `docs/erd/` (keeping their git history), reinstalls packages and builds the frontend.
- It creates `backend/.env` and runs the Day 1 tests against your real PostgreSQL for the first time.
- It commits and pushes the branch to GitHub, so your backend is finally backed up.

### Check before you approve
- The frontend opens at `http://localhost:5173` and logins still work with the mock data.
- `npm test` in backend shows **11 pass, 0 fail**.
- On GitHub you can see the `restructure-frontend-backend` branch with `frontend/` and `backend/`.
- `backend/.env` is **not** in the commit.

---

## Step 1 – Module 1: Catalog

### Prompt
```
Read backend/CLAUDE.md, docs/claude-prompt.md (Task 2) and backend/README.md. Create a branch `backend` from restructure-frontend-backend if it doesn't exist, and work there.

Build module 1 – Catalog. Copy these mock functions from frontend/src/mock/mock.js as API endpoints, with the same response shapes and error codes: barangays, cuisine types, restaurant list (with cuisines, open status, average rating), restaurant details (with hours), menu (categories + items, hiding inactive ones), restaurant reviews, current rate settings, isFavoriteRestaurant / setFavoriteRestaurant, and getCartItemDetails. Find the exact function names in mock.js.

Rules: the user always comes from the token (req.user), never from an id in the request. Customers see only active restaurants and items. Average ratings are calculated in SQL, not stored.

Add tests in backend/test/catalog.test.js (happy path, not logged in, wrong role, unknown id). Run `npm run db:reset && npm test`. Update the API table in backend/README.md. Then show me a summary and wait for my OK before committing.
```

### What will happen
- Claude Code reads the mock functions and builds endpoints like `GET /api/restaurants`, `GET /api/restaurants/:id/menu` and `PUT /api/favorites/:restaurantId`.
- It writes tests and runs them on a freshly reset database.
- It shows you the list of endpoints and the test results, then waits.

### Check before you approve
- All tests pass (the 11 auth tests plus the new ones).
- The README has a row for each new endpoint.
- Ask it to explain one endpoint in simple words. If you can repeat the explanation, you can defend it.

Then reply: **"OK, commit it."**

---

## Step 2 – Module 2: Customer addresses

### Prompt
```
Read backend/CLAUDE.md and backend/README.md. Work on the `backend` branch.

Build module 2 – Customer addresses, copying the address functions from frontend/src/mock/mock.js (list, add, update, set default, remove). Same response shapes and error codes.

Rules: a customer can only see and change their own addresses (someone else's address gives 404). Removing is a soft delete (is_active = false). Setting a default must unset the old default in the same transaction (the database allows only one default per customer). Each address returns its barangay name, city and delivery fee, because checkout needs the fee.

Add backend/test/addresses.test.js, including "customer A cannot edit customer B's address". Run `npm run db:reset && npm test`, update the README, show me a summary and wait for my OK.
```

### What will happen
- Five endpoints under `/api/addresses`.
- A test that proves one customer can't touch another customer's address. This is good to mention in your defense under "security".

### Check before you approve
- Tests pass, including the "other customer" test.
- Removing an address doesn't delete the row (the summary should say soft delete).

---

## Step 3 – Module 3: Customer orders + reviews

### Prompt
```
Read backend/CLAUDE.md, backend/README.md and section 4 (business rules) of docs/claude-prompt.md. Work on the `backend` branch.

Build module 3 – Customer orders and reviews: placeOrder, getCustomerOrders, getOrderDetails, cancelOrder, getOrderReviews, submitOrderReviews, getRiderReviews (check the exact names in frontend/src/mock/mock.js).

placeOrder is the most important endpoint in the project. It must run in ONE transaction and:
- take the address id, payment method, notes and a list of { item_id, quantity } (the cart stays in the frontend's CartContext; don't use the cart_items table)
- check every item again: exists, active, not sold out, restaurant active and open
- the first store in the list is the primary store; each extra store adds the current extra_store_fee
- save snapshots: item name and price, barangay fee, extra-store fees, the address
- create the order, order_restaurants, order_items, a payment row (COD = pending) and a "pending" status history row
- create the order number the same way mock.js does

Cancel: customer only, own order only, only while pending, with history. Reviews: only own delivered orders, ratings 1–5, one per order per restaurant and one per order for the rider.

Tests: a full checkout with 2 stores (check the totals and the ₱10 fee), a sold-out item is refused, a closed restaurant is refused, cancel works only while pending, reviewing an undelivered order is refused, another customer's order gives 404. Run `npm run db:reset && npm test`, update the README, show me a summary and wait.
```

### What will happen
- Checkout becomes real. Claude Code writes it as one transaction: if any part fails, nothing is saved.
- Tests compute a 2-store order and confirm the totals match the rule (items + barangay fee + ₱10 per extra store).

### Check before you approve
- Ask: **"Show me the totals from the 2-store checkout test and explain them."** They should match your business rules.
- Ask: **"What happens if the database fails halfway through checkout?"** The answer must be "nothing is saved (rollback)".

---

## Step 4 – Module 4: Operator orders + rider assignment

### Prompt
```
Read backend/CLAUDE.md, backend/README.md and section 4 of docs/claude-prompt.md. Work on the `backend` branch.

Build module 4 – Operator orders and riders: getLiveOrders, getOrderForStaff, advanceOrderByStaff, rejectOrderByStaff, getRidersOverview, assignRider (exact names and rules in frontend/src/mock/mock.js). Operator and admin only.

Rules:
- staff move pending → confirmed → preparing → ready_for_pickup, every change in order_status_history with who and when, plus a notification to the customer
- reject/cancel is allowed up to ready_for_pickup and needs a reason; it ends the active assignment and frees the rider; if the order was paid online, create a pending refund record
- assignRider creates the delivery (if none yet) and a delivery_assignment with response pending; the rider must be active, on an open shift and available; reassigning ends the old assignment with end_reason 'reassigned'; notify the rider
- lock the order row (SELECT ... FOR UPDATE) so two operators can't assign at the same time

Tests: the full staff status flow, a wrong-order skip is refused, reject without a reason is refused, assigning an offline rider is refused, reassigning keeps the history, customers and riders get 403. Run `npm run db:reset && npm test`, update the README, show me a summary and wait.
```

### What will happen
- The operator's live order board and the "assign rider" button get real endpoints.
- The rider history is kept: reassigning a rider doesn't erase who had the order before.

### Check before you approve
- Tests pass, including "two operators can't assign at the same time" if it added one.
- Ask it to explain `FOR UPDATE` simply. You may get asked about it.

---

## Step 5 – Module 5: Rider (the biggest module)

### Prompt
```
Read backend/CLAUDE.md, backend/README.md, section 4 of docs/claude-prompt.md and frontend/src/shared/utils/calc.js. Work on the `backend` branch.

Build module 5 – Rider: getRiderDashboard, startShift, endShift, setRiderAvailability, getRiderDeliveries, acceptAssignment, rejectAssignment, advanceDelivery, getRiderDeliveryDetails, recordPettyPurchase, getRiderHistory, getRiderWallet (exact names and rules in mock.js). Riders see only their own shifts and the deliveries assigned to them.

Copy calc.js into backend/src/utils/calc.js with the same function names and use it, so the frontend and backend compute pay the same way.

Rules:
- startShift: one shift per rider per day; applies the per-shift deductions (box rent, savings); the savings deduction also adds a rider_savings_entries deposit
- the rider must accept before moving the status; then picked_up → on_the_way → delivered, each with history and a customer notification
- on delivered, in ONE transaction: delivery_earnings snapshot (gas allowance from the BARANGAY fee only, rider share %), the per-delivery deduction, COD payment becomes paid, the assignment ends as completed, the rider becomes available again
- pay rule: allowance + (fee − allowance) × share % + all extra-store fees. Example: fee 250 → 50 + 140 = 190, +10 per extra store
- nothing calculated is stored (earnings, balances, petty cash on hand)

Tests: the full rider flow from startShift to delivered, the 250 → 190 example and the 1-extra-store → 200 example, a second shift on the same day is refused, another rider's delivery gives 404, moving status before accepting is refused, delivering without an open shift is refused. Run `npm run db:reset && npm test`, update the README, show me a summary and wait.
```

### What will happen
- This is the biggest step (13 functions). It may take a long time, and Claude Code may split it into two parts: shifts + deliveries first, then history, wallet and petty cash. That's fine.
- The tests prove the rider pay formula with your real examples (₱250 → ₱190, and ₱200 with one extra store).

### Check before you approve
- The pay examples pass. **These are the numbers your panel will ask about.**
- Log in as the rider in your head: start shift → accept → picked up → on the way → delivered. Ask Claude Code to list what gets saved at each step.

---

## Step 6 – Module 6: Operator management

### Prompt
```
Read backend/CLAUDE.md and backend/README.md. Work on the `backend` branch.

Build module 6 – Operator management (operator and admin only), copying from frontend/src/mock/mock.js:
- restaurants: getRestaurantsForStaff, saveRestaurant (with cuisines and hours), open/closed toggle, enable/disable
- menus: getMenuForStaff, saveMenuCategory, moveMenuCategory, saveMenuItem, setMenuItemAvailable, archiveMenuItem
- users: getCustomersForStaff, getOperatorsForStaff, createRiderAccount, setAccountStatus, getLatestAccountChange, getUserNames

Rules:
- never DELETE restaurants, categories, items or users; use is_active / account_status
- photos: the page first uploads to the existing /api/uploads/:folder, then saves the returned url
- audit_logs (in the same transaction) for every restaurant edit, menu edit (always for price changes) and account status change, with old and new values
- approval rules: operators can approve or suspend riders and customers; only the admin can approve or suspend operators; nobody can change their own status
- changing a price must not change old orders (they use the snapshot)

Tests: an operator cannot change an operator account, an admin can; a price change creates an audit row and an old order still shows the old price; archiving hides the item from the customer menu; a customer gets 403. Run `npm run db:reset && npm test`, update the README, show me a summary and wait.
```

### What will happen
- The operator's restaurant, menu and user screens get their endpoints (about 17).
- Every edit is written to the audit log, which you can show in your defense as the "audit trail" feature.

### Check before you approve
- The test that proves an old order keeps its old price passes. This is your "snapshot" design.
- The approval rules match what you want (operator vs admin).

---

## Step 7 – Module 7: Settlement

### Prompt
```
Read backend/CLAUDE.md, backend/README.md, section 4 of docs/claude-prompt.md and settlementAmounts() in backend/src/utils/calc.js. Work on the `backend` branch.

Build module 7 – Settlement (operator and admin): getShiftsOnDate, recordSettlement, addPettyCashTransaction (exact names and rules in mock.js).

Rules:
- getShiftsOnDate shows, for each rider shift: COD collected, gross earnings, deductions, net pay, amount the rider must remit, petty cash on hand, all calculated with calc.js, none stored
- recordSettlement only for a closed shift and only once; if net pay is more than the COD collected, Sonic pays the difference: save payout_amount and payout_method (cash, or gcash with a reference)
- petty cash ledger types: cash_issued, gcash_topup, purchase (linked to an order), cash_returned, adjustment

Tests: a normal settlement where the rider remits cash; a settlement where Sonic pays the rider (net pay > COD); settling twice is refused; settling an open shift is refused; petty cash on hand is correct after issue + top-up + purchase + return. Run `npm run db:reset && npm test`, update the README, show me a summary and wait.
```

### What will happen
- The end-of-shift settlement screen gets real numbers.
- Tests cover both cases: rider pays Sonic, and Sonic pays the rider.

### Check before you approve
- Ask: **"Walk me through the 'Sonic pays the rider' test with the numbers."** Make sure the result matches how Sonic really does it.

---

## Step 8 – Module 8: Admin

### Prompt
```
Read backend/CLAUDE.md, backend/README.md and frontend/src/shared/utils/validate.js. Work on the `backend` branch.

Build module 8 – Admin (admin only): getReportData, getSettingsData, saveBarangay, saveGasTiers, saveDeductionType, addRateSetting, getSavingsOverview, recordSavingsWithdrawal (exact names and shapes in mock.js).

Rules:
- reports (sales, orders per restaurant, top items, rider performance, payment summary) are computed with SQL from delivered orders, with the same date filters as the page
- saveGasTiers: copy tierRangeProblem() from validate.js so ranges can't overlap; replace all tiers in one transaction
- addRateSetting adds a new row (never edits an old one); the latest row with effective_from <= now() is the current one
- savings withdrawal can't be more than the balance
- every settings change and withdrawal writes audit_logs with old and new values
- changing settings must not change past orders, earnings or deductions

Tests: overlapping gas tiers are refused, a withdrawal over the balance is refused, an operator gets 403, a new rate applies to new orders but an old delivery keeps its old snapshot, report totals match the seed data. Run `npm run db:reset && npm test`, update the README, show me a summary and wait.
```

### What will happen
- The admin's reports, settings and savings screens get endpoints.
- After this step **the whole backend needed for the demo is finished.**

### Check before you approve
- All tests pass for all 8 modules together.
- Then ask: **"Merge `backend` into `restructure-frontend-backend` and push both branches."** (Still not into main.)

---

## Step 9 – Connect the frontend (one role at a time)

Do this as **four short prompts**, one per role, testing in the browser between them.

### Prompt 9a – setup + customer
```
Read frontend/CLAUDE.md, backend/README.md and section 6 of docs/claude-prompt.md. Work on the `backend` branch.

Connect the frontend to the real API, starting with the customer role:
1. Create frontend/src/api/client.js (base URL from VITE_API_URL, adds the Authorization header from the saved token, turns error responses into { error } like the mock functions) and frontend/src/api/index.js with the SAME function names and return shapes as mock.js.
2. AuthContext: save { token, user } in sessionStorage and check it with GET /api/auth/me on load. Logins, sign-up and apply use the API.
3. Switch only the customer pages' imports from @mock/mock to the API. Remove id arguments that the API now takes from the token. Don't change anything else in the pages without asking me.
4. Add frontend/.env.example with VITE_API_URL=http://localhost:4000/api.
Keep mock.js (the seed script uses it).

Then start both servers and give me a checklist of what to click as the demo customer (customer@sonic.ph / sonic1234) to test every customer page. Wait for my result.
```

### Prompt 9b – rider, 9c – operator, 9d – admin
```
The customer role works. Now switch the [rider / operator / admin] pages from @mock/mock to the API the same way. Then give me a click-through checklist for the demo [rider / operator / admin] account and wait for my result.
```

### What will happen
- Your pages stop using fake data and start using the real database. Because the API copies the mock function names and shapes, most pages only change their import line.
- After each role, Claude Code gives you a checklist. **You** click through it in the browser and report back anything broken.

### Check before you approve
- Each page in the checklist loads without errors (open the browser console with F12 and look for red errors).
- Data you save is still there after refreshing the page. That proves it's in the database, not in memory.

---

## Step 10 – Full demo test

### Prompt
```
Read backend/README.md and frontend/README.md. Everything is connected. Help me rehearse the full demo:
1. Run `npm run db:reset` in backend/ so the demo data is dated today.
2. Write me a demo script (in docs/demo-script.md) that goes through one full order with all four roles: customer places a 2-store order → operator confirms and assigns a rider → rider starts shift, accepts, picks up, delivers → customer rates → operator settles the shift → admin sees it in reports. Include which account to log in with at each step and what to point out (snapshots, status history, audit log, rider pay computation).
3. Run all backend tests and the frontend build one last time.
List anything that's broken or that I should not click during the demo. Then commit and push the `backend` branch.
```

### What will happen
- You get a step-by-step demo script that uses all four roles and highlights what the panel cares about.
- One last check that everything passes.

### Check before you approve
- Do the script yourself once from start to finish. If anything fails, paste the error into Claude Code.
- Finally, ask Claude Code to **open a pull request into main** or merge it yourself on GitHub.

---

## Optional steps (only if steps 0–10 are done)

### Step 11 – Notifications (backend already saves them)
```
Read backend/CLAUDE.md. Add endpoints to list my notifications, count unread, and mark them as read, with tests. Then ask me before adding any notifications page or bell icon to the frontend.
```
**What will happen:** small module, about an hour. The bell icon page is a separate decision.

### Step 12 – PayMongo sandbox
```
Read backend/CLAUDE.md and section 5, module 10 of docs/claude-prompt.md. Look up the current PayMongo docs before writing code. Add PayMongo Checkout Session for gcash, maya, qr_ph and card, and POST /api/payments/webhook with signature verification, raw event storage (no double processing) and payment/order updates. COD must keep working if the PayMongo keys are missing. Tell me which keys I need from the PayMongo dashboard and how to test the webhook locally.
```
**What will happen:** you'll need to create a PayMongo account and copy test keys into `backend/.env` yourself. Testing the webhook locally needs a tunnel tool, which Claude Code will explain. Budget half a day.

### Step 13 – Deployment to Google Cloud
```
Read backend/README.md. Write the deployment steps for Google Cloud in backend/README.md: Cloud SQL for PostgreSQL, the API on Cloud Run, photos in a Cloud Storage bucket (UPLOAD_DRIVER=gcs), and the frontend build on Firebase Hosting. List every command and every setting, and which ones cost money. Don't run any gcloud command until I approve each one.
```
**What will happen:** Claude Code writes the steps first. You approve each command, because these create paid resources on your Google Cloud account. Check your billing and free credits before you start.
