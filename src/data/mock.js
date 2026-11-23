import {
  deliveryGross,
  gasAllowanceFor,
  orderExtraStoreFees,
  orderItemsSubtotal,
  orderTotal,
  pettyCashOnHand,
  settlementAmounts,
  sumAmounts,
} from '../lib/calc.js'

// Mock data shaped like the ERD tables (SonicDelivery_ERD_v6_MySQL.sql).
// The functions at the bottom will be swapped for real API calls (JWT auth) later.

// ---------- users ----------
// password_hash: SHA-256 of the demo password (the real backend will use bcrypt).
// Passwords are never stored in plain text. Demo login details are in README.md.
const DEMO_HASH = '5ae9754fc4d92edcac657e114f39eaf35aefa245c1054dafc75a00e042b49c37'

export const users = [
  {
    user_id: 1,
    full_name: 'Maria Santos',
    email: 'customer@sonic.ph',
    contact_number: '09171234567',
    password_hash: DEMO_HASH,
    role: 'customer',
    account_status: 'active',
    created_at: '2026-10-01T08:00:00',
    updated_at: '2026-10-01T08:00:00',
  },
  {
    user_id: 2,
    full_name: 'Marcelo Reyes',
    email: 'rider@sonic.ph',
    contact_number: '09181234567',
    password_hash: DEMO_HASH,
    role: 'rider',
    account_status: 'active',
    created_at: '2026-10-01T08:00:00',
    updated_at: '2026-10-01T08:00:00',
  },
  {
    user_id: 3,
    full_name: 'Ana Villanueva',
    email: 'operator@sonic.ph',
    contact_number: '09191234567',
    password_hash: DEMO_HASH,
    role: 'operator',
    account_status: 'active',
    created_at: '2026-10-01T08:00:00',
    updated_at: '2026-10-01T08:00:00',
  },
  {
    user_id: 4,
    full_name: 'Jose Dela Cruz',
    email: 'admin@sonic.ph',
    contact_number: '09201234567',
    password_hash: DEMO_HASH,
    role: 'admin',
    account_status: 'active',
    created_at: '2026-10-01T08:00:00',
    updated_at: '2026-10-01T08:00:00',
  },
  {
    user_id: 5,
    full_name: 'Pedro Garcia',
    email: 'suspended@sonic.ph',
    contact_number: '09211234567',
    password_hash: DEMO_HASH,
    role: 'rider',
    account_status: 'suspended',
    created_at: '2026-10-01T08:00:00',
    updated_at: '2026-10-15T08:00:00',
  },
  {
    user_id: 6,
    full_name: 'Liza Bautista',
    email: 'liza@sonic.ph',
    contact_number: '09221234567',
    password_hash: DEMO_HASH,
    role: 'customer',
    account_status: 'active',
    created_at: '2026-10-05T08:00:00',
    updated_at: '2026-10-05T08:00:00',
  },
]

// ---------- barangays ----------
// The delivery fee depends only on the customer's barangay (dummy fees for now).
export const barangays = [
  { barangay_id: 1, barangay_name: 'North Centro', city_municipality: 'Sipocot', delivery_fee: 40.0, is_active: true },
  { barangay_id: 2, barangay_name: 'South Centro', city_municipality: 'Sipocot', delivery_fee: 40.0, is_active: true },
  { barangay_id: 3, barangay_name: 'Impig', city_municipality: 'Sipocot', delivery_fee: 80.0, is_active: true },
  { barangay_id: 4, barangay_name: 'Tara', city_municipality: 'Sipocot', delivery_fee: 150.0, is_active: true },
  { barangay_id: 5, barangay_name: 'Mangga', city_municipality: 'Sipocot', delivery_fee: 250.0, is_active: true },
]

// ---------- customer_addresses ----------
export const customer_addresses = [
  {
    address_id: 1,
    user_id: 1,
    barangay_id: 1,
    label: 'Home',
    street_address: '12 Rizal St.',
    landmark: 'Near the public market',
    is_default: true,
    is_active: true,
  },
  {
    address_id: 2,
    user_id: 1,
    barangay_id: 3,
    label: 'Work',
    street_address: 'Impig Elementary School',
    landmark: 'Beside the barangay hall',
    is_default: false,
    is_active: true,
  },
]

// ---------- cuisine_types ----------
export const cuisine_types = [
  { cuisine_id: 1, cuisine_name: 'Filipino' },
  { cuisine_id: 2, cuisine_name: 'Fast food' },
  { cuisine_id: 3, cuisine_name: 'Silog' },
  { cuisine_id: 4, cuisine_name: 'Milk tea' },
  { cuisine_id: 5, cuisine_name: 'Pizza' },
  { cuisine_id: 6, cuisine_name: 'Desserts' },
]

// ---------- restaurants ----------
// Dummy restaurants from the Stitch design. Replace with the real partner restaurants.
// logo_url: put images in src/assets (or a URL) later; null shows a placeholder.
export const restaurants = [
  {
    restaurant_id: 1,
    name: 'Kusina ni Aling Rosa',
    description: 'Comfort breakfast and all-day silog meals',
    address: 'Rizal St., North Centro, Sipocot',
    contact_number: '09171110001',
    logo_url: null,
    open_status: 'open',
    is_active: true,
    created_at: '2026-10-01T08:00:00',
    updated_at: '2026-10-01T08:00:00',
  },
  {
    restaurant_id: 2,
    name: 'Golden Roast Express',
    description: 'Lechon manok and Filipino favorites',
    address: 'Maharlika Hwy., South Centro, Sipocot',
    contact_number: '09171110002',
    logo_url: null,
    open_status: 'open',
    is_active: true,
    created_at: '2026-10-01T08:00:00',
    updated_at: '2026-10-01T08:00:00',
  },
  {
    restaurant_id: 3,
    name: 'Sipocot Pearl Milk Tea & Snacks',
    description: 'Milk tea, fries and sweet treats',
    address: 'Mabini St., North Centro, Sipocot',
    contact_number: '09171110003',
    logo_url: null,
    open_status: 'open',
    is_active: true,
    created_at: '2026-10-01T08:00:00',
    updated_at: '2026-10-01T08:00:00',
  },
  {
    restaurant_id: 4,
    name: "Lola Nena's Halo-Halo",
    description: 'Halo-halo, turon and native kakanin',
    address: 'Burgos St., South Centro, Sipocot',
    contact_number: '09171110004',
    logo_url: null,
    open_status: 'open',
    is_active: true,
    created_at: '2026-10-01T08:00:00',
    updated_at: '2026-10-01T08:00:00',
  },
  {
    restaurant_id: 5,
    name: 'Crispy Crust Pizzeria',
    description: 'Oven-baked pizza and pasta',
    address: 'Maharlika Hwy., Impig, Sipocot',
    contact_number: '09171110005',
    logo_url: null,
    open_status: 'closed',
    is_active: true,
    created_at: '2026-10-01T08:00:00',
    updated_at: '2026-10-01T08:00:00',
  },
  {
    restaurant_id: 6,
    name: 'Old Town Bakery',
    description: 'Pandesal and breads',
    address: 'Rizal St., North Centro, Sipocot',
    contact_number: '09171110006',
    logo_url: null,
    open_status: 'closed',
    is_active: false, // disabled by staff: hidden from customers
    created_at: '2026-10-01T08:00:00',
    updated_at: '2026-11-01T08:00:00',
  },
]

// ---------- restaurant_cuisines ----------
export const restaurant_cuisines = [
  { restaurant_id: 1, cuisine_id: 1 },
  { restaurant_id: 1, cuisine_id: 3 },
  { restaurant_id: 2, cuisine_id: 2 },
  { restaurant_id: 2, cuisine_id: 1 },
  { restaurant_id: 3, cuisine_id: 4 },
  { restaurant_id: 3, cuisine_id: 6 },
  { restaurant_id: 4, cuisine_id: 6 },
  { restaurant_id: 4, cuisine_id: 1 },
  { restaurant_id: 5, cuisine_id: 5 },
  { restaurant_id: 5, cuisine_id: 2 },
  { restaurant_id: 6, cuisine_id: 1 },
]

// ---------- restaurant_hours ----------
// day_of_week: 0 = Sunday ... 6 = Saturday. Times use the MySQL TIME format.
let nextHoursId = 1
function weeklyHours(restaurant_id, open_time, close_time, closedDays = []) {
  return [0, 1, 2, 3, 4, 5, 6]
    .filter((day) => !closedDays.includes(day))
    .map((day_of_week) => ({ hours_id: nextHoursId++, restaurant_id, day_of_week, open_time, close_time }))
}

export const restaurant_hours = [
  ...weeklyHours(1, '07:30:00', '20:00:00'),
  ...weeklyHours(2, '08:00:00', '20:30:00'),
  ...weeklyHours(3, '09:00:00', '19:30:00'),
  ...weeklyHours(4, '10:00:00', '20:00:00', [0]), // closed on Sundays
  ...weeklyHours(5, '10:00:00', '20:30:00'),
  ...weeklyHours(6, '07:30:00', '18:00:00'),
]

