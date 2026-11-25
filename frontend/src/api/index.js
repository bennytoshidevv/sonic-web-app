// The real data functions. Same names and return shapes as src/mock/mock.js, so a page switches
// from the mock to the API by changing only its import line:
//   import { getRestaurants } from '@api'   (instead of '@mock/mock')
//
// The one difference: the logged-in user's id is NOT passed any more. The API reads it from the
// login token, so a page can't ask for (or change) someone else's data.
//
// Every role uses this file. mock.js is now only the demo data for the backend seed script.
import { api, request } from './client'

// The mock returned null for "not found"; the API answers 404 (or 400 'invalid_id' for an address like
// /orders/abc). This keeps the pages' null checks working.
const isMissing = (result) => result?.error === 'not_found' || result?.error === 'invalid_id'
const orNull = (result) => (isMissing(result) ? null : result)
// The mock returned an empty list for an unknown restaurant; the API answers with the same errors.
const orEmpty = (result) => (isMissing(result) ? [] : result)

// ---------- Auth and profile ----------

// Returns { user, token } or { error: 'invalid' | 'suspended' | 'inactive' }.
export function login(email, password) {
  return api.post('/auth/login', { email, password })
}

// Customer sign-up (active right away). Returns { user, token } or { error: 'email_taken', ... }.
export function registerCustomer({ full_name, email, contact_number, password }) {
  return api.post('/auth/register', { full_name, email, contact_number, password })
}

// Rider/operator application (inactive until staff approve). Returns { ok } or { error }.
export function applyAsStaff(details) {
  return api.post('/auth/apply', details)
}

// The logged-in user, checked again by the server. Returns { user } or { error } (expired token, suspended).
export function getMe() {
  return request('GET', '/auth/me') // not api.get: AuthContext handles the errors of this check itself
}

// Returns { user } or { error: 'email_taken' }.
export function updateUserProfile({ full_name, email, contact_number }) {
  return api.patch('/auth/me', { full_name, email, contact_number })
}

// Returns { ok } or { error: 'wrong_password' }.
export function changePassword(current_password, new_password) {
  return api.post('/auth/change-password', { current_password, new_password })
}

// ---------- Catalog ----------

export const getBarangays = () => api.get('/barangays')
export const getCuisineTypes = () => api.get('/cuisine-types')
export const getRestaurants = () => api.get('/restaurants')
export const getRestaurant = async (restaurant_id) => orNull(await api.get(`/restaurants/${restaurant_id}`))
export const getMenu = async (restaurant_id) => orEmpty(await api.get(`/restaurants/${restaurant_id}/menu`))
export const getRestaurantReviews = async (restaurant_id) => orEmpty(await api.get(`/restaurants/${restaurant_id}/reviews`))
export const getRateSettings = () => api.get('/rate-settings/current')

export async function isFavoriteRestaurant(restaurant_id) {
  const result = await api.get(`/restaurants/${restaurant_id}/favorite`)
  return result.favorite === true
}

export function setFavoriteRestaurant(restaurant_id, liked) {
  return api.put(`/restaurants/${restaurant_id}/favorite`, { liked })
}

// Current data of the items in a cart (also sold-out/disabled ones, flagged), with their restaurant.
export function getCartItemDetails(item_ids) {
  if (item_ids.length === 0) return Promise.resolve([])
  return api.get(`/menu-items?ids=${item_ids.join(',')}`)
}

// ---------- Customer addresses ----------

export const getCustomerAddresses = () => api.get('/addresses')

// Returns the new address (with barangay name, city and delivery fee), like the mock.
export function addCustomerAddress({ barangay_id, label, street_address, landmark, is_default = false }) {
  return api.post('/addresses', { barangay_id, label, street_address, landmark, is_default })
}

export function updateCustomerAddress(address_id, { label, barangay_id, street_address, landmark, is_default }) {
  return api.put(`/addresses/${address_id}`, { label, barangay_id, street_address, landmark, is_default })
}

export const setDefaultAddress = (address_id) => api.put(`/addresses/${address_id}/default`)
export const deleteCustomerAddress = (address_id) => api.delete(`/addresses/${address_id}`)

