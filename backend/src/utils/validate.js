import { badRequest } from '../middleware/errors.js'

// Small helpers to check request bodies. Each throws a 400 error with a clear message.

export function requireFields(body, fields) {
  const missing = fields.filter((f) => body?.[f] === undefined || body[f] === null || String(body[f]).trim() === '')
  if (missing.length) throw badRequest('missing_fields', `Missing: ${missing.join(', ')}`)
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Philippine mobile number: 09XXXXXXXXX (11 digits)
const PH_MOBILE = /^09\d{9}$/

export function cleanEmail(email) {
  const value = String(email).trim().toLowerCase()
  if (!EMAIL.test(value)) throw badRequest('invalid_email', 'Enter a valid email address')
  return value
}

export function checkContactNumber(number) {
  const value = String(number).replace(/[\s-]/g, '')
  if (!PH_MOBILE.test(value)) throw badRequest('invalid_contact_number', 'Use an 11-digit mobile number like 09171234567')
  return value
}

export function checkPassword(password) {
  if (typeof password !== 'string' || password.length < 8) {
    throw badRequest('weak_password', 'Password must be at least 8 characters')
  }
  return password
}

export function toId(value, name = 'id') {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) throw badRequest('invalid_id', `Invalid ${name}`)
  return id
}

// Optional text: trimmed, '' becomes null, and it must fit the column (e.g. varchar(255)).
export function optionalText(value, name, maxLength) {
  if (value === undefined || value === null) return null
  const text = String(value).trim()
  if (text.length > maxLength) throw badRequest('too_long', `${name} must be at most ${maxLength} characters`)
  return text === '' ? null : text
}

// Required text with the same length check.
export function requiredText(value, name, maxLength) {
  const text = optionalText(value, name, maxLength)
  if (text === null) throw badRequest('missing_fields', `Missing: ${name}`)
  return text
}