// ---------- menu_categories ----------
export const menu_categories = [
  { menu_category_id: 1, restaurant_id: 1, category_name: 'Silog Meals', display_order: 1, is_active: true },
  { menu_category_id: 2, restaurant_id: 1, category_name: 'Rice Bowls', display_order: 2, is_active: true },
  { menu_category_id: 3, restaurant_id: 1, category_name: 'Drinks', display_order: 3, is_active: true },
  { menu_category_id: 4, restaurant_id: 2, category_name: 'Lechon Manok', display_order: 1, is_active: true },
  { menu_category_id: 5, restaurant_id: 2, category_name: 'Sides & Drinks', display_order: 2, is_active: true },
  { menu_category_id: 6, restaurant_id: 3, category_name: 'Milk Tea', display_order: 1, is_active: true },
  { menu_category_id: 7, restaurant_id: 3, category_name: 'Snacks', display_order: 2, is_active: true },
  { menu_category_id: 8, restaurant_id: 4, category_name: 'Halo-Halo', display_order: 1, is_active: true },
  { menu_category_id: 9, restaurant_id: 4, category_name: 'Kakanin', display_order: 2, is_active: true },
  { menu_category_id: 10, restaurant_id: 5, category_name: 'Pizza', display_order: 1, is_active: true },
  { menu_category_id: 11, restaurant_id: 5, category_name: 'Pasta', display_order: 2, is_active: true },
]

// ---------- menu_items ----------
// is_available = false means sold out. photo_url null shows a placeholder.
function menuItem(item_id, menu_category_id, name, price, description, is_available = true) {
  return { item_id, menu_category_id, name, description, price, photo_url: null, is_available, is_active: true, updated_at: '2026-11-01T08:00:00' }
}

export const menu_items = [
  menuItem(1, 1, 'Tapsilog', 95.0, 'Cured beef tapa with garlic fried rice, sunny-side-up egg and spiced vinegar.'),
  menuItem(2, 1, 'Longsilog', 85.0, 'Sweet pork longganisa with garlic rice, egg and atchara.'),
  menuItem(3, 1, 'Bangsilog', 110.0, 'Fried marinated bangus belly with garlic rice and egg.', false),
  menuItem(4, 1, 'Tocilog', 85.0, 'Sweet pork tocino with garlic rice and egg.'),
  menuItem(5, 2, 'Pork Adobo Rice Bowl', 99.0, 'Classic pork adobo over steamed rice.'),
  menuItem(6, 2, 'Bicol Express Rice Bowl', 105.0, 'Pork in spicy coconut milk with chili, over rice.'),
  menuItem(7, 3, 'House Blend Iced Tea', 25.0, 'Black tea with calamansi and honey (16 oz).'),
  menuItem(8, 3, 'Bottled Water', 15.0, '500 ml.'),
  menuItem(9, 4, 'Whole Lechon Manok', 320.0, 'Whole roasted chicken with liver sauce.'),
  menuItem(10, 4, 'Half Lechon Manok', 165.0, 'Half roasted chicken with liver sauce.'),
  menuItem(11, 5, 'Java Rice', 25.0, 'One cup of java rice.'),
  menuItem(12, 5, 'Coke Mismo', 20.0, '295 ml bottle.'),
  menuItem(13, 6, 'Brown Sugar Milk Tea', 79.0, 'Brown sugar syrup, fresh milk and tapioca pearls (16 oz).'),
  menuItem(14, 6, 'Taro Milk Tea', 75.0, 'Creamy taro milk tea with pearls (16 oz).'),
  menuItem(15, 6, 'Wintermelon Milk Tea', 69.0, 'Wintermelon milk tea with pearls (16 oz).', false),
  menuItem(16, 7, 'Cheesy Fries', 55.0, 'Shoestring fries with cheese powder.'),
  menuItem(17, 7, 'Siomai (4 pcs)', 45.0, 'Pork siomai with chili garlic and soy sauce.'),
  menuItem(18, 8, 'Halo-Halo Special', 85.0, 'Shaved ice, leche flan, ube, beans and milk.'),
  menuItem(19, 8, 'Mais con Yelo', 55.0, 'Sweet corn, shaved ice and milk.'),
  menuItem(20, 9, 'Turon (3 pcs)', 30.0, 'Banana and langka in crispy wrapper.'),
  menuItem(21, 9, 'Biko', 40.0, 'Sticky rice cake with latik.'),
  menuItem(22, 10, 'Pepperoni Pizza (10")', 299.0, 'Tomato sauce, mozzarella and pepperoni.'),
  menuItem(23, 10, 'Hawaiian Pizza (10")', 279.0, 'Ham, pineapple and mozzarella.'),
  menuItem(24, 11, 'Carbonara', 149.0, 'Creamy carbonara with bacon and garlic bread.'),
]

// ---------- restaurant_reviews ----------
// One review per delivered order per restaurant (order_id points to customer_orders, mocked later).
export const restaurant_reviews = [
  { review_id: 1, order_id: 1, restaurant_id: 1, rating: 5, comment: 'Masarap ang tapa!', created_at: '2026-11-02T09:00:00' },
  { review_id: 2, order_id: 2, restaurant_id: 1, rating: 5, comment: 'Fast and still hot.', created_at: '2026-11-05T08:30:00' },
  { review_id: 3, order_id: 3, restaurant_id: 1, rating: 4, comment: null, created_at: '2026-11-09T12:10:00' },
  { review_id: 4, order_id: 4, restaurant_id: 2, rating: 4, comment: 'Juicy chicken.', created_at: '2026-11-06T18:00:00' },
  { review_id: 5, order_id: 5, restaurant_id: 2, rating: 5, comment: null, created_at: '2026-11-10T17:45:00' },
  { review_id: 6, order_id: 6, restaurant_id: 3, rating: 5, comment: 'Sakto ang tamis.', created_at: '2026-11-11T15:20:00' },
  { review_id: 7, order_id: 1005, restaurant_id: 3, rating: 5, comment: 'Mabilis dumating!', created_at: '2026-11-15T16:10:00' },
]

// ---------- rider_reviews ----------
// One review per delivered order. The rider is the rider of the completed delivery assignment.
export const rider_reviews = [
  { review_id: 1, order_id: 1005, rating: 5, comment: 'Polite & friendly, Fast delivery.', created_at: '2026-11-15T16:10:00' },
]

// ---------- rate_settings ----------
// The latest row (by effective_from) is the one in use.
export const rate_settings = [
  { setting_id: 1, extra_store_fee: 10.0, rider_share_pct: 70.0, effective_from: '2026-10-01T00:00:00', created_by: 4 },
]

// ---------- favorite_restaurants (NOT in the ERD yet) ----------
// A customer's liked restaurants. Proposed table for the backend:
//   favorite_restaurants(user_id, restaurant_id, created_at), PRIMARY KEY (user_id, restaurant_id)
export const favorite_restaurants = [{ user_id: 1, restaurant_id: 2, created_at: '2026-11-03T10:00:00' }]

// ---------- helpers ----------

// Turns a password into a SHA-256 hex string (stand-in for bcrypt on the server).
async function hashPassword(password) {
  const bytes = new TextEncoder().encode(password)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// Never send password_hash to the pages.
function withoutPassword(user) {
  const { password_hash: _hidden, ...safeUser } = user
  return safeUser
}

function findUserByEmail(email) {
  const wanted = email.trim().toLowerCase()
  return users.find((u) => u.email.toLowerCase() === wanted)
}

// ---------- data access ----------

// Returns { user } on success or { error } with 'invalid', 'suspended' or 'inactive'.
export async function login(email, password) {
  const user = findUserByEmail(email)
  if (!user) return { error: 'invalid' }

  const hash = await hashPassword(password)
  if (hash !== user.password_hash) return { error: 'invalid' }

  if (user.account_status === 'suspended') return { error: 'suspended' }
  if (user.account_status === 'inactive') return { error: 'inactive' }

  return { user: withoutPassword(user) }
}

// Only customers can self-register. Returns { user } or { error: 'email_taken' }.
export async function registerCustomer({ full_name, email, contact_number, password }) {
  if (findUserByEmail(email)) return { error: 'email_taken' }

  const now = new Date().toISOString()
  const newUser = {
    user_id: users.length + 1,
    full_name: full_name.trim(),
    email: email.trim().toLowerCase(),
    contact_number,
    password_hash: await hashPassword(password),
    role: 'customer',
    account_status: 'active',
    created_at: now,
    updated_at: now,
  }
  users.push(newUser)
  return { user: withoutPassword(newUser) }
}

// Adds the cuisine names and opening hours to a restaurant row
// (like the API will return it: restaurants joined with restaurant_cuisines and restaurant_hours).
function withDetails(r) {
  return {
    ...r,
    cuisines: restaurant_cuisines
      .filter((rc) => rc.restaurant_id === r.restaurant_id)
      .map((rc) => cuisine_types.find((c) => c.cuisine_id === rc.cuisine_id).cuisine_name),
    hours: restaurant_hours.filter((h) => h.restaurant_id === r.restaurant_id),
  }
}

// Active restaurants for the customer Home screen.
export async function getRestaurants() {
  return restaurants.filter((r) => r.is_active).map(withDetails)
}

// One active restaurant, or null if it does not exist or is disabled.
export async function getRestaurant(restaurant_id) {
  const restaurant = restaurants.find((r) => r.restaurant_id === restaurant_id && r.is_active)
  return restaurant ? withDetails(restaurant) : null
}

// A restaurant's active menu categories (in display order), each with its active items.
export async function getMenu(restaurant_id) {
  return menu_categories
    .filter((c) => c.restaurant_id === restaurant_id && c.is_active)
    .sort((a, b) => a.display_order - b.display_order)
    .map((c) => ({
      ...c,
      items: menu_items.filter((i) => i.menu_category_id === c.menu_category_id && i.is_active),
    }))
}

export async function getRestaurantReviews(restaurant_id) {
  return restaurant_reviews.filter((r) => r.restaurant_id === restaurant_id)
}

// The rate settings in use (the latest effective_from).
export async function getRateSettings() {
  return [...rate_settings].sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0]
}