// ---------- Customer orders and reviews ----------

// The checkout page passes the same object as for the mock. Only ids and quantities are sent: the API reads
// prices and fees from the database. The cart's first store is the primary store, so the lines are sent
// grouped in store order (the API takes the store of the first line as the primary store).
// Returns { order } or { error: 'unavailable', ... }.
export function placeOrder({ address, lines, stores, payment_method, order_notes }) {
  const storeOrder = stores.map((s) => s.restaurant_id)
  const sorted = [...lines].sort((a, b) => storeOrder.indexOf(a.restaurant_id) - storeOrder.indexOf(b.restaurant_id))
  return api.post('/orders', {
    address_id: address.address_id,
    lines: sorted.map((line) => ({ item_id: line.item_id, quantity: line.quantity })),
    payment_method,
    order_notes,
  })
}

// Opens the PayMongo page of an unpaid online order. Returns { checkout_url } or { error: 'already_paid' | ... }.
export const startOnlinePayment = (order_id) => api.post(`/payments/orders/${order_id}/checkout`)

export const getCustomerOrders = () => api.get('/orders')
// { order, stores, history, payment, rider }, or null when it isn't this customer's order.
export const getOrderDetails = async (order_id) => orNull(await api.get(`/orders/${order_id}`))

// Returns { order } or { error: 'not_cancellable' }.
export async function cancelOrder(order_id, reason) {
  const result = await api.post(`/orders/${order_id}/cancel`, { reason })
  return result.error === 'not_found' ? { error: 'not_cancellable' } : result
}

export const getOrderReviews = (order_id) => api.get(`/orders/${order_id}/reviews`)
export const getRiderReviews = (rider_id) => api.get(`/riders/${rider_id}/reviews`)

// Returns { ok } or { error: 'not_delivered' | 'already_rated' | 'invalid' }.
export function submitOrderReviews({ order_id, restaurantRatings, riderRating }) {
  return api.post(`/orders/${order_id}/reviews`, { restaurantRatings, riderRating })
}


// ---------- Rider (always the logged-in rider) ----------

export const getRiderDashboard = () => api.get('/rider/dashboard')

// Returns { shift } or { error: 'already_open' | 'already_today' }.
export const startShift = () => api.post('/rider/shift/start')
// Returns { shift } or { error: 'no_open_shift' | 'delivery_in_progress' }.
export const endShift = () => api.post('/rider/shift/end')
export const setRiderAvailability = (availability_status) => api.put('/rider/availability', { availability_status })

export const getRiderDeliveries = () => api.get('/rider/deliveries')
export const acceptAssignment = (assignment_id) => api.post(`/rider/assignments/${assignment_id}/accept`)
export const rejectAssignment = (assignment_id) => api.post(`/rider/assignments/${assignment_id}/reject`)

// Next step of a delivery. Returns { order } or { error: 'not_assigned' | 'not_ready' | 'no_open_shift' }.
export const advanceDelivery = (order_id) => api.post(`/rider/deliveries/${order_id}/advance`)
// One delivery, or null when it isn't this rider's.
export const getRiderDeliveryDetails = async (order_id) => orNull(await api.get(`/rider/deliveries/${order_id}`))
// Returns { ok } or { error: 'not_assigned' | 'no_open_shift' | 'invalid_amount' | 'not_enough' }.
export const recordPettyPurchase = (order_id, amount) => api.post(`/rider/deliveries/${order_id}/purchases`, { amount })

export const getRiderHistory = () => api.get('/rider/history')
export const getRiderWallet = () => api.get('/rider/wallet')

// ---------- Operator (the admin uses the same functions) ----------

// Operator steps before the rider takes over (same as the mock and the API).
export const STAFF_NEXT_STATUS = { pending: 'confirmed', confirmed: 'preparing', preparing: 'ready_for_pickup' }

