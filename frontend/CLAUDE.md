# Super Sonic Delivery – Frontend

Capstone web app for Sonic, a local food delivery company in Sipocot, Philippines.
Sonic has no kitchen: it delivers orders from many partner restaurants.
This folder (`frontend/`) is the React app. The Express + PostgreSQL API lives in `../backend`.

## Tech stack
- React (Vite), JavaScript (not TypeScript)
- Tailwind CSS v4 via `@tailwindcss/vite`; design tokens live in `src/index.css` under `@theme`
- react-router-dom for routing, lucide-react for icons
- Commands: `npm run dev` (http://localhost:5173), `npm run build`

## Reference files (read these before building a screen)
- `DESIGN.md` – the design system. Follow it for every color, font, radius, shadow and component.
- `../backend/db/schema.sql` – the database design (ERD v7, PostgreSQL; adds `favorite_restaurants`). Mock data and form fields
  must match these tables and column names. The original v6 MySQL export is kept in `../docs/erd/` for reference.
- `stitch-exports/` – Google Stitch designs (`<code>-<name>.html` + `.png` screenshot), e.g. `S01-login.html`.

## Design rules
- Use the `sonic-*` Tailwind tokens (`bg-sonic-blue`, `text-sonic-ink`, `border-sonic-border`, ...). Never hard-code hex colors in components.
- Headings, buttons, prices: Poppins (`font-display`). Body, tables, forms: Inter (`font-sans`).
- Cards and inputs: 12px radius. Buttons, chips, status badges: pill shape.
- Yellow (`sonic-bolt`) is only a background or icon color, never text on white. At most one gradient per screen.
- Use the logo image `src/shared/assets/logo.jpg`. Never redraw the logo in text or SVG.
- Money: `₱1,250.00` (peso sign, two decimals). Time: 12-hour (`7:30 AM`). Use the helpers in `src/shared/utils/format.js`.
- No dark mode, no maps, no chat, no vouchers, no push notifications in this version.

## Converting Stitch exports
- Stitch HTML is a **reference**, not code to paste. Rebuild it as React components.
- Replace Stitch's own inline Tailwind config and color names with the `sonic-*` tokens.
- Turn repeated parts into components: `src/shared/components/` when several roles use them (Button, Input, StatusBadge, ...), otherwise the role's own `components/` folder. Reuse existing ones before making new ones.
- Use `className`, self-closing tags, and `useState` for form state.
- Afterwards, compare the result with the `.png` screenshot and fix differences.

## Folder structure
Each role's code lives in its own folder; code used by several roles lives in `shared/`.
```
src/
  main.jsx, index.css
  app/             App.jsx (main router: mounts each role's routes.jsx), Providers.jsx (router + auth)
  roles/
    customer/      routes.jsx, layout/, pages/, components/, hooks/, context/ (CartContext)
                   pages: Home, RestaurantMenu, Cart, Checkout, OrderTracking, Orders, RateOrder, Profile
    rider/         routes.jsx, layout/, pages/: Dashboard, Deliveries, DeliveryDetails, History, Wallet
    operator/      routes.jsx, layout/, components/ (AssignRiderSheet), hooks/ (useStaffPaths: links for /operator or /admin),
                   pages/: LiveOrders, OrderDetails, Restaurants, Menus, Users (riders, customers, applications), Settlements
    admin/         routes.jsx, layout/, components/ (BarChart, RankedBars), pages/: Reports, Settings, RiderSavings;
                   reuses operator pages by import
  shared/
    auth/          AuthContext, RequireRole (role guard), AuthLayout, LoginPage, SignupPage
    components/    Button, Input, Select, Chip, Alert, BottomSheet, EmptyState, StatusBadge, Toast, Placeholder
    layouts/       StaffLayout (desktop sidebar for operator and admin)
    pages/         Welcome (the "/" page)
    utils/         format.js (money/time), calc.js (totals, rider pay), labels.js, validate.js
    assets/        logo.jpg
  mock/mock.js     mock data shaped like the ERD tables
```
- Import with the path aliases: `@app`, `@shared`, `@customer`, `@rider`, `@operator`, `@admin`, `@mock`
  (set in `vite.config.js` and `jsconfig.json`), e.g. `import Button from '@shared/components/Button'`.
- Admin reuses operator pages by importing them from `@operator/pages`; never copy them.

## Roles and routes
- `/` is a welcome page: a big "Order food" button for customers, smaller entries for riders and staff (operator, admin).
- Each role has its own section and login: `/customer` (`/customer/login`), `/rider` (`/rider/login`),
  `/operator` (`/operator/login`), `/admin` (`/admin/login`). All use the shared LoginPage with a per-role title.
- Any account may log in on any login page; after login the user goes to their own role's home (`users.role`).
- Sign-up: customers sign up at `/customer/register` (active right away). Riders (`/rider/apply`) and operators
  (`/operator/apply`) send an application: the account is created `inactive` until staff approve it
  (rider → an operator approves, operator → the admin approves). Admin has no public sign-up.
- Block login when `account_status` is `inactive` or `suspended`. The inactive message also covers
  "application not approved yet".
- Each section is wrapped in RequireRole: not logged in → that section's login page; wrong role → the user's own home.
  Admin can also open operator pages.
- Customer and rider pages are mobile-first (390px). Operator and admin pages are desktop-first (1440px).

## Mock data (until the backend exists)
- Keep all mock data in `src/mock/mock.js`, using the ERD table and column names
  (e.g. `users: [{ user_id, full_name, email, contact_number, role, account_status }]`).
- Customer, rider and transaction data is dummy. Restaurant and menu data may be real.
- Put data access in small functions (e.g. `login(email, password)`, `getRestaurants()`)
  so they can be swapped for real API calls (JWT auth) later without changing the pages.
- Never show or store passwords in plain text in the UI.

## Business rules the UI must show correctly
- Order statuses: `pending`, `confirmed`, `preparing`, `ready_for_pickup`, `picked_up`, `on_the_way`, `delivered`, `cancelled`.
  Badge colors are listed in DESIGN.md.
- Customers can cancel only while the order is `pending`, and rate only after `delivered`
  (1–5 stars + comment, per restaurant and for the rider).
- Delivery fee depends only on the customer's barangay (`barangays.delivery_fee`).
- A cart can hold items from several stores. The first store is the main store; each extra store adds the extra-store fee (₱10.00, from `rate_settings`).
- Order total = items subtotal + barangay delivery fee + extra-store fees.
- Sold-out items (`is_available = false`) and closed restaurants (`open_status = 'closed'`) cannot be added to the cart.
- Payment methods: `cod` (default), `gcash`, `maya`, `qr_ph`, `card`. COD stays pending until the rider collects the cash.
- Rider pay per delivery: gas allowance (from the barangay fee tier) + rider share (70% of barangay fee minus allowance) + all extra-store fees.
  Example: fee ₱250.00 → allowance ₱50.00 → share ₱140.00 → gross ₱190.00 (+₱10.00 per extra store).
- Rider deductions: ₱10.00 per delivery (operator fee), ₱10.00 per shift (box rent), ₱10.00 per shift (savings).
- Calculated values (totals, earnings, balances, average ratings) are computed in `src/shared/utils/calc.js`, never stored in mock data.
- Rate settings: the current rate is the latest `rate_settings` row whose `effective_from` has arrived; a future row is "upcoming".
  Settings changes (barangay fees, gas tiers, deductions, rates) only affect new orders/shifts and are written to `audit_logs`.

## Working style
- Build one screen at a time, and ask before adding features that are not in DESIGN.md or the ERD.
- Keep code simple and readable: this is a student capstone that must be explained in a presentation.
