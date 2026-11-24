// Operator management API tests (module 6): restaurants, menus, users.
// Needs a seeded database: npm run db:reset, then npm test.
// Works on a brand-new restaurant and new accounts, so the demo data stays as it is.
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { call, loginAs, pool, setup } from './helpers.js'

let operator
let operatorId
let admin
let customer
let restaurantId
let categoryIds = []
let itemId

setup(async () => {
  const op = await call('POST', '/auth/login', { email: 'operator@sonic.ph', password: 'sonic1234' })
  operator = op.body.token
  operatorId = op.body.user.user_id
  admin = await loginAs('admin@sonic.ph')
  customer = await loginAs('customer@sonic.ph')
})

const staff = (method, path, body, token = operator) => call(method, `/staff${path}`, body, token)

async function lastAudit(entity, id) {
  const { rows } = await pool.query(
    'SELECT user_id, action, old_value, new_value FROM audit_logs WHERE target_entity = $1 AND target_id = $2 ORDER BY audit_id DESC LIMIT 1',
    [entity, id],
  )
  return rows[0]
}

const NEW_RESTAURANT = {
  name: '  Sipocot Grill  ',
  description: 'Inihaw',
  address: 'Rizal St., North Centro, Sipocot',
  contact_number: '09171110099',
  cuisine_ids: [1, 2],
  hours: [{ day_of_week: 1, open_time: '09:00', close_time: '21:00' }, { day_of_week: 2, open_time: '09:00', close_time: '21:00' }],
}

describe('restaurants', () => {
  test('add a restaurant: starts closed, with cuisines and hours, audited', async () => {
    const res = await staff('POST', '/restaurants', NEW_RESTAURANT)
    assert.equal(res.status, 201)
    const r = res.body.restaurant
    restaurantId = r.restaurant_id
    assert.equal(r.name, 'Sipocot Grill')
    assert.equal(r.open_status, 'closed')
    assert.equal(r.is_active, true)
    assert.deepEqual(r.cuisines, ['Fast food', 'Filipino'])
    assert.deepEqual(r.hours.map((h) => [h.day_of_week, h.open_time]), [[1, '09:00:00'], [2, '09:00:00']])
    const a = await lastAudit('restaurants', restaurantId)
    assert.equal(a.action, 'create_restaurant')
    assert.equal(a.user_id, operatorId)
  })

  test('edit replaces cuisines and hours; old and new values are audited', async () => {
    const res = await staff('PUT', `/restaurants/${restaurantId}`, { ...NEW_RESTAURANT, name: 'Sipocot Grill House', cuisine_ids: [3], hours: [] })
    assert.equal(res.body.restaurant.name, 'Sipocot Grill House')
    assert.deepEqual(res.body.restaurant.cuisines, ['Silog'])
    assert.deepEqual(res.body.restaurant.hours, [])
    const a = await lastAudit('restaurants', restaurantId)
    assert.equal(a.action, 'update_restaurant')
    assert.equal(a.old_value.name, 'Sipocot Grill')
    assert.equal(a.new_value.name, 'Sipocot Grill House')
  })

  test('staff list includes disabled restaurants and cuisine ids', async () => {
    const { body } = await staff('GET', '/restaurants')
    assert.ok(body.some((r) => r.restaurant_id === 6 && r.is_active === false))
    assert.deepEqual(body.find((r) => r.restaurant_id === restaurantId).cuisine_ids, [3])
  })

  test('open, disable (also closes it, hidden from customers), enable', async () => {
    assert.deepEqual((await staff('PUT', `/restaurants/${restaurantId}/open-status`, { open_status: 'open' })).body, { ok: true })
    assert.equal((await call('GET', `/restaurants/${restaurantId}`)).body.open_status, 'open')

    await staff('PUT', `/restaurants/${restaurantId}/active`, { is_active: false })
    assert.equal((await call('GET', `/restaurants/${restaurantId}`)).status, 404)
    const { rows } = await pool.query('SELECT open_status, is_active FROM restaurants WHERE restaurant_id = $1', [restaurantId])
    assert.deepEqual(rows[0], { open_status: 'closed', is_active: false })
    assert.equal((await lastAudit('restaurants', restaurantId)).action, 'disable_restaurant')

    await staff('PUT', `/restaurants/${restaurantId}/active`, { is_active: true })
    await staff('PUT', `/restaurants/${restaurantId}/open-status`, { open_status: 'open' })
    assert.equal((await call('GET', `/restaurants/${restaurantId}`)).status, 200)
  })

  test('bad input', async () => {
    assert.equal((await staff('POST', '/restaurants', { ...NEW_RESTAURANT, name: ' ' })).body.error, 'invalid')
    assert.equal((await staff('POST', '/restaurants', { ...NEW_RESTAURANT, cuisine_ids: [999] })).body.error, 'invalid')
    assert.equal((await staff('POST', '/restaurants', { ...NEW_RESTAURANT, hours: [{ day_of_week: 7, open_time: '09:00', close_time: '10:00' }] })).body.error, 'invalid')
    assert.equal((await staff('PUT', `/restaurants/${restaurantId}/open-status`, { open_status: 'maybe' })).body.error, 'invalid')
    assert.equal((await staff('PUT', '/restaurants/99999/active', { is_active: true })).status, 404)
  })
})