export const getLiveOrders = () => api.get('/staff/orders')
export const getOrderForStaff = async (order_id) => orNull(await api.get(`/staff/orders/${order_id}`))
export const advanceOrderByStaff = (order_id) => api.post(`/staff/orders/${order_id}/advance`)
// Returns { order } or { error: 'not_allowed' | 'reason_required' }.
export const rejectOrderByStaff = (order_id, reason) => api.post(`/staff/orders/${order_id}/reject`, { reason })
// Returns { ok } or { error: 'not_assignable' | 'rider_unavailable' }.
export const assignRider = (order_id, rider_id) => api.post(`/staff/orders/${order_id}/assign`, { rider_id })
export const getRidersOverview = () => api.get('/staff/riders')

// For the "save" functions: an id in the data means edit (PUT), no id means add (POST).
const save = (path, id, body) => (id ? api.put(`${path}/${id}`, body) : api.post(path, body))

export const getRestaurantsForStaff = () => api.get('/staff/restaurants')
export const saveRestaurant = ({ restaurant_id, ...data }) => save('/staff/restaurants', restaurant_id, data)
export const setRestaurantOpenStatus = (restaurant_id, open_status) =>
  api.put(`/staff/restaurants/${restaurant_id}/open-status`, { open_status })
export const setRestaurantActive = (restaurant_id, is_active) => api.put(`/staff/restaurants/${restaurant_id}/active`, { is_active })

export const getMenuForStaff = (restaurant_id) => api.get(`/staff/menus/${restaurant_id}`)
export function saveMenuCategory(restaurant_id, { menu_category_id, category_name }) {
  return menu_category_id
    ? api.put(`/staff/menus/categories/${menu_category_id}`, { category_name })
    : api.post(`/staff/menus/${restaurant_id}/categories`, { category_name })
}
export const moveMenuCategory = (menu_category_id, direction) => api.post(`/staff/menus/categories/${menu_category_id}/move`, { direction })
export const saveMenuItem = ({ item_id, ...data }) => save('/staff/menus/items', item_id, data)
export const setMenuItemAvailable = (item_id, is_available) => api.put(`/staff/menus/items/${item_id}/availability`, { is_available })
export const archiveMenuItem = (item_id) => api.post(`/staff/menus/items/${item_id}/archive`)

export const getCustomersForStaff = () => api.get('/staff/users/customers')
export const getOperatorsForStaff = () => api.get('/staff/users/operators')
export const createRiderAccount = (details) => api.post('/staff/users/riders', details)
export const setAccountStatus = (user_id, account_status, reason) => api.put(`/staff/users/${user_id}/status`, { account_status, reason })
export const getLatestAccountChange = (user_id) => api.get(`/staff/users/${user_id}/latest-change`)
export const getUserNames = (user_ids) => api.get(`/staff/users/names?ids=${user_ids.filter(Boolean).join(',')}`)

// ---------- Settlements ----------

export const getShiftsOnDate = (date) => api.get(`/staff/shifts?date=${date}`)

// The payout amount is not sent: the API computes it from the shift's own records.
export function recordSettlement({ shift_id, cash_received, payout_method, payout_reference, notes, return_petty_cash }) {
  return api.post(`/staff/shifts/${shift_id}/settlement`, { cash_received, payout_method, payout_reference, notes, return_petty_cash })
}
export const addPettyCashTransaction = ({ shift_id, ...txn }) => api.post(`/staff/shifts/${shift_id}/petty-cash`, txn)

// ---------- Admin ----------

export const getReportData = () => api.get('/admin/reports')
export const getSettingsData = () => api.get('/admin/settings')
export const saveBarangay = ({ barangay_id, ...data }) => save('/admin/barangays', barangay_id, data)
export const saveGasTiers = (tiers) => api.put('/admin/gas-tiers', { tiers })
export const saveDeductionType = ({ deduction_type_id, ...data }) => save('/admin/deduction-types', deduction_type_id, data)
export const addRateSetting = (data) => api.post('/admin/rate-settings', data)
export const getSavingsOverview = () => api.get('/admin/savings')
export const recordSavingsWithdrawal = (rider_id, amount, note) => api.post(`/admin/savings/${rider_id}/withdrawals`, { amount, note })
