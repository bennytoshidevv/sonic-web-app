# Demo script – one order, all four roles

About 12–15 minutes. Every account's password is `sonic1234`.
The story: Maria orders from 2 stores, Ana dispatches it, Ramon delivers it, and Jose sees it in the reports.

| Who | Email | Login page |
|---|---|---|
| Customer – Maria Santos | `customer@sonic.ph` | `/customer/login` |
| Operator – Ana Villanueva | `operator@sonic.ph` | `/operator/login` |
| Rider – Ramon Cruz (an applicant, approved during the demo) | `ramon@sonic.ph` | `/rider/login` |
| Admin – Jose Dela Cruz | `admin@sonic.ph` | `/admin/login` |

**Why Ramon?** A rider can have only one shift per day, and only a rider on shift can be assigned. Marcelo and Carlo
already have a shift open in the demo data, so they cannot show "Start shift". Ramon can, so he starts his shift
*before* the operator assigns him.

## Before the panel arrives

1. Stop any running `npm run dev` windows.
2. In `backend/`: `npm run db:reset`. **This erases everything and loads fresh demo data dated today. Do it on the
   same day as the demo, and again before every rehearsal** (Ramon can only be approved and start a shift once).
3. Start the backend first: in `backend/`, `npm run dev`. Then in `frontend/`, `npm run dev`.
4. Open four **new, empty tabs** at `http://localhost:5173` + each login page above. Each tab keeps its own login.
   Don't use "Duplicate tab": it copies the login of the first tab.
5. Log in as customer, operator and admin. Ramon cannot log in yet.
6. In the admin tab, write down **Total sales** and the number of **delivered orders** on Reports. You compare them in step 9.
7. Have the audit log query (end of this file) ready in a terminal.

Pages do not update by themselves. **Refresh the page (F5) when you switch to another role's tab.**

## The demo

### 1. Ramon is blocked, then approved (rider, then operator)
- **Rider tab:** try to log in as `ramon@sonic.ph` → "Account not active yet".
- **Operator tab:** Riders & customers → **Applications** → **Approve**.
- Point out: new riders need approval, and the approval is saved in the **audit log**. Operators can approve riders;
  only the admin can approve operators.

### 2. Rider starts the shift (rider)
- Log in again as Ramon → **Start shift**.
- Point out: starting a shift charges ₱10.00 box rent + ₱10.00 savings. The savings also become a deposit in his savings ledger.

### 3. Customer places a 2-store order (customer)
- Open **Kusina ni Aling Rosa** → add **Tapsilog** (₱95.00).
- Open **Sipocot Pearl Milk Tea & Snacks** → add **Brown Sugar Milk Tea** (₱79.00) → **Add anyway (+₱10.00)**.
- Cart → **Checkout** → address **Change** → **Add new address** → barangay **Mangga**, street `Purok 2` → save.
- Payment: keep **Cash on Delivery** → **Place order**. The order number should end in `1014`.

| | |
|---|---|
| Items (95 + 79) | ₱174.00 |
| Delivery fee (Mangga) | ₱250.00 |
| Extra store (1 × ₱10) | ₱10.00 |
| **Total** | **₱434.00** |

- Point out:
  - The browser sends only item ids and quantities. **The API reads the prices and fees itself**, so a customer can't change a price.
  - Checkout is **one transaction**: if any part fails, nothing is saved (rollback).

### 4. Operator confirms, and the snapshot (operator)
- Live orders → open the new order → **Confirm order**.
- Menus → Kusina ni Aling Rosa → Tapsilog → **Edit** → clear the price, type `105` → **Save item**.
- Go back to the order: it still shows **₱95.00** and **₱434.00**.
- Point out: **snapshot** – the order keeps its own copy of the item name, price and fees. New carts pay ₱105.00.
  The price edit is in the audit log with the old and new price.

### 5. Operator assigns Ramon (operator)
- On the order: **Assign rider** → choose **Ramon Cruz** → **Send to rider**.
- Then **Mark preparing** → **Mark ready for pickup**.
- Point out: reassigning ends the old assignment but keeps it, so the history shows who had the order. The order row is
  locked while assigning (`SELECT ... FOR UPDATE`), so two operators can't assign at the same moment.

