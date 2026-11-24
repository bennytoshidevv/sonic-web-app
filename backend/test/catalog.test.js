// Catalog API tests (module 1). Needs a seeded database: npm run db:reset, then npm test.
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { call, loginAs, pool, setup } from './helpers.js'

setup()

describe('barangays and cuisines', () => {
  test('only active barangays are listed', async () => {
    const before = await call('GET', '/barangays')
    assert.equal(before.status, 200)
    assert.equal(before.body.length, 5)
    assert.equal(before.body[4].delivery_fee, 250) // NUMERIC comes back as a number

    await pool.query('UPDATE barangays SET is_active = false WHERE barangay_id = 5')
    try {
      const after = await call('GET', '/barangays')
      assert.ok(!after.body.some((b) => b.barangay_id === 5))
    } finally {
      await pool.query('UPDATE barangays SET is_active = true WHERE barangay_id = 5')
    }
  })

  test('cuisine types', async () => {
    const { body } = await call('GET', '/cuisine-types')
    assert.equal(body.length, 6)
    assert.deepEqual(Object.keys(body[0]).sort(), ['cuisine_id', 'cuisine_name'])
  })
})

describe('restaurants', () => {
  test('list hides disabled restaurants and includes cuisines and hours', async () => {
    const { status, body } = await call('GET', '/restaurants')
    assert.equal(status, 200)
    assert.deepEqual(body.map((r) => r.restaurant_id), [1, 2, 3, 4, 5]) // 6 is disabled
    const rosa = body[0]
    assert.deepEqual(rosa.cuisines, ['Filipino', 'Silog'])
    assert.equal(rosa.hours.length, 7)
    assert.equal(rosa.hours[0].open_time, '07:30:00')
    assert.equal(body.find((r) => r.restaurant_id === 4).hours.length, 6) // closed on Sundays
  })

  test('average rating is calculated in SQL from the reviews (null when there are none)', async () => {
    const { body } = await call('GET', '/restaurants')
    const pearl = body.find((r) => r.restaurant_id === 3) // one 5-star review (order 1005)
    assert.equal(pearl.average_rating, 5)
    assert.equal(pearl.review_count, 1)
    assert.equal(pearl.open_status, 'open')
    const rosa = body.find((r) => r.restaurant_id === 1)
    assert.equal(rosa.average_rating, null)
    assert.equal(rosa.review_count, 0)
    assert.equal((await call('GET', '/restaurants/3')).body.average_rating, 5)

    // A second review (4 stars) on a test order changes the average without storing it: (5 + 4) / 2 = 4.5
    const { rows } = await pool.query(
      `INSERT INTO restaurant_reviews (order_id, restaurant_id, rating)
       SELECT order_id, 3, 4 FROM order_restaurants WHERE restaurant_id = 3 AND order_id <> 1005 LIMIT 1 RETURNING review_id`,
    )
    try {
      assert.equal((await call('GET', '/restaurants/3')).body.average_rating, 4.5)
    } finally {
      await pool.query('DELETE FROM restaurant_reviews WHERE review_id = $1', [rows[0].review_id])
    }
  })

  test('menu and reviews of a disabled or unknown restaurant answer 404', async () => {
    for (const path of ['/restaurants/6/menu', '/restaurants/999/menu', '/restaurants/6/reviews', '/restaurants/999/reviews']) {
      const res = await call('GET', path)
      assert.equal(res.status, 404, path)
      assert.equal(res.body.error, 'not_found')
    }
    assert.equal((await call('GET', '/restaurants/abc/menu')).body.error, 'invalid_id')
  })

  test('one restaurant; disabled, missing and bad ids', async () => {
    assert.equal((await call('GET', '/restaurants/2')).body.name, 'Golden Roast Express')
    const disabled = await call('GET', '/restaurants/6')
    assert.equal(disabled.status, 404)
    assert.equal(disabled.body.error, 'not_found')
    assert.equal((await call('GET', '/restaurants/999')).status, 404)
    const bad = await call('GET', '/restaurants/abc')
    assert.equal(bad.status, 400)
    assert.equal(bad.body.error, 'invalid_id')
  })

  test('menu: categories in display order, sold-out items kept, archived items hidden', async () => {
    const { body } = await call('GET', '/restaurants/1/menu')
    assert.deepEqual(body.map((c) => c.category_name), ['Silog Meals', 'Rice Bowls', 'Drinks'])
    const bangsilog = body[0].items.find((i) => i.name === 'Bangsilog')
    assert.equal(bangsilog.is_available, false)
    assert.equal(bangsilog.price, 110)

    await pool.query('UPDATE menu_items SET is_active = false WHERE item_id = 4')
    try {
      const after = await call('GET', '/restaurants/1/menu')
      assert.ok(!after.body[0].items.some((i) => i.item_id === 4))
    } finally {
      await pool.query('UPDATE menu_items SET is_active = true WHERE item_id = 4')
    }
  })

  test('reviews of one restaurant', async () => {
    const { body } = await call('GET', '/restaurants/3/reviews')
    assert.equal(body.length, 1)
    assert.equal(body[0].rating, 5)
    assert.deepEqual(await call('GET', '/restaurants/1/reviews').then((r) => r.body), [])
  })
})

