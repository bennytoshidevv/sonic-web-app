// Errors the API sends on purpose. `code` is a short word the frontend checks
// (the same codes the mock functions return, e.g. 'invalid', 'email_taken').
export class HttpError extends Error {
  constructor(status, code, message) {
    super(message || code)
    this.status = status
    this.code = code
  }
}

export const badRequest = (code = 'bad_request', message) => new HttpError(400, code, message)
export const unauthorized = (code = 'unauthorized', message) => new HttpError(401, code, message)
export const forbidden = (code = 'forbidden', message) => new HttpError(403, code, message)
export const notFound = (code = 'not_found', message) => new HttpError(404, code, message)
export const conflict = (code = 'conflict', message) => new HttpError(409, code, message)

export function notFoundHandler(req, res) {
  res.status(404).json({ error: 'not_found', message: `No route for ${req.method} ${req.path}` })
}

// Last middleware: turns any error into JSON { error, message }.
// Unexpected errors are logged and hidden from the client.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.code, message: err.message })
  }
  // Postgres unique violation that slipped past a manual check (e.g. two requests at once).
  if (err.code === '23505') {
    return res.status(409).json({ error: 'conflict', message: err.detail })
  }
  // Body was not valid JSON.
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'bad_request', message: 'Invalid JSON body' })
  }
  console.error(err)
  res.status(500).json({ error: 'server_error', message: 'Something went wrong' })
}
