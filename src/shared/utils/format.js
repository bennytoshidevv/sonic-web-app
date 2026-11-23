// Display helpers. Use these everywhere so money and time look the same on every screen.

// 1250 → "₱1,250.00"
export function formatMoney(amount) {
  return '₱' + Number(amount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// "07:30:00" (MySQL TIME) → "7:30 AM"
export function formatTime(time) {
  const [hours, minutes] = time.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const hour12 = hours % 12 === 0 ? 12 : hours % 12
  return `${hour12}:${String(minutes).padStart(2, '0')} ${period}`
}

// One restaurant_hours row → "7:30 AM – 8:00 PM"
export function formatHoursRange(row) {
  return `${formatTime(row.open_time)} – ${formatTime(row.close_time)}`
}

// restaurant_hours rows → "Today: 7:30 AM – 8:00 PM" (or "Closed today" if there is no row for today)
export function formatTodayHours(hours, date = new Date()) {
  const today = hours.find((row) => row.day_of_week === date.getDay())
  if (!today) return 'Closed today'
  return `Today: ${formatHoursRange(today)}`
}

// Timestamp (ISO) → "10:05 AM"
export function formatTimestampTime(timestamp) {
  const date = new Date(timestamp)
  const hours = date.getHours()
  const period = hours >= 12 ? 'PM' : 'AM'
  const hour12 = hours % 12 === 0 ? 12 : hours % 12
  return `${hour12}:${String(date.getMinutes()).padStart(2, '0')} ${period}`
}

// Timestamp (ISO) → "Nov 22, 2026"
export function formatDate(timestamp) {
  return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// "09171234567" → "+63 917 123 4567"
export function formatPhoneNumber(number) {
  return number.replace(/^0(\d{3})(\d{3})(\d{4})$/, '+63 $1 $2 $3')
}

// 463 → "7h 43m", 25 → "25m"
export function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return hours > 0 ? `${hours}h ${rest}m` : `${rest}m`
}

// Date → "2026-11-23" (local date, same format as rider_shifts.shift_date)
export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