describe('menus', () => {
  test('categories: add to the end, rename, no duplicates, move', async () => {
    for (const name of ['Grilled', 'Drinks']) {
      const res = await staff('POST', `/menus/${restaurantId}/categories`, { category_name: name })
      assert.equal(res.status, 201)
      categoryIds.push(res.body.category.menu_category_id)
    }
    const dup = await staff('POST', `/menus/${restaurantId}/categories`, { category_name: 'drinks' })
    assert.equal(dup.status, 409)
    assert.equal(dup.body.error, 'duplicate')

    assert.equal((await staff('PUT', `/menus/categories/${categoryIds[1]}`, { category_name: 'Cold Drinks' })).body.category.category_name, 'Cold Drinks')
    assert.equal((await lastAudit('menu_categories', categoryIds[1])).action, 'rename_menu_category')

    assert.equal((await staff('POST', `/menus/categories/${categoryIds[0]}/move`, { direction: -1 })).body.error, 'edge')
    assert.deepEqual((await staff('POST', `/menus/categories/${categoryIds[1]}/move`, { direction: -1 })).body, { ok: true })
    const menu = (await staff('GET', `/menus/${restaurantId}`)).body
    assert.deepEqual(menu.map((c) => c.category_name), ['Cold Drinks', 'Grilled'])
  })

  test('items: add, change price (audited, old orders keep theirs), sold out, archive', async () => {
    const add = await staff('POST', '/menus/items', { menu_category_id: categoryIds[0], name: 'Pork BBQ', description: '', price: '35.5', is_available: true })
    assert.equal(add.status, 201)
    itemId = add.body.item.item_id
    assert.equal(add.body.item.price, 35.5)
    assert.equal(add.body.item.description, null)

    const edit = await staff('PUT', `/menus/items/${itemId}`, { menu_category_id: categoryIds[0], name: 'Pork BBQ', price: 40, is_available: true })
    assert.equal(edit.body.item.price, 40)
    const a = await lastAudit('menu_items', itemId)
    assert.equal(a.action, 'update_menu_item')
    assert.deepEqual([a.old_value.price, a.new_value.price], [35.5, 40])

    await staff('PUT', `/menus/items/${itemId}/availability`, { is_available: false })
    assert.equal((await call('GET', `/restaurants/${restaurantId}/menu`)).body.find((c) => c.menu_category_id === categoryIds[0]).items[0].is_available, false)
    assert.equal((await lastAudit('menu_items', itemId)).action, 'set_item_availability')

    assert.deepEqual((await staff('POST', `/menus/items/${itemId}/archive`)).body, { ok: true })
    const menu = (await staff('GET', `/menus/${restaurantId}`)).body
    assert.deepEqual(menu.find((c) => c.menu_category_id === categoryIds[0]).items, [])
    const { rows } = await pool.query('SELECT is_active FROM menu_items WHERE item_id = $1', [itemId])
    assert.equal(rows[0].is_active, false) // still in the table
  })

  test('a price change does not change placed orders', async () => {
    const before = (await call('GET', '/orders/1001', null, customer)).body.stores[0].items[0].unit_price
    await staff('PUT', '/menus/items/1', { menu_category_id: 1, name: 'Tapsilog', description: 'x', price: 120, is_available: true })
    try {
      assert.equal((await call('GET', '/orders/1001', null, customer)).body.stores[0].items[0].unit_price, before)
      assert.equal((await call('GET', '/menu-items?ids=1')).body[0].price, 120)
    } finally {
      await staff('PUT', '/menus/items/1', { menu_category_id: 1, name: 'Tapsilog', description: 'Cured beef tapa with garlic fried rice, sunny-side-up egg and spiced vinegar.', price: 95, is_available: true })
    }
  })

  test('bad item input', async () => {
    const base = { menu_category_id: categoryIds[0], name: 'X', price: 10 }
    assert.equal((await staff('POST', '/menus/items', { ...base, price: 0 })).body.error, 'invalid')
    assert.equal((await staff('POST', '/menus/items', { ...base, price: 'abc' })).body.error, 'invalid')
    assert.equal((await staff('POST', '/menus/items', { ...base, name: '' })).body.error, 'invalid')
    assert.equal((await staff('POST', '/menus/items', { ...base, menu_category_id: 99999 })).body.error, 'invalid')
    assert.equal((await staff('PUT', '/menus/items/99999/availability', { is_available: true })).status, 404)
  })
})

