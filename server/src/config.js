// All settings come from environment variables (see .env.example).
// Missing required values stop the server at startup instead of failing later.

function required(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing environment variable ${name} (see server/.env.example)`)
  return value
}

export const config = {
  port: Number(process.env.PORT || 4000),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  // The frontend address allowed to call the API (Vite dev server by default).
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(','),
  // Photo uploads: 'local' saves to server/uploads (development),
  // 'gcs' saves to a Google Cloud Storage bucket (production).
  uploadDriver: process.env.UPLOAD_DRIVER || 'local',
  gcsBucket: process.env.GCS_BUCKET || '',
  publicUrl: process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 4000}`,
}
