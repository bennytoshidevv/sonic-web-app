// Shared test setup: starts the API on a free port and gives small helpers to call it.
// Usage in a test file:
//   import { setup, call, loginAs } from './helpers.js'
//   setup()                       or   setup(async () => { ...runs once the API is listening... })
import { after, before } from 'node:test'
import { createApp } from '../src/app.js'
import { pool } from '../src/db.js'

let server
let base

export function setup(afterStart) {
  before(async () => {
    server = createApp().listen(0)
    await new Promise((resolve) => server.once('listening', resolve))
    base = `http://localhost:${server.address().port}/api`
    if (afterStart) await afterStart()
  })
  after(async () => {
    server.close()
    await pool.end()
  })
}

// Calls the API and returns { status, body }.
export async function call(method, path, body, token) {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token && { authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  })
  return { status: res.status, body: await res.json() }
}

// Logs in a demo account (password sonic1234) and returns its token.
export async function loginAs(email) {
  const { body } = await call('POST', '/auth/login', { email, password: 'sonic1234' })
  return body.token
}

export { pool }