describe('users', () => {
  test('customers with order counts and total spent', async () => {
    const { body } = await staff('GET', '/users/customers')
    const maria = body.find((c) => c.user.user_id === 1)
    assert.equal(maria.user.password_hash, undefined)
    assert.equal(maria.delivered_count, 2) // 1002 + 1005
    assert.equal(maria.total_spent, 255 + 198)
    assert.ok(maria.order_count >= 5)
  })

  test('operators list and user names', async () => {
    assert.deepEqual((await staff('GET', '/users/operators')).body.map((u) => u.email), ['operator@sonic.ph'])
    const names = (await staff('GET', '/users/names?ids=3,4,99999')).body
    assert.deepEqual(names, { 3: 'Ana Villanueva', 4: names[4], 99999: 'System' })
  })

  test('create a rider account (active, offline, audited); email must be new', async () => {
    const email = `newrider${Date.now()}@test.ph`
    const body = { full_name: 'New Rider', email, contact_number: '09181112233', password: 'temp12345', vehicle_type: 'Motorcycle', plate_number: '' }
    const res = await staff('POST', '/users/riders', body)
    assert.equal(res.status, 201)
    assert.equal(res.body.user.account_status, 'active')
    assert.equal((await call('POST', '/auth/login', { email, password: 'temp12345' })).status, 200)
    const { rows } = await pool.query('SELECT availability_status, plate_number FROM rider_profiles WHERE user_id = $1', [res.body.user.user_id])
    assert.deepEqual(rows[0], { availability_status: 'offline', plate_number: null })
    assert.equal((await lastAudit('users', res.body.user.user_id)).action, 'create_rider')
    assert.equal((await staff('POST', '/users/riders', body)).body.error, 'email_taken')
  })

  test('approve and suspend: operators manage riders and customers, only the admin manages operators', async () => {
    // Ramon (7) is an inactive rider application
    assert.deepEqual((await staff('PUT', '/users/7/status', { account_status: 'active' })).body, { ok: true })
    assert.equal((await call('POST', '/auth/login', { email: 'ramon@sonic.ph', password: 'sonic1234' })).status, 200)

    const suspend = await staff('PUT', '/users/7/status', { account_status: 'suspended', reason: 'Late remittance' })
    assert.equal(suspend.status, 200)
    const change = (await staff('GET', '/users/7/latest-change')).body
    assert.equal(change.action, 'set_account_suspended')
    assert.deepEqual(change.new_value, { account_status: 'suspended', reason: 'Late remittance' })
    assert.equal((await call('POST', '/auth/login', { email: 'ramon@sonic.ph', password: 'sonic1234' })).body.error, 'suspended')
    await staff('PUT', '/users/7/status', { account_status: 'inactive' }) // back to the demo state

    const opChange = await staff('PUT', `/users/${operatorId}/status`, { account_status: 'suspended' })
    assert.equal(opChange.status, 403)
    assert.equal(opChange.body.error, 'not_allowed')
    assert.equal((await staff('PUT', '/users/4/status', { account_status: 'suspended' }, admin)).body.error, 'not_allowed') // admin
    assert.equal((await staff('PUT', '/users/99999/status', { account_status: 'active' })).status, 404)
    assert.equal((await staff('PUT', '/users/7/status', { account_status: 'deleted' })).body.error, 'invalid_status')
  })

  test('the admin can approve an operator application', async () => {
    const email = `newop${Date.now()}@test.ph`
    await call('POST', '/auth/apply', { role: 'operator', full_name: 'New Operator', email, contact_number: '09171239999', password: 'password123' })
    const { rows } = await pool.query('SELECT user_id FROM users WHERE email = $1', [email])
    assert.equal((await staff('PUT', `/users/${rows[0].user_id}/status`, { account_status: 'active' })).status, 403) // operator can't
    assert.equal((await staff('PUT', `/users/${rows[0].user_id}/status`, { account_status: 'active' }, admin)).status, 200)
    assert.equal((await call('POST', '/auth/login', { email, password: 'password123' })).status, 200)
  })

  test('a suspended rider goes offline', async () => {
    const email = `offrider${Date.now()}@test.ph`
    const created = await staff('POST', '/users/riders', { full_name: 'Off Rider', email, contact_number: '09181112244', password: 'temp12345', vehicle_type: 'Motorcycle' })
    const id = created.body.user.user_id
    await pool.query("UPDATE rider_profiles SET availability_status = 'available' WHERE user_id = $1", [id])
    await staff('PUT', `/users/${id}/status`, { account_status: 'suspended' })
    const { rows } = await pool.query('SELECT availability_status FROM rider_profiles WHERE user_id = $1', [id])
    assert.equal(rows[0].availability_status, 'offline')
  })
})

describe('access', () => {
  test('operators and the admin only', async () => {
    assert.equal((await call('GET', '/staff/restaurants')).status, 401)
    assert.equal((await staff('GET', '/restaurants', null, customer)).status, 403)
    assert.equal((await staff('GET', '/users/customers', null, await loginAs('rider@sonic.ph'))).status, 403)
    assert.equal((await staff('GET', `/menus/${restaurantId}`, null, admin)).status, 200)
  })
})