export async function isFavoriteRestaurant(user_id, restaurant_id) {
  return favorite_restaurants.some((f) => f.user_id === user_id && f.restaurant_id === restaurant_id)
}

// Like (true) or unlike (false) a restaurant.
export async function setFavoriteRestaurant(user_id, restaurant_id, liked) {
  const index = favorite_restaurants.findIndex((f) => f.user_id === user_id && f.restaurant_id === restaurant_id)
  if (liked && index === -1) {
    favorite_restaurants.push({ user_id, restaurant_id, created_at: new Date().toISOString() })
  } else if (!liked && index !== -1) {
    favorite_restaurants.splice(index, 1)
  }
}

export async function getCuisineTypes() {
  return cuisine_types
}

// A customer's saved addresses, each with its barangay name and delivery fee.
export async function getCustomerAddresses(user_id) {
  return customer_addresses
    .filter((a) => a.user_id === user_id && a.is_active)
    .map((a) => {
      const barangay = barangays.find((b) => b.barangay_id === a.barangay_id)
      return {
        ...a,
        barangay_name: barangay.barangay_name,
        city_municipality: barangay.city_municipality,
        delivery_fee: barangay.delivery_fee,
      }
    })
}

// Current data for the items in a cart: each menu item with its restaurant's status, so the cart
// can show items that became sold out, or whose restaurant closed, since they were added.
// Inactive items and restaurants are included (flagged), so the cart can ask to remove them.
export async function getCartItemDetails(item_ids) {
  return menu_items
    .filter((item) => item_ids.includes(item.item_id))
    .map((item) => {
      const category = menu_categories.find((c) => c.menu_category_id === item.menu_category_id)
      const r = restaurants.find((x) => x.restaurant_id === category.restaurant_id)
      return {
        ...item,
        restaurant: {
          restaurant_id: r.restaurant_id,
          name: r.name,
          description: r.description,
          open_status: r.open_status,
          is_active: r.is_active,
        },
      }
    })
}

// ---------- rider_profiles ----------
export const rider_profiles = [
  { user_id: 2, vehicle_type: 'Motorcycle', plate_number: 'ABC 1234', availability_status: 'busy' },
  { user_id: 5, vehicle_type: 'Motorcycle', plate_number: 'XYZ 5678', availability_status: 'offline' },
]

// ---------- orders ----------
// Demo orders for Maria (user 1), one per state the tracking page shows:
//   1001 on_the_way (2 stores, rider assigned), 1002 delivered, 1003 cancelled, 1004 pending,
//   1005 delivered and already rated.
// Orders placed at checkout are added after these (1006, 1007, ...).
// Timestamps without a time zone are read as local time.

// "07:32" → today's date at that local time, e.g. "2026-11-22T07:32:00".
// Used for the demo data of "today" (active orders, the rider's open shift).
function todayAt(time) {
  const d = new Date()
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return `${date}T${time}:00`
}

function demoOrder(order_id, order_status, base_delivery_fee, placed_at, extra = {}) {
  return {
    order_id,
    order_number: `SSD-${placed_at.slice(0, 10).replaceAll('-', '')}-${order_id}`,
    customer_id: 1,
    order_status,
    base_delivery_fee,
    order_notes: null,
    dropoff_street: '12 Rizal St.',
    dropoff_barangay: 'North Centro',
    dropoff_city: 'Sipocot',
    dropoff_landmark: 'Near the public market',
    cancellation_reason: null,
    placed_at,
    ...extra,
  }
}

export const customer_orders = [
  demoOrder(1001, 'on_the_way', 40.0, todayAt('10:05'), { order_notes: 'Extra rice, please call when outside.' }),
  demoOrder(1002, 'delivered', 40.0, '2026-11-20T18:02:00'),
  demoOrder(1003, 'cancelled', 40.0, '2026-11-19T12:15:00', { cancellation_reason: 'Ordered by mistake.' }),
  demoOrder(1004, 'pending', 40.0, todayAt('11:20')),
  demoOrder(1005, 'delivered', 40.0, '2026-11-15T15:30:00'),
]

export const order_restaurants = [
  { order_id: 1001, restaurant_id: 1, is_primary: true, extra_store_fee: 0 },
  { order_id: 1001, restaurant_id: 3, is_primary: false, extra_store_fee: 10.0 },
  { order_id: 1002, restaurant_id: 2, is_primary: true, extra_store_fee: 0 },
  { order_id: 1003, restaurant_id: 5, is_primary: true, extra_store_fee: 0 },
  { order_id: 1004, restaurant_id: 4, is_primary: true, extra_store_fee: 0 },
  { order_id: 1005, restaurant_id: 3, is_primary: true, extra_store_fee: 0 },
]

export const order_items = [
  { order_item_id: 1, order_id: 1001, item_id: 1, quantity: 2, unit_price: 95.0, item_name: 'Tapsilog' },
  { order_item_id: 2, order_id: 1001, item_id: 7, quantity: 1, unit_price: 25.0, item_name: 'House Blend Iced Tea' },
  { order_item_id: 3, order_id: 1001, item_id: 13, quantity: 1, unit_price: 79.0, item_name: 'Brown Sugar Milk Tea' },
  { order_item_id: 4, order_id: 1002, item_id: 10, quantity: 1, unit_price: 165.0, item_name: 'Half Lechon Manok' },
  { order_item_id: 5, order_id: 1002, item_id: 11, quantity: 2, unit_price: 25.0, item_name: 'Java Rice' },
  { order_item_id: 6, order_id: 1003, item_id: 22, quantity: 1, unit_price: 299.0, item_name: 'Pepperoni Pizza (10")' },
  { order_item_id: 7, order_id: 1004, item_id: 18, quantity: 2, unit_price: 85.0, item_name: 'Halo-Halo Special' },
  { order_item_id: 8, order_id: 1005, item_id: 13, quantity: 2, unit_price: 79.0, item_name: 'Brown Sugar Milk Tea' },
]

// changed_by: 1 = customer, 3 = operator, 2 = rider
function history(history_id, order_id, status, changed_at, changed_by, remarks = null) {
  return { history_id, order_id, status, changed_by, changed_at, remarks }
}

export const order_status_history = [
  history(1, 1001, 'pending', todayAt('10:05'), 1),
  history(2, 1001, 'confirmed', todayAt('10:07'), 3),
  history(3, 1001, 'preparing', todayAt('10:10'), 3),
  history(4, 1001, 'ready_for_pickup', todayAt('10:28'), 3),
  history(5, 1001, 'picked_up', todayAt('10:35'), 2),
  history(6, 1001, 'on_the_way', todayAt('10:38'), 2),
  history(7, 1002, 'pending', '2026-11-20T18:02:00', 1),
  history(8, 1002, 'confirmed', '2026-11-20T18:04:00', 3),
  history(9, 1002, 'preparing', '2026-11-20T18:06:00', 3),
  history(10, 1002, 'ready_for_pickup', '2026-11-20T18:25:00', 3),
  history(11, 1002, 'picked_up', '2026-11-20T18:31:00', 2),
  history(12, 1002, 'on_the_way', '2026-11-20T18:33:00', 2),
  history(13, 1002, 'delivered', '2026-11-20T18:49:00', 2),
  history(14, 1003, 'pending', '2026-11-19T12:15:00', 1),
  history(15, 1003, 'cancelled', '2026-11-19T12:18:00', 1),
  history(16, 1004, 'pending', todayAt('11:20'), 1),
  history(17, 1005, 'pending', '2026-11-15T15:30:00', 1),
  history(18, 1005, 'confirmed', '2026-11-15T15:31:00', 3),
  history(19, 1005, 'preparing', '2026-11-15T15:33:00', 3),
  history(20, 1005, 'ready_for_pickup', '2026-11-15T15:45:00', 3),
  history(21, 1005, 'picked_up', '2026-11-15T15:50:00', 2),
  history(22, 1005, 'on_the_way', '2026-11-15T15:51:00', 2),
  history(23, 1005, 'delivered', '2026-11-15T16:04:00', 2),
]

