import express from 'express'
import cors from 'cors'
import { config } from './config.js'
import { errorHandler, notFoundHandler } from './middleware/errors.js'
import { LOCAL_UPLOAD_DIR } from './modules/uploads/storage.js'
import authRoutes from './modules/auth/auth.routes.js'
import catalogRoutes from './modules/catalog/catalog.routes.js'
import uploadRoutes from './modules/uploads/uploads.routes.js'

// Builds the Express app. Kept separate from index.js so tests can use it without opening a port.
export function createApp() {
  const app = express()

  app.use(cors({ origin: config.corsOrigin }))
  app.use(express.json({ limit: '100kb' }))

  app.get('/api/health', (req, res) => res.json({ ok: true }))

  // One router per module. More modules are added here as they are built:
  // restaurants, menus, cart, orders, deliveries, shifts, payments, reviews, reports, settings...
  app.use('/api/auth', authRoutes)
  app.use('/api/uploads', uploadRoutes)
  // Catalog paths start right under /api (/api/restaurants, /api/barangays, ...)
  app.use('/api', catalogRoutes)

  // Photos saved by the 'local' upload driver.
  if (config.uploadDriver === 'local') app.use('/uploads', express.static(LOCAL_UPLOAD_DIR))

  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}
