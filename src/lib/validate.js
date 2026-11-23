// Small form validation helpers shared by the auth forms.

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

// Philippine mobile number typed after the +63 prefix: 10 digits starting with 9 (e.g. 9171234567).
export function isValidPhMobile(digits) {
  return /^9\d{9}$/.test(digits)
}