export const payments = [
  { payment_id: 1, order_id: 1001, payment_method: 'cod', amount: 344.0, payment_status: 'pending', provider_reference_id: null, created_at: todayAt('10:05'), paid_at: null },
  { payment_id: 2, order_id: 1002, payment_method: 'cod', amount: 255.0, payment_status: 'paid', provider_reference_id: null, created_at: '2026-11-20T18:02:00', paid_at: '2026-11-20T18:49:00' },
  { payment_id: 3, order_id: 1003, payment_method: 'cod', amount: 339.0, payment_status: 'pending', provider_reference_id: null, created_at: '2026-11-19T12:15:00', paid_at: null },
  { payment_id: 4, order_id: 1004, payment_method: 'gcash', amount: 210.0, payment_status: 'pending', provider_reference_id: null, created_at: todayAt('11:20'), paid_at: null },
  { payment_id: 5, order_id: 1005, payment_method: 'cod', amount: 198.0, payment_status: 'paid', provider_reference_id: null, created_at: '2026-11-15T15:30:00', paid_at: '2026-11-15T16:04:00' },
]

// ---------- deliveries + delivery_assignments ----------
// The current rider of a delivery is the assignment with ended_at = null.
export const deliveries = [
  { delivery_id: 1, order_id: 1001, delivery_status: 'on_the_way', created_at: todayAt('10:28'), picked_up_at: todayAt('10:35'), delivered_at: null },
  { delivery_id: 2, order_id: 1002, delivery_status: 'delivered', created_at: '2026-11-20T18:25:00', picked_up_at: '2026-11-20T18:31:00', delivered_at: '2026-11-20T18:49:00' },
  { delivery_id: 3, order_id: 1005, delivery_status: 'delivered', created_at: '2026-11-15T15:45:00', picked_up_at: '2026-11-15T15:50:00', delivered_at: '2026-11-15T16:04:00' },
]

export const delivery_assignments = [
  { assignment_id: 1, delivery_id: 1, rider_id: 2, assigned_by: 3, assigned_at: todayAt('10:28'), response_status: 'accepted', responded_at: todayAt('10:29'), ended_at: null, end_reason: null },
  { assignment_id: 2, delivery_id: 2, rider_id: 2, assigned_by: 3, assigned_at: '2026-11-20T18:25:00', response_status: 'accepted', responded_at: '2026-11-20T18:26:00', ended_at: '2026-11-20T18:49:00', end_reason: 'completed' },
  { assignment_id: 3, delivery_id: 3, rider_id: 2, assigned_by: 3, assigned_at: '2026-11-15T15:45:00', response_status: 'accepted', responded_at: '2026-11-15T15:46:00', ended_at: '2026-11-15T16:04:00', end_reason: 'completed' },
]

export async function getBarangays() {
  return barangays.filter((b) => b.is_active)
}

// Saves a new address for a customer. The first address becomes the default.
// Returns the address with its barangay name, city and delivery fee (like getCustomerAddresses).
export async function addCustomerAddress({ user_id, barangay_id, label, street_address, landmark, is_default = false }) {
  const isFirst = !customer_addresses.some((a) => a.user_id === user_id && a.is_active)
  if (is_default) clearDefaultAddress(user_id)
  const address = {
    address_id: customer_addresses.length + 1,
    user_id,
    barangay_id,
    label,
    street_address,
    landmark,
    is_default: isFirst || is_default,
    is_active: true,
  }
  customer_addresses.push(address)
  const barangay = barangays.find((b) => b.barangay_id === barangay_id)
  return {
    ...address,
    barangay_name: barangay.barangay_name,
    city_municipality: barangay.city_municipality,
    delivery_fee: barangay.delivery_fee,
  }
}

// Places an order: one customer_orders row with an address snapshot, one order_restaurants row per
// store (the first is the primary store, the others pay the extra-store fee), the order_items with
// frozen name and price, the first order_status_history row and a pending payment.
// Like the real API, it checks again that every item can still be ordered.
// Returns { order } or { error: 'unavailable' }.
export async function placeOrder({ customer_id, address, lines, stores, payment_method, order_notes, amount }) {
  for (const line of lines) {
    const item = menu_items.find((i) => i.item_id === line.item_id)
    const category = item && menu_categories.find((c) => c.menu_category_id === item.menu_category_id)
    const restaurant = category && restaurants.find((r) => r.restaurant_id === category.restaurant_id)
    if (!item || !item.is_active || !item.is_available || !restaurant.is_active || restaurant.open_status !== 'open') {
      return { error: 'unavailable' }
    }
  }

  const rate = await getRateSettings()
  const now = new Date()
  const order_id = 1001 + customer_orders.length
  const datePart = now.toISOString().slice(0, 10).replaceAll('-', '')

  const order = {
    order_id,
    order_number: `SSD-${datePart}-${order_id}`,
    customer_id,
    order_status: 'pending',
    base_delivery_fee: address.delivery_fee,
    order_notes: order_notes || null,
    dropoff_street: address.street_address,
    dropoff_barangay: address.barangay_name,
    dropoff_city: address.city_municipality,
    dropoff_landmark: address.landmark || null,
    cancellation_reason: null,
    placed_at: now.toISOString(),
  }
  customer_orders.push(order)

  stores.forEach((store, index) => {
    order_restaurants.push({
      order_id,
      restaurant_id: store.restaurant_id,
      is_primary: index === 0,
      extra_store_fee: index === 0 ? 0 : rate.extra_store_fee,
    })
  })

  for (const line of lines) {
    order_items.push({
      order_item_id: order_items.length + 1,
      order_id,
      item_id: line.item_id,
      quantity: line.quantity,
      unit_price: line.price,
      item_name: line.name,
    })
  }

  order_status_history.push({
    history_id: order_status_history.length + 1,
    order_id,
    status: 'pending',
    changed_by: customer_id,
    changed_at: now.toISOString(),
    remarks: null,
  })

  // COD stays pending until the rider collects the cash. Online methods stay pending until
  // PayMongo confirms the payment (backend, later).
  payments.push({
    payment_id: payments.length + 1,
    order_id,
    payment_method,
    amount,
    payment_status: 'pending',
    provider_reference_id: null,
    created_at: now.toISOString(),
    paid_at: null,
  })

  return { order }
}

// One order with everything the tracking page shows, or null if it is not this customer's order.
// Returns { order, stores, history, payment, rider }:
//   stores  = order_restaurants with the restaurant name and that store's order_items
//   history = order_status_history, oldest first
//   payment = the latest payments row
//   rider   = the current (or completing) rider with vehicle details, or null if none yet
export async function getOrderDetails(order_id, customer_id) {
  const order = customer_orders.find((o) => o.order_id === order_id && o.customer_id === customer_id)
  if (!order) return null

  const items = order_items.filter((i) => i.order_id === order_id)
  const stores = order_restaurants
    .filter((r) => r.order_id === order_id)
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
    .map((r) => {
      const restaurant = restaurants.find((x) => x.restaurant_id === r.restaurant_id)
      return {
        ...r,
        name: restaurant.name,
        items: items.filter((i) => {
          const item = menu_items.find((m) => m.item_id === i.item_id)
          const category = menu_categories.find((c) => c.menu_category_id === item.menu_category_id)
          return category.restaurant_id === r.restaurant_id
        }),
      }
    })

  // Rows are added in the order they happen, so the list is already oldest first
  const orderHistory = order_status_history.filter((h) => h.order_id === order_id)

  const orderPayments = payments.filter((p) => p.order_id === order_id)
  const payment = orderPayments[orderPayments.length - 1] || null

  let rider = null
  const delivery = deliveries.find((d) => d.order_id === order_id)
  if (delivery) {
    const assignments = delivery_assignments.filter((a) => a.delivery_id === delivery.delivery_id)
    const current =
      assignments.find((a) => a.ended_at === null && a.response_status === 'accepted') ||
      assignments.find((a) => a.end_reason === 'completed')
    if (current) {
      const user = users.find((u) => u.user_id === current.rider_id)
      const profile = rider_profiles.find((p) => p.user_id === current.rider_id)
      rider = {
        user_id: user.user_id,
        full_name: user.full_name,
        contact_number: user.contact_number,
        vehicle_type: profile.vehicle_type,
        plate_number: profile.plate_number,
      }
    }
  }

  return { order: { ...order }, stores, history: orderHistory, payment, rider }
}

// Customers can cancel only while the order is pending.
// Returns { order } or { error: 'not_cancellable' }.
export async function cancelOrder(order_id, customer_id, reason) {
  const order = customer_orders.find((o) => o.order_id === order_id && o.customer_id === customer_id)
  if (!order || order.order_status !== 'pending') return { error: 'not_cancellable' }

  order.order_status = 'cancelled'
  order.cancellation_reason = reason
  order_status_history.push({
    history_id: order_status_history.length + 1,
    order_id,
    status: 'cancelled',
    changed_by: customer_id,
    changed_at: new Date().toISOString(),
    remarks: reason,
  })
  return { order: { ...order } }
}

// All orders of a customer, newest first. Each entry is getOrderDetails() plus the
// restaurant_reviews of that order (empty if it was not rated yet).
export async function getCustomerOrders(customer_id) {
  const own = customer_orders
    .filter((o) => o.customer_id === customer_id)
    .sort((a, b) => new Date(b.placed_at) - new Date(a.placed_at))
  return Promise.all(
    own.map(async (o) => ({
      ...(await getOrderDetails(o.order_id, customer_id)),
      reviews: restaurant_reviews.filter((r) => r.order_id === o.order_id),
    })),
  )
}