describe('rate settings', () => {
  test('current rate ignores a rate scheduled for the future', async () => {
    assert.equal((await call('GET', '/rate-settings/current')).body.rider_share_pct, 70)
    const { rows } = await pool.query(
      `INSERT INTO rate_settings (extra_store_fee, rider_share_pct, effective_from, created_by)
       VALUES (15, 72, now() + interval '7 days', 4) RETURNING setting_id`,
    )
    try {
      const { body } = await call('GET', '/rate-settings/current')
      assert.equal(body.rider_share_pct, 70)
      assert.equal(body.extra_store_fee, 10)
    } finally {
      await pool.query('DELETE FROM rate_settings WHERE setting_id = $1', [rows[0].setting_id])
    }
  })
})

describe('cart item details', () => {
  test('items come with their restaurant status', async () => {
    const { status, body } = await call('GET', '/menu-items?ids=3,1,22')
    assert.equal(status, 200)
    assert.deepEqual(body.map((i) => i.item_id), [1, 3, 22])
    assert.equal(body[1].is_available, false) // Bangsilog is sold out
    assert.deepEqual(body[2].restaurant, {
      restaurant_id: 5,
      name: 'Crispy Crust Pizzeria',
      description: 'Oven-baked pizza and pasta',
      open_status: 'closed',
      is_active: true,
    })
  })

  test('empty list and bad ids', async () => {
    assert.deepEqual((await call('GET', '/menu-items')).body, [])
    assert.equal((await call('GET', '/menu-items?ids=1,x')).body.error, 'invalid_id')
    const many = Array.from({ length: 101 }, (_, i) => i + 1).join(',')
    assert.equal((await call('GET', `/menu-items?ids=${many}`)).body.error, 'too_many_items')
  })
})

describe('favorites', () => {
  test('a customer likes and unlikes a restaurant', async () => {
    const token = await loginAs('customer@sonic.ph')
    assert.deepEqual((await call('GET', '/restaurants/2/favorite', null, token)).body, { favorite: true }) // seeded

    assert.deepEqual((await call('PUT', '/restaurants/3/favorite', { liked: true }, token)).body, { ok: true })
    assert.equal((await call('PUT', '/restaurants/3/favorite', { liked: true }, token)).status, 200) // twice is fine
    assert.equal((await call('GET', '/restaurants/3/favorite', null, token)).body.favorite, true)
    await call('PUT', '/restaurants/3/favorite', { liked: false }, token)
    assert.equal((await call('GET', '/restaurants/3/favorite', null, token)).body.favorite, false)
  })

  test('each customer only sees their own likes', async () => {
    const liza = await loginAs('liza@sonic.ph')
    assert.equal((await call('GET', '/restaurants/2/favorite', null, liza)).body.favorite, false)
  })

  test('needs a customer login', async () => {
    assert.equal((await call('GET', '/restaurants/2/favorite')).status, 401)
    const rider = await loginAs('rider@sonic.ph')
    const res = await call('PUT', '/restaurants/2/favorite', { liked: true }, rider)
    assert.equal(res.status, 403)
    assert.equal(res.body.error, 'wrong_role')
  })

  test('bad body and disabled restaurant', async () => {
    const token = await loginAs('customer@sonic.ph')
    assert.equal((await call('PUT', '/restaurants/2/favorite', { liked: 'yes' }, token)).body.error, 'invalid_liked')
    const disabled = await call('PUT', '/restaurants/6/favorite', { liked: true }, token)
    assert.equal(disabled.status, 404)
  })
})
