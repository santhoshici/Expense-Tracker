const APP_VERSION = import.meta.env?.VITE_APP_VERSION ?? '0.0.0'

export const CACHE_VERSION = `expense-tracker/v${APP_VERSION}`
export const DEFAULT_CACHE_TTL = 60 * 60 * 1000

const NAMESPACE = 'expense-tracker-cache:'

export const isFresh = (meta) => {
  if (!meta || meta.v !== CACHE_VERSION) return false
  if (meta.expiresAt == null) return true
  return meta.expiresAt > Date.now()
}

export const cacheGet = (key) => {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(NAMESPACE + key)
    if (!raw) return null
    const meta = JSON.parse(raw)
    return isFresh(meta) ? meta.data : null
  } catch (error) {
    console.warn('cacheGet failed:', error)
    return null
  }
}

export const cacheSet = (key, value, ttlMs = DEFAULT_CACHE_TTL) => {
  if (typeof localStorage === 'undefined') return
  const meta = {
    v: CACHE_VERSION,
    data: value,
    ts: Date.now(),
    expiresAt: ttlMs ? Date.now() + ttlMs : null,
  }
  try {
    localStorage.setItem(NAMESPACE + key, JSON.stringify(meta))
  } catch (error) {
    console.warn('cacheSet failed:', error)
  }
}

export const cacheDelete = (key) => {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(NAMESPACE + key)
  } catch (error) {
    console.warn('cacheDelete failed:', error)
  }
}

export const cacheWrap = async (key, fetcher, ttlMs) => {
  const cached = cacheGet(key)
  if (cached !== null) return cached
  const value = await fetcher()
  cacheSet(key, value, ttlMs)
  return value
}