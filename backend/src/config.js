// All settings come from environment variables (see .env.example).
// Missing required values stop the server at startup instead of failing later.

function required(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing environment variable ${name} (see backend/.env.example)`)
  return value
}

export const config = {
  port: Number(process.env.PORT || 4000),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  // The frontend address allowed to call the API (Vite dev server by default).
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(','),
  // The customer's browser returns here after paying (the first CORS address unless set).
  frontendUrl: process.env.FRONTEND_URL || (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',')[0],
  // PayMongo (optional): without these, online payment is off and COD works as usual.
  paymongoSecretKey: process.env.PAYMONGO_SECRET_KEY || '',
  paymongoWebhookSecret: process.env.PAYMONGO_WEBHOOK_SECRET || '',
  paymongoApiUrl: 'https://api.paymongo.com', // the tests point this at a fake server
  // Photo uploads: 'local' saves to backend/uploads (development),
  // 'gcs' saves to a Google Cloud Storage bucket (production).
  uploadDriver: process.env.UPLOAD_DRIVER || 'local',
  gcsBucket: process.env.GCS_BUCKET || '',
  publicUrl: process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 4000}`,
}