// Reviews already given for an order: { restaurantReviews: [...], riderReview: row or null }
export async function getOrderReviews(order_id) {
  return {
    restaurantReviews: restaurant_reviews.filter((r) => r.order_id === order_id),
    riderReview: rider_reviews.find((r) => r.order_id === order_id) || null,
  }
}

// All reviews of one rider (through the completed delivery assignments). Used for the rider's average.
export async function getRiderReviews(rider_id) {
  const orderIds = delivery_assignments
    .filter((a) => a.rider_id === rider_id && a.end_reason === 'completed')
    .map((a) => deliveries.find((d) => d.delivery_id === a.delivery_id).order_id)
  return rider_reviews.filter((r) => orderIds.includes(r.order_id))
}

// Saves the ratings of a delivered order: one restaurant_reviews row per store and one rider_reviews row.
// restaurantRatings = [{ restaurant_id, rating, comment }], riderRating = { rating, comment } or null.
// Returns { ok: true } or { error: 'not_delivered' | 'already_rated' | 'invalid' }.
export async function submitOrderReviews({ order_id, customer_id, restaurantRatings, riderRating }) {
  const order = customer_orders.find((o) => o.order_id === order_id && o.customer_id === customer_id)
  if (!order || order.order_status !== 'delivered') return { error: 'not_delivered' }
  if (restaurant_reviews.some((r) => r.order_id === order_id) || rider_reviews.some((r) => r.order_id === order_id)) {
    return { error: 'already_rated' }
  }
  const allRatings = [...restaurantRatings, ...(riderRating ? [riderRating] : [])]
  if (allRatings.some((r) => !Number.isInteger(r.rating) || r.rating < 1 || r.rating > 5)) return { error: 'invalid' }

  const now = new Date().toISOString()
  for (const r of restaurantRatings) {
    restaurant_reviews.push({
      review_id: restaurant_reviews.length + 1,
      order_id,
      restaurant_id: r.restaurant_id,
      rating: r.rating,
      comment: r.comment || null,
      created_at: now,
    })
  }
  if (riderRating) {
    rider_reviews.push({
      review_id: rider_reviews.length + 1,
      order_id,
      rating: riderRating.rating,
      comment: riderRating.comment || null,
      created_at: now,
    })
  }
  return { ok: true }
}

// ---------- profile ----------

// Updates a user's own details. Returns { user } (without password) or { error: 'email_taken' }.
export async function updateUserProfile(user_id, { full_name, email, contact_number }) {
  const cleanEmail = email.trim().toLowerCase()
  if (users.some((u) => u.user_id !== user_id && u.email.toLowerCase() === cleanEmail)) return { error: 'email_taken' }

  const user = users.find((u) => u.user_id === user_id)
  user.full_name = full_name.trim()
  user.email = cleanEmail
  user.contact_number = contact_number
  user.updated_at = new Date().toISOString()
  return { user: withoutPassword(user) }
}

// Returns { ok: true } or { error: 'wrong_password' }.
export async function changePassword(user_id, current_password, new_password) {
  const user = users.find((u) => u.user_id === user_id)
  if ((await hashPassword(current_password)) !== user.password_hash) return { error: 'wrong_password' }
  user.password_hash = await hashPassword(new_password)
  user.updated_at = new Date().toISOString()
  return { ok: true }
}

// Only one default address per customer
function clearDefaultAddress(user_id) {
  for (const a of customer_addresses) {
    if (a.user_id === user_id) a.is_default = false
  }
}

function findOwnAddress(user_id, address_id) {
  return customer_addresses.find((a) => a.address_id === address_id && a.user_id === user_id && a.is_active)
}

export async function updateCustomerAddress(user_id, address_id, { label, barangay_id, street_address, landmark, is_default }) {
  const address = findOwnAddress(user_id, address_id)
  if (!address) return { error: 'not_found' }
  if (is_default) clearDefaultAddress(user_id)
  Object.assign(address, { label, barangay_id, street_address, landmark, is_default: is_default || address.is_default })
  return { ok: true }
}

export async function setDefaultAddress(user_id, address_id) {
  const address = findOwnAddress(user_id, address_id)
  if (!address) return { error: 'not_found' }
  clearDefaultAddress(user_id)
  address.is_default = true
  return { ok: true }
}

// Soft delete (is_active = false). If it was the default, the next saved address becomes the default.
// Past orders keep their own copy of the address, so they are not affected.
export async function deleteCustomerAddress(user_id, address_id) {
  const address = findOwnAddress(user_id, address_id)
  if (!address) return { error: 'not_found' }
  address.is_active = false
  if (address.is_default) {
    address.is_default = false
    const next = customer_addresses.find((a) => a.user_id === user_id && a.is_active)
    if (next) next.is_default = true
  }
  return { ok: true }
}

// =====================================================================
// RIDER: pay settings, shifts, earnings, deductions, petty cash
// =====================================================================

// ---------- gas_allowance_tiers (PLACEHOLDER amounts: replace with Sonic's real tiers) ----------
// By barangay delivery fee (extra-store fees excluded). Below the lowest tier = no allowance.
// Matches the CLAUDE.md example: fee ₱250.00 → allowance ₱50.00.
export const gas_allowance_tiers = [
  { tier_id: 1, min_delivery_fee: 51.0, max_delivery_fee: 100.0, allowance_amount: 10.0, is_active: true },
  { tier_id: 2, min_delivery_fee: 101.0, max_delivery_fee: 150.0, allowance_amount: 20.0, is_active: true },
  { tier_id: 3, min_delivery_fee: 151.0, max_delivery_fee: 300.0, allowance_amount: 50.0, is_active: true },
  { tier_id: 4, min_delivery_fee: 301.0, max_delivery_fee: 599.0, allowance_amount: 80.0, is_active: true },
  { tier_id: 5, min_delivery_fee: 600.0, max_delivery_fee: null, allowance_amount: 120.0, is_active: true },
]

// ---------- deduction_types ----------
export const deduction_types = [
  { deduction_type_id: 1, name: 'Operator fee', amount: 10.0, frequency: 'per_delivery', is_rider_savings: false, is_active: true },
  { deduction_type_id: 2, name: 'Box rent', amount: 10.0, frequency: 'per_shift', is_rider_savings: false, is_active: true },
  { deduction_type_id: 3, name: 'Rider savings', amount: 10.0, frequency: 'per_shift', is_rider_savings: true, is_active: true },
]

export const rider_shifts = []
export const delivery_earnings = []
export const applied_deductions = []
export const rider_savings_entries = []
export const petty_cash_transactions = []
export const shift_settlements = []

function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// Charges a deduction to a shift. Rider savings are also deposited to the savings ledger.
function applyDeduction(type, shift, earning_id, applied_at) {
  const row = {
    applied_deduction_id: applied_deductions.length + 1,
    deduction_type_id: type.deduction_type_id,
    shift_id: shift.shift_id,
    earning_id,
    amount: type.amount,
    applied_at,
  }
  applied_deductions.push(row)
  if (type.is_rider_savings) {
    rider_savings_entries.push({
      entry_id: rider_savings_entries.length + 1,
      rider_id: shift.rider_id,
      applied_deduction_id: row.applied_deduction_id,
      entry_type: 'deposit',
      amount: type.amount,
      processed_by: null,
      note: null,
      created_at: applied_at,
    })
  }
}

// Per-shift deductions (box rent, savings) are charged when the shift starts.
function openShift(rider_id, started_at) {
  const shift = {
    shift_id: rider_shifts.length + 1,
    rider_id,
    shift_date: started_at.slice(0, 10),
    started_at,
    ended_at: null,
    status: 'open',
  }
  rider_shifts.push(shift)
  for (const type of deduction_types.filter((t) => t.is_active && t.frequency === 'per_shift')) {
    applyDeduction(type, shift, null, started_at)
  }
  return shift
}

// Records a delivered order's pay snapshot and the per-delivery deductions.
function recordEarning(delivery, shift, created_at) {
  const order = customer_orders.find((o) => o.order_id === delivery.order_id)
  const rate = [...rate_settings].sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0]
  const earning = {
    earning_id: delivery_earnings.length + 1,
    delivery_id: delivery.delivery_id,
    shift_id: shift.shift_id,
    gas_allowance_amount: gasAllowanceFor(order.base_delivery_fee, gas_allowance_tiers),
    rider_share_pct: rate.rider_share_pct,
    created_at,
  }
  delivery_earnings.push(earning)
  for (const type of deduction_types.filter((t) => t.is_active && t.frequency === 'per_delivery')) {
    applyDeduction(type, shift, earning.earning_id, created_at)
  }
}

