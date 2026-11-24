import pg from 'pg'
import { config } from './config.js'

// numeric (money) columns come back from pg as strings to avoid rounding errors.
// Our amounts are at most 2 decimals and well below 2^53, so reading them as
// JavaScript numbers is safe and keeps the JSON the same shape as the mock data.
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (value) => (value === null ? null : Number(value)))
// Keep DATE columns as plain 'YYYY-MM-DD' strings (no timezone shifting).
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value)

export const pool = new pg.Pool({ connectionString: config.databaseUrl })

// Every connection works in Philippine time, so "today" and shift dates are local.
pool.on('connect', (client) => client.query("SET TIME ZONE 'Asia/Manila'"))

// Runs one parameterized query. Always pass values as params ($1, $2, ...),
// never by building the SQL string, so user input can't change the query (SQL injection).
export function query(text, params) {
  return pool.query(text, params)
}

// Runs several queries as one transaction: either all of them are saved or none.
// Usage: await withTransaction(async (client) => { await client.query(...); ... })
export async function withTransaction(work) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await work(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
