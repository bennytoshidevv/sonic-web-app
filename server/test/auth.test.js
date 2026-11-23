// Auth API tests. Needs a seeded database: npm run db:reset, then npm test.
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../src/app.js'
import { pool } from '../src/db.js'

let server
let base

before(async () => {
  server = createApp().listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  base = `http://localhost:${server.address().port}/api`
})

after(async () => {
  server.close()
  await pool.end()
})

async function call(method, path, body, token) {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token && { authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  })
  return { status: res.status, body: await res.json() }
}

const login = (email, password = 'sonic1234') => call('POST', '/auth/login', { email, password })

describe('login', () => {
  test('demo customer logs in and gets a token, without password_hash', async () => {
    const { status, body } = await login('Customer@Sonic.ph')
    assert.equal(status, 200)
    assert.ok(body.token)
    assert.equal(body.user.role, 'customer')
    assert.equal(body.user.password_hash, undefined)
  })

  test('wrong password and unknown email give the same error', async () => {
    const a = await login('customer@sonic.ph', 'wrong-password')
    const b = await login('nobody@sonic.ph')
    assert.equal(a.status, 401)
    assert.deepEqual(a.body, b.body)
    assert.equal(a.body.error, 'invalid')
  })

  test('suspended and inactive accounts are blocked', async () => {
    assert.equal((await login('suspended@sonic.ph')).body.error, 'suspended')
    assert.equal((await login('ramon@sonic.ph')).body.error, 'inactive')
  })
})

describe('register and apply', () => {
  const stamp = Date.now()

  test('customer sign-up is active right away and can call /me', async () => {
    const email = `new${stamp}@test.ph`
    const reg = await call('POST', '/auth/register', {
      full_name: 'Test Customer', email, contact_number: '09170000000', password: 'password123',
    })
    assert.equal(reg.status, 201)
    assert.equal(reg.body.user.account_status, 'active')
    const me = await call('GET', '/auth/me', null, reg.body.token)
    assert.equal(me.body.user.email, email)
  })

  test('duplicate email is rejected (case-insensitive)', async () => {
    const reg = await call('POST', '/auth/register', {
      full_name: 'Dup', email: 'CUSTOMER@sonic.ph', contact_number: '09170000000', password: 'password123',
    })
    assert.equal(reg.status, 409)
    assert.equal(reg.body.error, 'email_taken')
  })

  test('bad input is rejected', async () => {
    const short = await call('POST', '/auth/register', {
      full_name: 'X', email: `x${stamp}@test.ph`, contact_number: '09170000000', password: 'short',
    })
    assert.equal(short.body.error, 'weak_password')
    const phone = await call('POST', '/auth/register', {
      full_name: 'X', email: `x${stamp}@test.ph`, contact_number: '12345', password: 'password123',
    })
    assert.equal(phone.body.error, 'invalid_contact_number')
  })

  test('rider application creates an inactive account with a rider profile', async () => {
    const email = `rider${stamp}@test.ph`
    const res = await call('POST', '/auth/apply', {
      role: 'rider', full_name: 'New Rider', email, contact_number: '09181112222', password: 'password123',
      vehicle_type: 'Motorcycle', plate_number: 'ABC 123',
    })
    assert.equal(res.status, 201)
    assert.equal((await login(email, 'password123')).body.error, 'inactive')
    const { rows } = await pool.query(
      'SELECT p.vehicle_type FROM rider_profiles p JOIN users u USING (user_id) WHERE u.email = $1', [email])
    assert.equal(rows[0].vehicle_type, 'Motorcycle')
  })

  test('nobody can apply as admin', async () => {
    const res = await call('POST', '/auth/apply', {
      role: 'admin', full_name: 'X', email: `a${stamp}@test.ph`, contact_number: '09170000000', password: 'password123',
    })
    assert.equal(res.body.error, 'invalid_role')
  })
})

describe('tokens and roles', () => {
  test('no token or a fake token is refused', async () => {
    assert.equal((await call('GET', '/auth/me')).status, 401)
    assert.equal((await call('GET', '/auth/me', null, 'not.a.token')).body.error, 'invalid_token')
  })

  test('customers cannot upload photos (operator only)', async () => {
    const { body } = await login('customer@sonic.ph')
    const res = await call('POST', '/uploads/restaurants', {}, body.token)
    assert.equal(res.status, 403)
  })

  test('profile update and password change', async () => {
    const email = `pw${Date.now()}@test.ph`
    const reg = await call('POST', '/auth/register', {
      full_name: 'PW Test', email, contact_number: '09170000000', password: 'password123',
    })
    const token = reg.body.token
    const upd = await call('PATCH', '/auth/me', { full_name: 'PW Renamed', email, contact_number: '09179999999' }, token)
    assert.equal(upd.body.user.full_name, 'PW Renamed')

    const wrong = await call('POST', '/auth/change-password', { current_password: 'nope', new_password: 'newpass123' }, token)
    assert.equal(wrong.body.error, 'wrong_password')
    const ok = await call('POST', '/auth/change-password', { current_password: 'password123', new_password: 'newpass123' }, token)
    assert.equal(ok.status, 200)
    assert.equal((await login(email, 'newpass123')).status, 200)
  })
})