// Demo: a delivered order with everything a real one has (items, history, payment, delivery,
// rider assignment, earning). items = [{ item_id, quantity }] from the given stores.
function seedDeliveredOrder({ order_id, customer_id, store_ids, items, barangay_id, street, placed, delivered, payment_method, shift }) {
  const barangay = barangays.find((b) => b.barangay_id === barangay_id)
  const order = {
    order_id,
    order_number: `SSD-${placed.slice(0, 10).replaceAll('-', '')}-${order_id}`,
    customer_id,
    order_status: 'delivered',
    base_delivery_fee: barangay.delivery_fee,
    order_notes: null,
    dropoff_street: street,
    dropoff_barangay: barangay.barangay_name,
    dropoff_city: barangay.city_municipality,
    dropoff_landmark: null,
    cancellation_reason: null,
    placed_at: placed,
  }
  customer_orders.push(order)

  store_ids.forEach((restaurant_id, index) => {
    order_restaurants.push({ order_id, restaurant_id, is_primary: index === 0, extra_store_fee: index === 0 ? 0 : 10.0 })
  })
  for (const { item_id, quantity } of items) {
    const item = menu_items.find((m) => m.item_id === item_id)
    order_items.push({ order_item_id: order_items.length + 1, order_id, item_id, quantity, unit_price: item.price, item_name: item.name })
  }

  // Status history, a few minutes apart, ending at "delivered"
  const steps = ['pending', 'confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'on_the_way']
  const start = new Date(placed).getTime()
  const end = new Date(delivered).getTime()
  steps.forEach((status, i) => {
    const time = new Date(start + ((end - start) * i) / steps.length)
    order_status_history.push({
      history_id: order_status_history.length + 1,
      order_id,
      status,
      changed_by: i === 0 ? customer_id : i < 4 ? 3 : shift.rider_id,
      changed_at: localDateTime(time),
      remarks: null,
    })
  })
  order_status_history.push({ history_id: order_status_history.length + 1, order_id, status: 'delivered', changed_by: shift.rider_id, changed_at: delivered, remarks: null })

  const ownItems = order_items.filter((i) => i.order_id === order_id)
  const ownStores = order_restaurants.filter((r) => r.order_id === order_id)
  const amount = orderTotal(orderItemsSubtotal(ownItems), order.base_delivery_fee, orderExtraStoreFees(ownStores))
  payments.push({
    payment_id: payments.length + 1,
    order_id,
    payment_method,
    amount,
    payment_status: 'paid', // COD: the rider collected the cash
    provider_reference_id: payment_method === 'cod' ? null : `PM-DEMO-${order_id}`,
    created_at: placed,
    paid_at: payment_method === 'cod' ? delivered : placed,
  })

  const delivery = {
    delivery_id: deliveries.length + 1,
    order_id,
    delivery_status: 'delivered',
    created_at: placed,
    picked_up_at: placed,
    delivered_at: delivered,
  }
  deliveries.push(delivery)
  delivery_assignments.push({
    assignment_id: delivery_assignments.length + 1,
    delivery_id: delivery.delivery_id,
    rider_id: shift.rider_id,
    assigned_by: 3,
    assigned_at: placed,
    response_status: 'accepted',
    responded_at: placed,
    ended_at: delivered,
    end_reason: 'completed',
  })
  recordEarning(delivery, shift, delivered)
}

// Date → "2026-11-22T08:05:00" (local time, like the other demo timestamps)
function localDateTime(date) {
  return `${localDate(date)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:00`
}

// ---------- Demo: Marcelo (rider 2) has an open shift today ----------
// 3 deliveries done (2 COD, 1 GCash), order 1001 (Maria) is on the way, ₱500.00 petty cash issued.
const demoShift = openShift(2, todayAt('07:32'))
petty_cash_transactions.push({
  txn_id: 1,
  shift_id: demoShift.shift_id,
  order_id: null,
  txn_type: 'cash_issued',
  amount: 500.0,
  gcash_reference_id: null,
  processed_by: 3,
  note: 'Start of shift',
  created_at: todayAt('07:35'),
})
seedDeliveredOrder({ order_id: 1006, customer_id: 6, store_ids: [1], items: [{ item_id: 1, quantity: 1 }], barangay_id: 4, street: 'Purok 2, Tara', placed: todayAt('07:50'), delivered: todayAt('08:20'), payment_method: 'cod', shift: demoShift })
seedDeliveredOrder({ order_id: 1007, customer_id: 6, store_ids: [2, 3], items: [{ item_id: 10, quantity: 1 }, { item_id: 14, quantity: 1 }], barangay_id: 5, street: 'Zone 1, Mangga', placed: todayAt('08:30'), delivered: todayAt('09:10'), payment_method: 'cod', shift: demoShift })
seedDeliveredOrder({ order_id: 1008, customer_id: 6, store_ids: [4], items: [{ item_id: 18, quantity: 2 }], barangay_id: 3, street: 'Impig Elementary School', placed: todayAt('09:15'), delivered: todayAt('09:45'), payment_method: 'gcash', shift: demoShift })

// ---------- Rider data access ----------

// Everything the rider dashboard shows. Returns:
//   profile        rider_profiles row (availability_status)
//   shift          the open shift, or the latest shift, or null
//   hasShiftToday  true if the rider already had a shift today (one shift per day)
//   deliveries     delivered orders of that shift: { earning, order, stores, payment } (pay inputs)
//   deductions     applied_deductions of that shift, with the deduction name
//   pettyCash      petty_cash_transactions of that shift
//   activeDelivery the order the rider is delivering now (getOrderDetails shape) or null
export async function getRiderDashboard(rider_id) {
  const profile = rider_profiles.find((p) => p.user_id === rider_id)
  const shifts = rider_shifts
    .filter((s) => s.rider_id === rider_id)
    .sort((a, b) => new Date(b.started_at) - new Date(a.started_at))
  const shift = shifts.find((s) => s.status === 'open') || shifts[0] || null
  const hasShiftToday = shifts.some((s) => s.shift_date === localDate())

  let shiftDeliveries = []
  let deductions = []
  let pettyCash = []
  if (shift) {
    const earnings = delivery_earnings.filter((e) => e.shift_id === shift.shift_id)
    shiftDeliveries = await Promise.all(
      earnings.map(async (earning) => {
        const delivery = deliveries.find((d) => d.delivery_id === earning.delivery_id)
        const order = customer_orders.find((o) => o.order_id === delivery.order_id)
        const details = await getOrderDetails(order.order_id, order.customer_id)
        return { earning, order: details.order, stores: details.stores, payment: details.payment }
      }),
    )
    deductions = applied_deductions
      .filter((d) => d.shift_id === shift.shift_id)
      .map((d) => ({ ...d, name: deduction_types.find((t) => t.deduction_type_id === d.deduction_type_id).name }))
    pettyCash = petty_cash_transactions.filter((t) => t.shift_id === shift.shift_id)
  }

  // Current delivery = accepted assignment that has not ended
  let activeDelivery = null
  const assignment = delivery_assignments.find((a) => a.rider_id === rider_id && a.ended_at === null && a.response_status === 'accepted')
  if (assignment) {
    const delivery = deliveries.find((d) => d.delivery_id === assignment.delivery_id)
    const order = customer_orders.find((o) => o.order_id === delivery.order_id)
    activeDelivery = await getOrderDetails(order.order_id, order.customer_id)
  }

  return { profile: { ...profile }, shift: shift && { ...shift }, hasShiftToday, deliveries: shiftDeliveries, deductions, pettyCash, activeDelivery }
}

// Starts today's shift. One shift per rider per day. Returns { shift } or { error }.
export async function startShift(rider_id) {
  const shifts = rider_shifts.filter((s) => s.rider_id === rider_id)
  if (shifts.some((s) => s.status === 'open')) return { error: 'already_open' }
  if (shifts.some((s) => s.shift_date === localDate())) return { error: 'already_today' }
  const shift = openShift(rider_id, localDateTime(new Date()))
  rider_profiles.find((p) => p.user_id === rider_id).availability_status = 'available'
  return { shift: { ...shift } }
}

// Ends the open shift (not allowed while a delivery is in progress). Returns { shift } or { error }.
export async function endShift(rider_id) {
  const shift = rider_shifts.find((s) => s.rider_id === rider_id && s.status === 'open')
  if (!shift) return { error: 'no_open_shift' }
  if (delivery_assignments.some((a) => a.rider_id === rider_id && a.ended_at === null && a.response_status === 'accepted')) {
    return { error: 'delivery_in_progress' }
  }
  shift.status = 'closed'
  shift.ended_at = localDateTime(new Date())
  rider_profiles.find((p) => p.user_id === rider_id).availability_status = 'offline'
  return { shift: { ...shift } }
}

// rider_profiles.availability_status: 'available' | 'busy' | 'offline' (only during an open shift)
export async function setRiderAvailability(rider_id, availability_status) {
  if (!rider_shifts.some((s) => s.rider_id === rider_id && s.status === 'open')) return { error: 'no_open_shift' }
  rider_profiles.find((p) => p.user_id === rider_id).availability_status = availability_status
  return { ok: true }
}

// ---------- Demo: a new dispatch waiting for Marcelo's answer ----------
// Order 1009 (Liza, 2 stores, COD) was assigned to rider 2 a few minutes ago: response_status = 'pending'.
function minutesAgo(minutes) {
  return localDateTime(new Date(Date.now() - minutes * 60000))
}
;(function seedNewDispatch() {
  const order_id = 1009
  const barangay = barangays.find((b) => b.barangay_id === 2) // South Centro
  const placed = minutesAgo(14)
  customer_orders.push({
    order_id,
    order_number: `SSD-${placed.slice(0, 10).replaceAll('-', '')}-${order_id}`,
    customer_id: 6,
    order_status: 'preparing',
    base_delivery_fee: barangay.delivery_fee,
    order_notes: 'Please bring change for ₱500.',
    dropoff_street: 'Purok 2, San Juan Ave.',
    dropoff_barangay: barangay.barangay_name,
    dropoff_city: barangay.city_municipality,
    dropoff_landmark: 'Near the covered basketball court',
    cancellation_reason: null,
    placed_at: placed,
  })
  order_restaurants.push({ order_id, restaurant_id: 1, is_primary: true, extra_store_fee: 0 })
  order_restaurants.push({ order_id, restaurant_id: 3, is_primary: false, extra_store_fee: 10.0 })
  for (const [item_id, quantity] of [[2, 1], [5, 1], [16, 1]]) {
    const item = menu_items.find((m) => m.item_id === item_id)
    order_items.push({ order_item_id: order_items.length + 1, order_id, item_id, quantity, unit_price: item.price, item_name: item.name })
  }
  for (const [status, minutes, by] of [['pending', 14, 6], ['confirmed', 12, 3], ['preparing', 10, 3]]) {
    order_status_history.push({ history_id: order_status_history.length + 1, order_id, status, changed_by: by, changed_at: minutesAgo(minutes), remarks: null })
  }
  const amount = orderTotal(
    orderItemsSubtotal(order_items.filter((i) => i.order_id === order_id)),
    barangay.delivery_fee,
    orderExtraStoreFees(order_restaurants.filter((r) => r.order_id === order_id)),
  )
  payments.push({ payment_id: payments.length + 1, order_id, payment_method: 'cod', amount, payment_status: 'pending', provider_reference_id: null, created_at: placed, paid_at: null })
  const delivery = { delivery_id: deliveries.length + 1, order_id, delivery_status: 'assigned', created_at: minutesAgo(3), picked_up_at: null, delivered_at: null }
  deliveries.push(delivery)
  delivery_assignments.push({
    assignment_id: delivery_assignments.length + 1,
    delivery_id: delivery.delivery_id,
    rider_id: 2,
    assigned_by: 3,
    assigned_at: minutesAgo(2),
    response_status: 'pending',
    responded_at: null,
    ended_at: null,
    end_reason: null,
  })
})()

// ---------- Rider deliveries ----------

// Adds what the rider needs to an order: pickup addresses and the customer's name and number.
async function riderOrderView(order_id) {
  const order = customer_orders.find((o) => o.order_id === order_id)
  const details = await getOrderDetails(order_id, order.customer_id)
  const customer = users.find((u) => u.user_id === order.customer_id)
  return {
    ...details,
    stores: details.stores.map((s) => {
      const restaurant = restaurants.find((r) => r.restaurant_id === s.restaurant_id)
      return { ...s, address: restaurant.address, contact_number: restaurant.contact_number }
    }),
    customer: { full_name: customer.full_name, contact_number: customer.contact_number },
  }
}

// The rider's open assignments: { pending: [...], active: [...], shiftIsOpen, availability, tiers, rate }.
//   pending = assigned, waiting for Accept/Reject; active = accepted and not yet delivered.
// Each entry is riderOrderView() + its assignment. tiers and rate are for the pay preview (calc.js).
export async function getRiderDeliveries(rider_id) {
  const open = delivery_assignments.filter((a) => a.rider_id === rider_id && a.ended_at === null)
  const withOrder = await Promise.all(
    open.map(async (assignment) => {
      const delivery = deliveries.find((d) => d.delivery_id === assignment.delivery_id)
      return { assignment: { ...assignment }, ...(await riderOrderView(delivery.order_id)) }
    }),
  )
  return {
    pending: withOrder.filter((x) => x.assignment.response_status === 'pending'),
    active: withOrder.filter((x) => x.assignment.response_status === 'accepted'),
    shiftIsOpen: rider_shifts.some((s) => s.rider_id === rider_id && s.status === 'open'),
    availability: rider_profiles.find((p) => p.user_id === rider_id).availability_status,
    tiers: gas_allowance_tiers,
    rate: [...rate_settings].sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0],
  }
}

