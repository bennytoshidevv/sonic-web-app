import { Router } from 'express'
import multer from 'multer'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { badRequest } from '../../middleware/errors.js'
import { ALLOWED_TYPES, savePhoto } from './storage.js'

// POST /api/uploads/:folder   (multipart form, field name "photo")  -> { url }
// folder = restaurants | menu-items. Operators and admins only.
// The page uploads the photo first, then saves the returned url with the restaurant or menu item.

const MAX_SIZE = 2 * 1024 * 1024 // 2 MB
const FOLDERS = new Set(['restaurants', 'menu-items'])

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE, files: 1 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) cb(null, true)
    else cb(badRequest('invalid_file_type', 'Use a JPG, PNG or WEBP image'))
  },
})

const router = Router()

router.post('/:folder', requireAuth, requireRole('operator'), (req, res, next) => {
  if (!FOLDERS.has(req.params.folder)) throw badRequest('invalid_folder', 'Unknown upload folder')
  upload.single('photo')(req, res, async (err) => {
    try {
      if (err?.code === 'LIMIT_FILE_SIZE') throw badRequest('file_too_large', 'Photo must be 2 MB or smaller')
      if (err) throw err
      if (!req.file) throw badRequest('missing_file', 'Choose a photo to upload')
      const url = await savePhoto(req.file, req.params.folder)
      res.status(201).json({ url })
    } catch (e) {
      next(e)
    }
  })
})

export default router
