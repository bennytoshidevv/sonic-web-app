// Runs a .sql file against DATABASE_URL.  Usage: node scripts/run-sql.js db/schema.sql
import { readFile } from 'node:fs/promises'
import pg from 'pg'

const file = process.argv[2]
if (!file) throw new Error('Usage: node scripts/run-sql.js <file.sql>')
if (!process.env.DATABASE_URL) throw new Error('Missing DATABASE_URL (see backend/.env.example)')

const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
client.on('notice', () => {}) // hide "drop cascades to ..." notices
try {
  await client.query(await readFile(file, 'utf8'))
  console.log(`Ran ${file}`)
} finally {
  await client.end()
}
