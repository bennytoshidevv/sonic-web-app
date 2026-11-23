# DESIGN.md — Super Sonic Delivery (Sonic Web App)

Use this style for EVERY screen of the Super Sonic Delivery web app (Customer, Rider, Operator, Admin).
Brand source: the official "Super Sonic Delivery" logo (purple paper plane, yellow lightning bolts, bold royal-blue "DELIVERY") and the SonicSipocot Delivery Facebook posters.

## Brand personality
Fast, friendly, local, energetic. "Your lightning-fast delivery partner." Bright and confident, never corporate-gray. Clean layouts with bold blue and small yellow "lightning" accents.

## Colors

| Token | Hex | Tailwind name | Use |
|---|---|---|---|
| primary | #183CF0 | sonic-blue | Main buttons, active tabs, links, app header, price highlights |
| primary-dark | #0F27B8 | sonic-blue-dark | Button hover/pressed, header on desktop sidebar |
| primary-light | #E8ECFE | sonic-blue-50 | Selected rows, chip backgrounds, info panels |
| violet | #3F0BEB | sonic-violet | Secondary accent (from the paper plane): badges, illustrations, gradient end |
| sky | #30B4F0 | sonic-sky | Secondary backgrounds, banners, progress/tracking line |
| bolt | #FFD60A | sonic-bolt | Lightning accent: promo badges, "New", star ratings, highlight underline. Always with dark text, never as text on white |
| ink | #0B1033 | sonic-ink | Main text, dark surfaces |
| muted | #5B6386 | sonic-muted | Secondary text, labels, placeholders |
| surface | #FFFFFF | white | Cards, sheets, modals |
| background | #F5F7FF | sonic-bg | Page background |
| border | #DDE2F5 | sonic-border | Card and input borders, dividers |
| success | #16A34A | green-600 | Delivered, Paid, Open, Available |
| warning | #F59E0B | amber-500 | Pending, Preparing, low petty cash |
| danger | #DC2626 | red-600 | Cancelled, Rejected, Sold out, Closed, delete actions |

Signature gradient (hero banners, login header, rider dashboard card): linear-gradient(135deg, #183CF0 0%, #3F0BEB 100%) with a small #FFD60A lightning-bolt icon.

Accessibility: white text on #183CF0 or #3F0BEB is fine. Yellow (#FFD60A) is only a background or icon color with #0B1033 text on it.

## Typography
- Headings, buttons, prices, big numbers: **Poppins** (600–800 weight).
- Body text, tables, forms: **Inter** (400–500 weight).
- Brand display (only the logo area and hero banners): bold italic uppercase Poppins 800 to echo the "DELIVERY" logotype. Do not recreate the logo in text — use the logo image.

Scale: H1 28px / H2 22px / H3 18px / body 15px / small 13px / caption 12px. Prices and totals in Poppins 700.

## Shape, spacing, elevation
- Corner radius: 12px for cards and inputs, 9999px (pill) for buttons, chips, and status badges.
- Spacing on a 4px grid; card padding 16px (mobile) / 24px (desktop).
- Shadows: soft only — 0 2px 8px rgba(11,16,51,0.08). No heavy borders.
- Icons: rounded line icons (e.g., Lucide / Material Symbols Rounded), 20–24px. A small lightning-bolt icon is the brand motif — use it sparingly (empty states, success screens, fast-delivery badge).

## Components
- Primary button: sonic-blue pill, white Poppins 600 text, 48px tall on mobile.
- Secondary button: white pill with sonic-blue border and text.
- Danger button: red-600 pill (reject, cancel, delete).
- Input: white, 1px sonic-border, 12px radius, label above, sonic-blue focus ring.
- Card: white, 12px radius, soft shadow.
- Restaurant card: photo on top (16:9), name in Poppins 600, cuisine tags as small chips, Open (green) / Closed (red) badge on the photo.
- Menu item row: photo thumbnail right, name + short description + price (Poppins 700, sonic-blue), round "+" add button; "Sold out" items grayed with a red badge.
- Status badges (pill): Pending = amber, Confirmed = sonic-blue, Preparing = amber, Ready for Pickup = sky, Picked Up = violet, On the Way = violet, Delivered = green, Cancelled = red.
- Order tracking: vertical stepper with a sky-blue line and filled sonic-blue dots for completed steps.
- Money: always "₱" with two decimals (₱1,250.00).

## Layout by app
- **Customer** — mobile-first (390px). Top bar with logo + delivery barangay selector; bottom navigation: Home, Orders, Cart, Profile. Sticky cart/checkout bar at the bottom in sonic-blue.
- **Rider** — mobile-first (390px). Big touch targets, one main action per screen ("Picked Up", "On the Way", "Delivered"). Dashboard card uses the signature gradient with shift status and today's earnings. Bottom navigation: Dashboard, Deliveries, History.
- **Operator** — desktop-first (1440px). Left sidebar in sonic-ink with white icons and a sonic-blue active item; top bar with search and notifications; content in white cards on sonic-bg. Data tables with status badges and row actions.
- **Admin (boss)** — same layout as Operator, plus Reports (stat cards + charts in sonic-blue, violet, sky, bolt) and Settings.

## Copy and language
- English UI with friendly, short labels. Local terms are welcome where natural (e.g., "Barangay", "Pabili").
- Currency: Philippine peso (₱). Time: 12-hour (7:30 AM).
- Service hours shown in the customer app: 7:30 AM – 8:30 PM.

## Don'ts
- No generic gray dashboards, no dark mode for the first version.
- No yellow text on white. No more than one gradient per screen.
- Don't redraw the logo — place the provided logo image.
