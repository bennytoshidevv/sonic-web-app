# Super Sonic Delivery – Frontend

Capstone web app for Sonic, a local food delivery company in Sipocot, Philippines.
Sonic has no kitchen: it delivers orders from many partner restaurants.
This repo is the **frontend only**. The Express + database backend comes later.

## Tech stack
- React (Vite), JavaScript (not TypeScript)
- Tailwind CSS v4 via `@tailwindcss/vite`; design tokens live in `src/index.css` under `@theme`
- react-router-dom for routing, lucide-react for icons
- Commands: `npm run dev` (http://localhost:5173), `npm run build`

## Reference files (read these before building a screen)
- `DESIGN.md` – the design system. Follow it for every color, font, radius, shadow and component.
- `SonicDelivery_ERD_v6_MySQL.sql` – the database design. Mock data and form fields must match these tables and column names.
- `stitch-exports/` – Google Stitch designs (`<code>-<name>.html` + `.png` screenshot), e.g. `S01-login.html`.

## Design rules
- Use the `sonic-*` Tailwind tokens (`bg-sonic-blue`, `text-sonic-ink`, `border-sonic-border`, ...). Never hard-code hex colors in components.
- Headings, buttons, prices: Poppins (`font-display`). Body, tables, forms: Inter (`font-sans`).
- Cards and inputs: 12px radius. Buttons, chips, status badges: pill shape.
- Yellow (`sonic-bolt`) is only a background or icon color, never text on white. At most one gradient per screen.
- Use the logo image `src/assets/logo.jpg`. Never redraw the logo in text or SVG.
- Money: `₱1,250.00` (peso sign, two decimals). Time: 12-hour (`7:30 AM`). Use the helpers in `src/lib/format.js`.
- No dark mode, no maps, no chat, no vouchers, no push notifications in this version.

## Converting Stitch exports
- Stitch HTML is a **reference**, not code to paste. Rebuild it as React components.
- Replace Stitch's own inline Tailwind config and color names with the `sonic-*` tokens.
- Turn repeated parts into shared components in `src/components/` (Button, Input, Card, StatusBadge, ...). Reuse existing ones before making new ones.
- Use `className`, self-closing tags, and `useState` for form state.
- Afterwards, compare the result with the `.png` screenshot and fix differences.

## Folder structure
```
src/
  assets/          logo and static images
  components/      shared UI (Button, Input, Card, StatusBadge, ...)
  layouts/         AuthLayout, CustomerLayout, RiderLayout, StaffLayout (operator/admin)
  pages/
    auth/          Login, Register
    customer/      Home, RestaurantMenu, Cart, Checkout, OrderTracking, Orders, RateOrder, Profile
    rider/         Dashboard, Deliveries, DeliveryDetails, History, Wallet
    operator/      LiveOrders, OrderDetails, Restaurants, Menus, Users, Settlements
    admin/         Reports, Settings, RiderSavings
  data/mock.js     mock data shaped like the ERD tables
  lib/             format.js (money/time), calc.js (totals, rider pay)
  context/         AuthContext (logged-in user), CartContext
```

## Roles and routes
- One login for everyone. There is no role picker: after login, redirect by `users.role`
  to `/customer`, `/rider`, `/operator` or `/admin`.
- Only customers can self-register. Riders, operators and admins are created by staff.
- Block login when `account_status` is `inactive` or `suspended`.
- Protect each route group so a user can only open pages for their own role. Admin can also open operator pages.
- Customer and rider pages are mobile-first (390px). Operator and admin pages are desktop-first (1440px).

## Mock data (until the backend exists)
- Keep all mock data in `src/data/mock.js`, using the ERD table and column names
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
- Calculated values (totals, earnings, balances, average ratings) are computed in `src/lib/calc.js`, never stored in mock data.

## Working style
- Build one screen at a time, and ask before adding features that are not in DESIGN.md or the ERD.
- Keep code simple and readable: this is a student capstone that must be explained in a presentation.
