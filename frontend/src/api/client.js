// Talks to the Express API (backend/). Every page goes through src/api/index.js, which uses this file.
//
// - The API address comes from VITE_API_URL (see frontend/.env.example).
// - The login token is saved in sessionStorage together with the user, and sent as
//   "Authorization: Bearer <token>" on every request.
// - Error answers ({ error, message } with a 4xx/5xx status) are returned as { error, message },
//   the same way the mock functions returned { error }, so the pages' error handling keeps working.

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'
const SESSION_KEY = 'sonic_session'

// Sent to the whole app (window events):
export const SERVER_DOWN_EVENT = 'sonic:server-down' // a page could not load its data (ServerStatus.jsx)
export const SESSION_ENDED_EVENT = 'sonic:session-ended' // the token is no longer accepted (AuthContext.jsx)

// ---------- Session: { token, user } ----------

export function loadSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || null
  } catch {
    return null
  }
}

export function saveSession(session) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY)
}

// ---------- Requests ----------

// Calls the API. Returns the JSON answer, or { error, message } when the API refuses the request
// (or { error: 'network' } when the API can't be reached at all).
export async function request(method, path, body) {
  const token = loadSession()?.token
  let res
  try {
    res = await fetch(API_URL + path, {
      method,
      headers: {
        ...(body !== undefined && { 'content-type': 'application/json' }),
        ...(token && { authorization: `Bearer ${token}` }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    return { error: 'network', message: 'Cannot reach the server. Check your connection.' }
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) return { error: data?.error || 'server_error', message: data?.message, status: res.status }
  if (data === null) return { error: 'server_error' } // not JSON: something else answered, not our API
  return data
}

// The login itself is over: expired/invalid token, or the account was suspended or deactivated.
export const isSessionError = (result) => ['no_token', 'invalid_token', 'suspended', 'inactive'].includes(result?.error)

// Loads data for a page. Pages expect real data here (lists, objects), so a failed load never reaches them:
// the app is told what happened (it shows the "Can't reach the server" screen or the login page) and the
// promise stays waiting. Only "not found" answers go back, because the pages show their own message for those.
async function load(path) {
  const result = await request('GET', path)
  if (!result?.error || result.error === 'not_found' || result.error === 'invalid_id') return result
  window.dispatchEvent(new Event(isSessionError(result) ? SESSION_ENDED_EVENT : SERVER_DOWN_EVENT))
  return new Promise(() => {})
}

// Saves data. Failures come back as { error }, and the page shows its own message.
async function save(method, path, body) {
  const result = await request(method, path, body)
  // (A refused login also answers 'suspended'/'inactive', but that is not a session that ended.)
  if (isSessionError(result) && path !== '/auth/login') window.dispatchEvent(new Event(SESSION_ENDED_EVENT))
  return result
}

export const api = {
  get: load,
  post: (path, body = {}) => save('POST', path, body),
  put: (path, body = {}) => save('PUT', path, body),
  patch: (path, body = {}) => save('PATCH', path, body),
  delete: (path) => save('DELETE', path),
}