function findOpenAssignment(rider_id, assignment_id) {
  return delivery_assignments.find((a) => a.assignment_id === assignment_id && a.rider_id === rider_id && a.ended_at === null)
}

// Accept a new dispatch (needs an open shift). The rider becomes busy.
export async function acceptAssignment(rider_id, assignment_id) {
  const assignment = findOpenAssignment(rider_id, assignment_id)
  if (!assignment || assignment.response_status !== 'pending') return { error: 'not_found' }
  if (!rider_shifts.some((s) => s.rider_id === rider_id && s.status === 'open')) return { error: 'no_open_shift' }
  assignment.response_status = 'accepted'
  assignment.responded_at = localDateTime(new Date())
  rider_profiles.find((p) => p.user_id === rider_id).availability_status = 'busy'
  return { ok: true }
}

// Reject a new dispatch: the assignment ends and the operator assigns another rider.
export async function rejectAssignment(rider_id, assignment_id) {
  const assignment = findOpenAssignment(rider_id, assignment_id)
  if (!assignment || assignment.response_status !== 'pending') return { error: 'not_found' }
  const now = localDateTime(new Date())
  assignment.response_status = 'rejected'
  assignment.responded_at = now
  assignment.ended_at = now
  assignment.end_reason = 'rejected'
  return { ok: true }
}

// The rider's one main action: ready_for_pickup → picked_up → on_the_way → delivered.
// Delivered: COD is marked paid (the rider collected the cash), the earning and the per-delivery
// deduction are recorded in the open shift, and the assignment ends as completed.
// Returns { order } or { error: 'not_assigned' | 'not_ready' | 'no_open_shift' }.
export const NEXT_DELIVERY_STATUS = { ready_for_pickup: 'picked_up', picked_up: 'on_the_way', on_the_way: 'delivered' }

export async function advanceDelivery(rider_id, order_id) {
  const delivery = deliveries.find((d) => d.order_id === order_id)
  const assignment =
    delivery &&
    delivery_assignments.find(
      (a) => a.delivery_id === delivery.delivery_id && a.rider_id === rider_id && a.ended_at === null && a.response_status === 'accepted',
    )
  if (!assignment) return { error: 'not_assigned' }

  const order = customer_orders.find((o) => o.order_id === order_id)
  const next = NEXT_DELIVERY_STATUS[order.order_status]
  if (!next) return { error: 'not_ready' }
  const shift = rider_shifts.find((s) => s.rider_id === rider_id && s.status === 'open')
  if (!shift) return { error: 'no_open_shift' }

  const now = localDateTime(new Date())
  order.order_status = next
  order_status_history.push({ history_id: order_status_history.length + 1, order_id, status: next, changed_by: rider_id, changed_at: now, remarks: null })
  delivery.delivery_status = next
  if (next === 'picked_up') delivery.picked_up_at = now

  if (next === 'delivered') {
    delivery.delivered_at = now
    assignment.ended_at = now
    assignment.end_reason = 'completed'
    const payment = payments.filter((p) => p.order_id === order_id).pop()
    if (payment && payment.payment_method === 'cod' && payment.payment_status === 'pending') {
      payment.payment_status = 'paid'
      payment.paid_at = now
    }
    recordEarning(delivery, shift, now)
    const stillBusy = delivery_assignments.some((a) => a.rider_id === rider_id && a.ended_at === null && a.response_status === 'accepted')
    if (!stillBusy) rider_profiles.find((p) => p.user_id === rider_id).availability_status = 'available'
  }
  return { order: { ...order } }
}

// One delivery of this rider (pending, in progress or completed), or null if it is not theirs.
// Returns riderOrderView() + { assignment, earning (once delivered), shiftPettyCash, orderPurchases,
// shiftIsOpen, tiers, rate }. shiftPettyCash is the open shift's ledger (for "on hand", calc.js).
export async function getRiderDeliveryDetails(rider_id, order_id) {
  const delivery = deliveries.find((d) => d.order_id === order_id)
  if (!delivery) return null
  const assignments = delivery_assignments.filter((a) => a.delivery_id === delivery.delivery_id && a.rider_id === rider_id)
  const assignment =
    assignments.find((a) => a.ended_at === null) || assignments.find((a) => a.end_reason === 'completed') || null
  if (!assignment) return null

  const shift = rider_shifts.find((s) => s.rider_id === rider_id && s.status === 'open')
  return {
    ...(await riderOrderView(order_id)),
    assignment: { ...assignment },
    earning: delivery_earnings.find((e) => e.delivery_id === delivery.delivery_id) || null,
    shiftPettyCash: shift ? petty_cash_transactions.filter((t) => t.shift_id === shift.shift_id) : [],
    orderPurchases: petty_cash_transactions.filter((t) => t.order_id === order_id && t.txn_type === 'purchase'),
    shiftIsOpen: Boolean(shift),
    tiers: gas_allowance_tiers,
    rate: [...rate_settings].sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0],
  }
}

