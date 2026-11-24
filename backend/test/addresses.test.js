// Customer address API tests (module 2). Needs a seeded database: npm run db:reset, then npm test.
// Most tests use a brand-new customer so they don't change the demo accounts' addresses.
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { call, loginAs, pool, setup } from './helpers.js'

let token // a fresh customer for this test run

setup(async () => {
  const { body } = await call('POST', '/auth/register', {
    full_name: 'Address Tester',
    email: `addr${Date.now()}@test.ph`,
    contact_number: '09171234000',
    password: 'password123',
  })
  token = body.token
})

const HOME = { label: 'Home', barangay_id: 1, street_address: '  5 Mabini St. ', landmark: '', is_default: false }
const list = async (t = token) => (await call('GET', '/addresses', null, t)).body

describe('list', () => {
  test('demo customer sees their addresses with barangay details', async () => {
    const maria = await loginAs('customer@sonic.ph')
    const rows = await list(maria)
    assert.deepEqual(rows.map((a) => a.label), ['Home', 'Work'])
    assert.equal(rows[1].barangay_name, 'Impig')
    assert.equal(rows[1].city_municipality, 'Sipocot')
    assert.equal(rows[1].delivery_fee, 80)
    assert.equal(rows[0].is_default, true)
  })
})

describe('add, edit, default, delete', () => {
  test('the first address becomes the default even when not ticked', async () => {
    const res = await call('POST', '/addresses', HOME, token)
    assert.equal(res.status, 201)
    assert.equal(res.body.is_default, true)
    assert.equal(res.body.street_address, '5 Mabini St.') // trimmed
    assert.equal(res.body.landmark, null) // empty → null
    assert.equal(res.body.barangay_name, 'North Centro')
    assert.equal(res.body.delivery_fee, 40)
  })

  test('a new default replaces the old one', async () => {
    const work = await call('POST', '/addresses', { ...HOME, label: 'Work', barangay_id: 5, is_default: true }, token)
    assert.equal(work.body.is_default, true)
    const rows = await list()
    assert.deepEqual(rows.map((a) => a.is_default), [false, true])
  })

  test('set default and edit', async () => {
    const [home, work] = await list()
    assert.deepEqual((await call('PUT', `/addresses/${home.address_id}/default`, null, token)).body, { ok: true })
    assert.deepEqual((await list()).map((a) => a.is_default), [true, false])

    const edit = await call('PUT', `/addresses/${work.address_id}`, { ...HOME, label: 'Other', barangay_id: 4, landmark: 'Blue gate' }, token)
    assert.deepEqual(edit.body, { ok: true })
    const edited = (await list())[1]
    assert.equal(edited.label, 'Other')
    assert.equal(edited.barangay_name, 'Tara')
    assert.equal(edited.landmark, 'Blue gate')
    assert.equal(edited.is_default, false)
  })

  test('deleting the default makes the oldest remaining address the default (soft delete)', async () => {
    const [home, other] = await list()
    assert.deepEqual((await call('DELETE', `/addresses/${home.address_id}`, null, token)).body, { ok: true })
    const rows = await list()
    assert.deepEqual(rows.map((a) => a.address_id), [other.address_id])
    assert.equal(rows[0].is_default, true)

    const { rows: stored } = await pool.query('SELECT is_active FROM customer_addresses WHERE address_id = $1', [home.address_id])
    assert.equal(stored[0].is_active, false) // still in the table
    assert.equal((await call('PUT', `/addresses/${home.address_id}/default`, null, token)).status, 404)
  })
})

describe('validation', () => {
  test('missing street, bad barangay, hidden barangay, too long', async () => {
    assert.equal((await call('POST', '/addresses', { ...HOME, street_address: '  ' }, token)).body.error, 'missing_fields')
    assert.equal((await call('POST', '/addresses', { ...HOME, barangay_id: 'x' }, token)).body.error, 'invalid_id')
    assert.equal((await call('POST', '/addresses', { ...HOME, barangay_id: 999 }, token)).body.error, 'invalid_barangay')
    assert.equal((await call('POST', '/addresses', { ...HOME, label: 'x'.repeat(51) }, token)).body.error, 'too_long')

    await pool.query('UPDATE barangays SET is_active = false WHERE barangay_id = 2')
    try {
      const res = await call('POST', '/addresses', { ...HOME, barangay_id: 2 }, token)
      assert.equal(res.status, 400)
      assert.equal(res.body.error, 'invalid_barangay')
    } finally {
      await pool.query('UPDATE barangays SET is_active = true WHERE barangay_id = 2')
    }
  })
})

describe('access', () => {
  test("someone else's address answers 404 and is not changed", async () => {
    const maria = await loginAs('customer@sonic.ph')
    const mariaHome = (await list(maria))[0]
    for (const [method, path, body] of [
      ['PUT', `/addresses/${mariaHome.address_id}`, HOME],
      ['PUT', `/addresses/${mariaHome.address_id}/default`],
      ['DELETE', `/addresses/${mariaHome.address_id}`],
    ]) {
      const res = await call(method, path, body, token)
      assert.equal(res.status, 404, `${method} ${path}`)
      assert.equal(res.body.error, 'not_found')
    }
    assert.deepEqual(await list(maria), [mariaHome, (await list(maria))[1]])
    assert.equal((await list(maria))[0].street_address, '12 Rizal St.')
  })

  test('customers only', async () => {
    assert.equal((await call('GET', '/addresses')).status, 401)
    const rider = await loginAs('rider@sonic.ph')
    assert.equal((await call('GET', '/addresses', null, rider)).body.error, 'wrong_role')
    const operator = await loginAs('operator@sonic.ph')
    assert.equal((await call('POST', '/addresses', HOME, operator)).status, 403)
  })
})
