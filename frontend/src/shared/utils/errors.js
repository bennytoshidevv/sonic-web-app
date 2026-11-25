// Message for a save that failed. When the server could not be reached (or crashed), say that;
// otherwise the API refused the request, so show the page's own explanation (`fallback`).
export function errorText(result, fallback = 'Could not save. Please try again.') {
  if (result.error === 'network') return 'Cannot reach the server. Check your connection and try again.'
  if (result.error === 'server_error') return 'Something went wrong on the server. Please try again.'
  return fallback
}
