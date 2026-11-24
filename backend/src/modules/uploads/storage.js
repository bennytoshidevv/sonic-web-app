import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from '../../config.js'

// Saves an uploaded photo and returns its public URL.
// That URL is what goes into restaurants.logo_url or menu_items.photo_url.
//
// Two drivers, chosen by UPLOAD_DRIVER:
//   local – writes to backend/uploads/ and Express serves it at /uploads/... (for development)
//   gcs   – writes to a Google Cloud Storage bucket (for the deployed app on Cloud Run,
//           whose own disk is wiped on every restart)

export const LOCAL_UPLOAD_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../uploads')

const EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
export const ALLOWED_TYPES = Object.keys(EXTENSIONS)

let bucket = null
async function getBucket() {
  if (!bucket) {
    if (!config.gcsBucket) throw new Error('UPLOAD_DRIVER=gcs needs GCS_BUCKET')
    const { Storage } = await import('@google-cloud/storage')
    bucket = new Storage().bucket(config.gcsBucket)
  }
  return bucket
}

// folder: 'restaurants' or 'menu-items'
export async function savePhoto(file, folder) {
  const name = `${folder}/${randomUUID()}.${EXTENSIONS[file.mimetype]}`

  if (config.uploadDriver === 'gcs') {
    const b = await getBucket()
    await b.file(name).save(file.buffer, { contentType: file.mimetype, resumable: false })
    return `https://storage.googleapis.com/${config.gcsBucket}/${name}`
  }

  const target = path.join(LOCAL_UPLOAD_DIR, name)
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, file.buffer)
  return `${config.publicUrl}/uploads/${name}`
}