### 6. Rider delivers (rider)
- Refresh → Deliveries → **Accept** → open the delivery → **Picked up** → **On the way** → **Arrived · Mark as delivered**.
- Choose **₱434.00 (exact)** → **Cash received · Complete**.
- Show the Dashboard, then History (tap the delivery for its breakdown).

**Rider pay computation**

| Step | Amount |
|---|---|
| Gas allowance (fee ₱250 is in the ₱151–₱300 tier) | ₱50.00 |
| Rider share: (250 − 50) × 70% | ₱140.00 |
| Extra store (100% to the rider) | ₱10.00 |
| **Gross** | **₱200.00** |
| Operator fee ₱10 + box rent ₱10 + savings ₱10 | −₱30.00 |
| **Net pay** | **₱170.00** |

- Point out: the gas allowance uses the **barangay fee only**. On delivery the allowance and share % are saved as a
  **snapshot** (`delivery_earnings`). Totals such as gross and net are **calculated, never stored**.

### 7. Customer rates (customer)
- Orders → the delivered order → rate both stores and the rider → **Submit ratings**.
- Point out: only delivered orders, once per store and once for the rider. Average ratings are calculated in SQL.

### 8. End of shift and settlement (rider, then operator)
- **Rider:** Dashboard → **End shift** → confirm.
- **Operator:** Settlements → **Ramon Cruz** → **Exact amount** → **Record settlement** → shows **Settled**.

| | |
|---|---|
| COD cash collected | ₱434.00 |
| Ramon keeps his net pay | −₱170.00 |
| **Cash handed to Sonic** | **₱264.00** |

- Point out: if net pay were higher than the COD cash, Sonic would pay the rider the difference. A shift can be settled only once.
- Open the order again → **Status history**: every step, with who and when (Maria, then Ana, then Ramon).

### 9. Admin sees it (admin)
- Refresh **Reports**: Total sales is **₱434.00 higher** and delivered orders is **1 higher** than what you wrote down.
  Ramon is in the rider table.
- **Rider savings:** Ramon has a ₱10.00 deposit.
- **Settings:** show the gas tiers. Point out: changes affect only new orders and shifts.

### 10. Audit log (terminal)
There is no audit log page, so show the table (database password: `sonic`, the local default):

```
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -h localhost -U sonic -d sonic -c "SELECT a.created_at::timestamp(0) AS time, u.full_name AS who, a.action, a.old_value->>'price' AS old_price, a.new_value->>'price' AS new_price, a.new_value->>'account_status' AS new_status FROM audit_logs a LEFT JOIN users u ON u.user_id = a.user_id ORDER BY a.audit_id DESC LIMIT 5;"
```

You should see Ana's price change (95 → 105) and Ramon's approval.

## Do not click / be careful

| Avoid | Why |
|---|---|
| GCash, Maya, QR Ph, card at checkout | PayMongo is not connected. The order is placed but nothing is paid. Use COD. |
| Ending Ramon's shift before the order is delivered, or twice | One shift per day; he can't start again until `db:reset`. |
| `npm run db:reset` or `npm test` during the demo | Reset erases the order; the tests add and change data. |
| "Duplicate tab", or logging in as another role in the same tab | The tab switches to that account. |
| Photos and logos | There is no upload button in the pages (the API supports it). "Logo upload comes with the backend" is still on the restaurant form. |
| A notifications page or bell | The backend saves notifications, but there is no page for them. |
| Settings → Save new rates, gas tiers | Works, but changes the numbers in this script. |
| Suspending Maria or Ramon | Locks that account out immediately. |

If "Can't reach the server" appears: check the backend window, start it again, then click **Try again**.

**Morning demo:** some demo orders have fixed times up to 11:20 AM. Before then, they appear to be in the future
(and the "minutes ago" labels look wrong). Present after 11:30 AM, or ignore those orders.

## Likely questions

- **Why snapshots?** Prices and fees change. A receipt must never change after it is placed.
- **Why not store totals?** Two copies can disagree. We store the facts and calculate the totals with the same `calc.js` rules.
- **Can a customer see another customer's order?** No. The user comes from the login token, so someone else's order answers "not found".
- **Are passwords safe?** They are stored as bcrypt hashes and never sent to the browser.
- **Are things really deleted?** Users, restaurants and menu items are never deleted, only deactivated, so old orders stay complete.
- **How was it tested?** 111 automated backend tests, all passing, plus this whole flow run in a browser.
