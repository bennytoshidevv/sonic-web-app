// Loads the demo data into the database.
//
// The dummy data lives in ONE place: the frontend's frontend/src/mock/mock.js (shaped like the ERD tables).
// This script imports that file, keeps only the columns the real tables have, replaces the
// demo SHA-256 password hashes with bcrypt hashes, and inserts everything in one transaction.
// Demo orders and shifts in mock.js are dated "today", so re-run `npm run db:reset` before a demo.
//
// Usage: npm run db:seed   (after npm run db:schema)

import { mkdtemp, readFile, writeFile, cp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import bcrypt from 'bcryptjs'
import pg from 'pg'

process.env.TZ = 'Asia/Manila' // mock.js builds "today" timestamps with the local clock

const DEMO_PASSWORD = 'sonic1234'
const frontendSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../frontend/src')

// Insert order: parents before children (foreign keys).
const TABLES = [
  'users', 'rider_profiles', 'barangays', 'customer_addresses',
  'cuisine_types', 'restaurants', 'restaurant_cuisines', 'restaurant_hours',
  'menu_categories', 'menu_items', 'favorite_restaurants', 'cart_items',
  'rate_settings', 'gas_allowance_tiers', 'deduction_types',
  'customer_orders', 'order_restaurants', 'order_items', 'order_status_history',
  'payments', 'payment_webhook_events', 'refunds',
  'deliveries', 'delivery_assignments',
  'rider_shifts', 'delivery_earnings', 'applied_deductions', 'shift_settlements',
  'rider_savings_entries', 'petty_cash_transactions',
  'restaurant_reviews', 'rider_reviews', 'notifications', 'audit_logs',
]
const JSON_COLUMNS = new Set(['raw_payload', 'old_value', 'new_value'])

// mock.js imports '@shared/...' (a Vite alias Node doesn't know), so copy the files
// to a temp folder and point the imports at the real paths.
async function loadMock() {
  const dir = await mkdtemp(path.join(tmpdir(), 'sonic-seed-'))
  await cp(path.join(frontendSrc, 'shared/utils'), path.join(dir, 'utils'), { recursive: true })
  const code = (await readFile(path.join(frontendSrc, 'mock/mock.js'), 'utf8')).replaceAll("'@shared/utils/", "'./utils/")
  await writeFile(path.join(dir, 'mock.js'), code)
  return import(pathToFileURL(path.join(dir, 'mock.js')).href)
}

const mock = await loadMock()
const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
await client.query("SET TIME ZONE 'Asia/Manila'")

const demoHash = await bcrypt.hash(DEMO_PASSWORD, 10)

try {
  await client.query('BEGIN')
  for (const table of TABLES) {
    let rows = mock[table]
    if (!Array.isArray(rows) || rows.length === 0) continue

    // Some mock reviews point to orders that were never mocked (order_id 1–6). A real review
    // needs a real delivered order, so those rows are skipped.
    if (table === 'restaurant_reviews' || table === 'rider_reviews') {
      const exists = (r) =>
        table === 'rider_reviews'
          ? mock.customer_orders.some((o) => o.order_id === r.order_id)
          : mock.order_restaurants.some((o) => o.order_id === r.order_id && o.restaurant_id === r.restaurant_id)
      const skipped = rows.filter((r) => !exists(r))
      if (skipped.length) console.warn(`  ${table}: skipping ${skipped.length} review(s) whose order is not in the mock data`)
      rows = rows.filter(exists)
      if (rows.length === 0) continue
    }

    const { rows: cols } = await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
      [table],
    )
    const columns = cols.map((c) => c.column_name)
    const extra = [...new Set(rows.flatMap(Object.keys))].filter((k) => !columns.includes(k))
    if (extra.length) console.warn(`  ${table}: ignoring mock fields not in the ERD: ${extra.join(', ')}`)

    const used = columns.filter((c) => rows.some((r) => r[c] !== undefined))
    for (const row of rows) {
      const values = used.map((c) => {
        if (table === 'users' && c === 'password_hash') return demoHash
        const v = row[c] ?? null
        return JSON_COLUMNS.has(c) && v !== null ? JSON.stringify(v) : v
      })
      const placeholders = used.map((_, i) => `$${i + 1}`).join(', ')
      await client.query(`INSERT INTO ${table} (${used.join(', ')}) VALUES (${placeholders})`, values)
    }
    console.log(`  ${table}: ${rows.length}`)
  }

  // Ids were inserted by hand, so move each SERIAL counter past the highest id.
  const { rows: seqs } = await client.query(`
    SELECT table_name, column_name, pg_get_serial_sequence(table_name, column_name) AS seq
      FROM information_schema.columns
     WHERE table_schema = 'public' AND column_default LIKE 'nextval%'`)
  for (const s of seqs) {
    await client.query(
      `SELECT setval($1, COALESCE((SELECT max(${s.column_name}) FROM ${s.table_name}), 0) + 1, false)`,
      [s.seq],
    )
  }

  await client.query('COMMIT')
  console.log(`Seeded. Every demo account uses the password "${DEMO_PASSWORD}".`)
} catch (err) {
  await client.query('ROLLBACK')
  console.error('Seed failed, nothing was saved:', err.message, err.detail ?? '')
  process.exitCode = 1
} finally {
  await client.end()
}