// Store advance ("pabili"): the rider paid the store with petty cash for this order.
// Needs an open shift and the order in progress; the amount cannot be more than the petty cash on hand.
// Returns { ok: true } or { error: 'not_assigned' | 'no_open_shift' | 'invalid_amount' | 'not_enough' }.
export async function recordPettyPurchase(rider_id, order_id, amount) {
  const delivery = deliveries.find((d) => d.order_id === order_id)
  const active =
    delivery &&
    delivery_assignments.some(
      (a) => a.delivery_id === delivery.delivery_id && a.rider_id === rider_id && a.ended_at === null && a.response_status === 'accepted',
    )
  if (!active) return { error: 'not_assigned' }
  const shift = rider_shifts.find((s) => s.rider_id === rider_id && s.status === 'open')
  if (!shift) return { error: 'no_open_shift' }
  if (!(amount > 0)) return { error: 'invalid_amount' }
  if (amount > pettyCashOnHand(petty_cash_transactions.filter((t) => t.shift_id === shift.shift_id))) return { error: 'not_enough' }

  petty_cash_transactions.push({
    txn_id: petty_cash_transactions.length + 1,
    shift_id: shift.shift_id,
    order_id,
    txn_type: 'purchase',
    amount,
    gcash_reference_id: null,
    processed_by: rider_id,
    note: 'Store advance (pabili)',
    created_at: localDateTime(new Date()),
  })
  return { ok: true }
}

// =====================================================================
// RIDER: past shifts (history), settlements and savings
// =====================================================================

// Money of a shift from its records: { gross, deductions, net, cod } (used to settle the demo shifts)
function shiftMoney(shift) {
  let gross = 0
  let cod = 0
  for (const earning of delivery_earnings.filter((e) => e.shift_id === shift.shift_id)) {
    const delivery = deliveries.find((d) => d.delivery_id === earning.delivery_id)
    const order = customer_orders.find((o) => o.order_id === delivery.order_id)
    const extra = orderExtraStoreFees(order_restaurants.filter((r) => r.order_id === order.order_id))
    gross += deliveryGross(order.base_delivery_fee, earning.gas_allowance_amount, earning.rider_share_pct, extra)
    const payment = payments.filter((p) => p.order_id === order.order_id).pop()
    if (payment && payment.payment_method === 'cod' && payment.payment_status === 'paid') cod += payment.amount
  }
  const deductions = sumAmounts(applied_deductions.filter((d) => d.shift_id === shift.shift_id))
  return { gross, deductions, net: gross - deductions, cod }
}

// Demo: closes a past shift, returns the unused petty cash and records a full settlement.
function closeAndSettle(shift, ended_at, settled_at) {
  shift.status = 'closed'
  shift.ended_at = ended_at
  const onHand = pettyCashOnHand(petty_cash_transactions.filter((t) => t.shift_id === shift.shift_id))
  if (onHand > 0) {
    petty_cash_transactions.push({
      txn_id: petty_cash_transactions.length + 1,
      shift_id: shift.shift_id,
      order_id: null,
      txn_type: 'cash_returned',
      amount: onHand,
      gcash_reference_id: null,
      processed_by: 3,
      note: 'Unused petty cash returned',
      created_at: ended_at,
    })
  }
  const { cod, net } = shiftMoney(shift)
  const { toRemit, toPayRider } = settlementAmounts(cod, net)
  shift_settlements.push({
    settlement_id: shift_settlements.length + 1,
    shift_id: shift.shift_id,
    settled_by: 3,
    cash_received: toRemit,
    payout_amount: toPayRider,
    payout_method: toPayRider > 0 ? 'cash' : null,
    payout_reference: null,
    settled_at,
    notes: null,
  })
}

function issuePettyCash(shift, amount, created_at) {
  petty_cash_transactions.push({
    txn_id: petty_cash_transactions.length + 1,
    shift_id: shift.shift_id,
    order_id: null,
    txn_type: 'cash_issued',
    amount,
    gcash_reference_id: null,
    processed_by: 3,
    note: 'Start of shift',
    created_at,
  })
}

// Past shift 1 (Nov 20): order 1002 (Maria) + order 1010 (Liza), then settled
;(function seedPastShifts() {
  const nov20 = openShift(2, '2026-11-20T16:30:00')
  issuePettyCash(nov20, 500.0, '2026-11-20T16:35:00')
  recordEarning(deliveries.find((d) => d.order_id === 1002), nov20, '2026-11-20T18:49:00')
  seedDeliveredOrder({ order_id: 1010, customer_id: 6, store_ids: [2], items: [{ item_id: 9, quantity: 1 }], barangay_id: 4, street: 'Purok 2, Tara', placed: '2026-11-20T19:05:00', delivered: '2026-11-20T19:40:00', payment_method: 'cod', shift: nov20 })
  closeAndSettle(nov20, '2026-11-20T20:30:00', '2026-11-20T20:45:00')

  // Past shift 2 (Nov 15): order 1005 (Maria) + order 1011 (Liza), then settled
  const nov15 = openShift(2, '2026-11-15T14:00:00')
  issuePettyCash(nov15, 500.0, '2026-11-15T14:05:00')
  recordEarning(deliveries.find((d) => d.order_id === 1005), nov15, '2026-11-15T16:04:00')
  seedDeliveredOrder({ order_id: 1011, customer_id: 6, store_ids: [1], items: [{ item_id: 6, quantity: 2 }], barangay_id: 5, street: 'Zone 1, Mangga', placed: '2026-11-15T16:20:00', delivered: '2026-11-15T17:05:00', payment_method: 'cod', shift: nov15 })
  closeAndSettle(nov15, '2026-11-15T17:30:00', '2026-11-15T17:45:00')

  // Savings: an opening balance carried over from Sonic's old records, and one emergency withdrawal
  rider_savings_entries.push(
    { entry_id: rider_savings_entries.length + 1, rider_id: 2, applied_deduction_id: null, entry_type: 'deposit', amount: 400.0, processed_by: 4, note: 'Opening balance from old records', created_at: '2026-10-01T08:00:00' },
    { entry_id: rider_savings_entries.length + 2, rider_id: 2, applied_deduction_id: null, entry_type: 'withdrawal', amount: 100.0, processed_by: 3, note: 'Emergency withdrawal', created_at: '2026-11-10T17:00:00' },
  )
})()

// ---------- Rider data access: history + wallet ----------

// All shifts of a rider, newest first. Each: { shift, runs, deductions, settlement, pettyCash }.
// runs = delivered orders of the shift (newest first) with their pay inputs and customer name.
export async function getRiderHistory(rider_id) {
  const shifts = rider_shifts
    .filter((s) => s.rider_id === rider_id)
    .sort((a, b) => new Date(b.started_at) - new Date(a.started_at))

  return Promise.all(
    shifts.map(async (shift) => {
      const earnings = delivery_earnings.filter((e) => e.shift_id === shift.shift_id)
      const runs = await Promise.all(
        earnings.map(async (earning) => {
          const delivery = deliveries.find((d) => d.delivery_id === earning.delivery_id)
          const order = customer_orders.find((o) => o.order_id === delivery.order_id)
          const details = await getOrderDetails(order.order_id, order.customer_id)
          return {
            earning,
            order: details.order,
            stores: details.stores,
            payment: details.payment,
            delivered_at: delivery.delivered_at,
            customer_name: users.find((u) => u.user_id === order.customer_id).full_name,
          }
        }),
      )
      runs.sort((a, b) => new Date(b.delivered_at) - new Date(a.delivered_at))
      return {
        shift: { ...shift },
        runs,
        deductions: applied_deductions
          .filter((d) => d.shift_id === shift.shift_id)
          .map((d) => ({ ...d, name: deduction_types.find((t) => t.deduction_type_id === d.deduction_type_id).name })),
        settlement: shift_settlements.find((s) => s.shift_id === shift.shift_id) || null,
        pettyCash: petty_cash_transactions.filter((t) => t.shift_id === shift.shift_id),
      }
    }),
  )
}

// Wallet: petty cash of the open (or latest) shift and the savings ledger.
// Returns { shift, pettyCash (with order_number on purchases), savings (newest first, with shift_date), savingsPerShift }.
export async function getRiderWallet(rider_id) {
  const shifts = rider_shifts
    .filter((s) => s.rider_id === rider_id)
    .sort((a, b) => new Date(b.started_at) - new Date(a.started_at))
  const shift = shifts.find((s) => s.status === 'open') || shifts[0] || null

  const pettyCash = shift
    ? petty_cash_transactions
        .filter((t) => t.shift_id === shift.shift_id)
        .map((t) => ({ ...t, order_number: t.order_id ? customer_orders.find((o) => o.order_id === t.order_id).order_number : null }))
    : []

  const savings = rider_savings_entries
    .filter((e) => e.rider_id === rider_id)
    .map((e) => {
      const applied = e.applied_deduction_id && applied_deductions.find((d) => d.applied_deduction_id === e.applied_deduction_id)
      const fromShift = applied && rider_shifts.find((s) => s.shift_id === applied.shift_id)
      return { ...e, shift_date: fromShift ? fromShift.shift_date : null }
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  const savingsType = deduction_types.find((t) => t.is_rider_savings && t.is_active)
  return { shift: shift && { ...shift }, pettyCash, savings, savingsPerShift: savingsType ? savingsType.amount : 0 }
}
