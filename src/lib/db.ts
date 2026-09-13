// IndexedDB storage layer for Photo Archive, Custom Assets (Props, Stickers, Frames), and Event Settings
import {
  saveArchiveToSupabase,
  getArchiveFromSupabase,
  deleteArchiveFromSupabase,
  toggleArchiveFavoriteInSupabase,
  clearArchiveInSupabase,
} from './supabase'

export type ArchiveItem = {
  id: string
  timestamp: number
  stripDataUrl: string
  rawFrames: string[] // data URLs of individual camera captures
  templateId: string
  filter: string
  backgroundId: string
  stickers?: any[]
  customText?: string
  textColor?: string
  eventName?: string
  favorite?: boolean
  printedCount?: number
}

export type CustomProp = {
  id: string
  label: string
  src: string
  anchor: 'forehead' | 'eyes' | 'nose' | 'ear' | 'ear-left'
  offsetX?: number
  offsetY: number
  scaleFactor: number
  isCustom: true
}

export type PropConfig = {
  anchor?: 'forehead' | 'eyes' | 'nose' | 'ear' | 'ear-left'
  offsetX?: number
  offsetY?: number
  scaleFactor?: number
}

export type PropConfigsMap = Record<string, PropConfig>

export type CustomSticker = {
  id: string
  label: string
  src: string
  category?: string
  isCustom: true
}

export type CustomBackground = {
  id: string
  label: string
  url: string
  kind: 'image'
  isCustom: true
}

export type EventSettings = {
  eventName: string
  customWatermark: string
  subWatermark: string
  autoSaveToArchive: boolean
  defaultTimer: number
  printLayout: 'single' | 'double_4x6' | 'grid'
  publicServerUrl?: string
  supabaseUrl?: string
  supabaseAnonKey?: string
  supabaseBucket?: string
}

export const DEFAULT_SETTINGS: EventSettings = {
  eventName: 'IT GUILD Event',
  customWatermark: 'IT GUILD',
  subWatermark: 'PHOTOBOOTH',
  autoSaveToArchive: true,
  defaultTimer: 3,
  printLayout: 'double_4x6',
  publicServerUrl: '',
  supabaseUrl: 'https://vygozdxjuflsyadcataw.supabase.co',
  supabaseAnonKey:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5Z296ZHhqdWZsc3lhZGNhdGF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNTkwNTEsImV4cCI6MjEwNDgzNTA1MX0.rhbMEYlHXNIi6SxfZd476a8b6Zl1lYj4ijyg2FBxlA4',
  supabaseBucket: 'photobooth',
}

const DB_NAME = 'omoide_booth_db'
const DB_VERSION = 2

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains('archive')) {
        const archiveStore = db.createObjectStore('archive', { keyPath: 'id' })
        archiveStore.createIndex('timestamp', 'timestamp', { unique: false })
      }
      if (!db.objectStoreNames.contains('custom_props')) {
        db.createObjectStore('custom_props', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('custom_stickers')) {
        db.createObjectStore('custom_stickers', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('custom_backgrounds')) {
        db.createObjectStore('custom_backgrounds', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains('active_session')) {
        db.createObjectStore('active_session', { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/* ================= CLOUD SYNC HELPER ================= */

async function syncFetch<T>(endpoint: string, options?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(endpoint, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {}),
      },
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

/* ================= IN-MEMORY ASSET CACHES & DEDUPLICATION ================= */
let _archiveCache: ArchiveItem[] | null = null
let _archiveFetchPromise: Promise<ArchiveItem[]> | null = null

let _customPropsCache: CustomProp[] | null = null
let _customPropsFetchPromise: Promise<CustomProp[]> | null = null

let _customStickersCache: CustomSticker[] | null = null
let _customStickersFetchPromise: Promise<CustomSticker[]> | null = null

let _customBackgroundsCache: CustomBackground[] | null = null
let _customBackgroundsFetchPromise: Promise<CustomBackground[]> | null = null

/* ================= ARCHIVE OPERATIONS ================= */

export async function saveToArchive(
  item: Omit<ArchiveItem, 'id' | 'timestamp'> & { id?: string; timestamp?: number }
): Promise<ArchiveItem> {
  const db = await openDB()
  const completeItem: ArchiveItem = {
    ...item,
    id: item.id || `strip_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: item.timestamp || Date.now(),
    favorite: item.favorite || false,
    printedCount: item.printedCount || 0,
  }

  // 0. Update In-Memory Cache immediately
  if (_archiveCache) {
    _archiveCache = [completeItem, ..._archiveCache.filter((a) => a.id !== completeItem.id)]
  } else {
    _archiveCache = [completeItem]
  }

  // 1. Sync to Supabase Cloud Storage (accessible across all devices & Incognito)
  saveArchiveToSupabase(completeItem).catch(() => {})

  // 2. Sync to local backend server if running
  syncFetch('/api/sync/archive', {
    method: 'POST',
    body: JSON.stringify(completeItem),
  }).catch(() => {})

  // 3. Persist to Local IndexedDB
  return new Promise((resolve, reject) => {
    const tx = db.transaction('archive', 'readwrite')
    const store = tx.objectStore('archive')
    const req = store.put(completeItem)
    req.onsuccess = () => resolve(completeItem)
    req.onerror = () => reject(req.error)
  })
}

export async function getArchive(forceRefresh = false): Promise<ArchiveItem[]> {
  // 1. Instant 0ms response from In-Memory Cache
  if (!forceRefresh && _archiveCache !== null && _archiveCache.length > 0) {
    return [..._archiveCache]
  }

  const db = await openDB()

  // 2. Read from Local IndexedDB first (near-instant <5ms)
  const localItems = await new Promise<ArchiveItem[]>((resolve) => {
    try {
      const tx = db.transaction('archive', 'readonly')
      const store = tx.objectStore('archive')
      const req = store.getAll()
      req.onsuccess = () => {
        const items = (req.result as ArchiveItem[]).sort((a, b) => b.timestamp - a.timestamp)
        resolve(items)
      }
      req.onerror = () => resolve([])
    } catch {
      resolve([])
    }
  })

  // If local items exist and not forcing refresh, return immediately while syncing cloud in background
  if (localItems.length > 0 && !forceRefresh) {
    _archiveCache = localItems

    // Background sync from Supabase cloud without blocking UI
    getArchiveFromSupabase()
      .then((cloudItems) => {
        if (cloudItems && cloudItems.length > 0) {
          const mergedMap = new Map<string, ArchiveItem>()
          cloudItems.forEach((c) => mergedMap.set(c.id, c))
          localItems.forEach((l) => mergedMap.set(l.id, l))
          const merged = Array.from(mergedMap.values()).sort((a, b) => b.timestamp - a.timestamp)
          _archiveCache = merged
          try {
            const tx = db.transaction('archive', 'readwrite')
            const store = tx.objectStore('archive')
            merged.forEach((it) => store.put(it))
          } catch {}
        }
      })
      .catch(() => {})

    return [..._archiveCache]
  }

  // 3. If Local DB is empty (e.g. Incognito mode or new device), fetch directly from Supabase Cloud
  try {
    const cloudItems = await getArchiveFromSupabase()
    if (cloudItems && cloudItems.length > 0) {
      _archiveCache = cloudItems
      try {
        const tx = db.transaction('archive', 'readwrite')
        const store = tx.objectStore('archive')
        cloudItems.forEach((it) => store.put(it))
      } catch {}
      return [...cloudItems]
    }
  } catch (sbErr) {
    console.warn('Cloud archive fetch error:', sbErr)
  }

  // 4. Fallback: Server sync endpoint
  if (!_archiveFetchPromise) {
    _archiveFetchPromise = syncFetch<ArchiveItem[]>('/api/sync/archive')
      .then((serverItems) => {
        if (serverItems && Array.isArray(serverItems) && serverItems.length > 0) {
          try {
            const tx = db.transaction('archive', 'readwrite')
            const store = tx.objectStore('archive')
            serverItems.forEach((it) => store.put(it))
          } catch {}
          const sorted = serverItems.sort((a, b) => b.timestamp - a.timestamp)
          _archiveCache = sorted
          return sorted
        }
        _archiveCache = localItems
        return localItems
      })
      .finally(() => {
        _archiveFetchPromise = null
      })
  }

  const items = await _archiveFetchPromise
  return [...items]
}

export async function deleteArchiveItem(id: string): Promise<void> {
  // Update in-memory cache immediately
  if (_archiveCache) {
    _archiveCache = _archiveCache.filter((a) => a.id !== id)
  }

  // Delete from Supabase Cloud
  await deleteArchiveFromSupabase(id).catch(() => {})

  syncFetch('/api/sync/archive/delete', {
    method: 'POST',
    body: JSON.stringify({ id }),
  }).catch(() => {})

  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('archive', 'readwrite')
    const store = tx.objectStore('archive')
    const req = store.delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export async function toggleArchiveFavorite(id: string): Promise<boolean> {
  let nextFav = false
  if (_archiveCache) {
    _archiveCache = _archiveCache.map((a) => {
      if (a.id === id) {
        nextFav = !a.favorite
        return { ...a, favorite: nextFav }
      }
      return a
    })
  }

  // Sync to Supabase Cloud
  toggleArchiveFavoriteInSupabase(id).catch(() => {})

  syncFetch('/api/sync/archive/favorite', {
    method: 'POST',
    body: JSON.stringify({ id }),
  }).catch(() => {})

  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('archive', 'readwrite')
    const store = tx.objectStore('archive')
    const getReq = store.get(id)
    getReq.onsuccess = () => {
      const item = getReq.result as ArchiveItem
      if (!item) return resolve(nextFav)
      item.favorite = !item.favorite
      store.put(item)
      resolve(item.favorite)
    }
    getReq.onerror = () => reject(getReq.error)
  })
}

export async function incrementPrintCount(id: string): Promise<number> {
  if (_archiveCache) {
    _archiveCache = _archiveCache.map((a) =>
      a.id === id ? { ...a, printedCount: (a.printedCount || 0) + 1 } : a
    )
  }

  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('archive', 'readwrite')
    const store = tx.objectStore('archive')
    const getReq = store.get(id)
    getReq.onsuccess = () => {
      const item = getReq.result as ArchiveItem
      if (!item) return resolve(0)
      item.printedCount = (item.printedCount || 0) + 1
      store.put(item)
      resolve(item.printedCount)
    }
    getReq.onerror = () => reject(getReq.error)
  })
}

export async function clearArchive(): Promise<void> {
  _archiveCache = []

  // Clear in Supabase Cloud
  await clearArchiveInSupabase().catch(() => {})

  syncFetch('/api/sync/archive/clear', {
    method: 'POST',
  }).catch(() => {})

  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('archive', 'readwrite')
    const store = tx.objectStore('archive')
    const req = store.clear()
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

/* ================= CUSTOM PROPS OPERATIONS ================= */

export async function getCustomProps(): Promise<CustomProp[]> {
  if (_customPropsCache !== null) {
    return [..._customPropsCache]
  }

  const db = await openDB()

  // Read local IndexedDB first
  const localProps = await new Promise<CustomProp[]>((resolve) => {
    try {
      const tx = db.transaction('custom_props', 'readonly')
      const store = tx.objectStore('custom_props')
      const req = store.getAll()
      req.onsuccess = () => resolve(req.result as CustomProp[])
      req.onerror = () => resolve([])
    } catch {
      resolve([])
    }
  })

  if (localProps.length > 0) {
    _customPropsCache = localProps
    // Background sync
    if (!_customPropsFetchPromise) {
      _customPropsFetchPromise = syncFetch<CustomProp[]>('/api/sync/props')
        .then((serverProps) => {
          if (serverProps && Array.isArray(serverProps)) {
            _customPropsCache = serverProps
            try {
              const tx = db.transaction('custom_props', 'readwrite')
              const store = tx.objectStore('custom_props')
              store.clear()
              serverProps.forEach((p) => store.put(p))
            } catch {}
          }
          return _customPropsCache || []
        })
        .finally(() => {
          _customPropsFetchPromise = null
        })
    }
    return [..._customPropsCache]
  }

  // Cloud Fetch fallback
  if (!_customPropsFetchPromise) {
    _customPropsFetchPromise = syncFetch<CustomProp[]>('/api/sync/props')
      .then((serverProps) => {
        if (serverProps && Array.isArray(serverProps)) {
          _customPropsCache = serverProps
          try {
            const tx = db.transaction('custom_props', 'readwrite')
            const store = tx.objectStore('custom_props')
            store.clear()
            serverProps.forEach((p) => store.put(p))
          } catch {}
          return serverProps
        }
        _customPropsCache = localProps
        return localProps
      })
      .finally(() => {
        _customPropsFetchPromise = null
      })
  }

  const res = await _customPropsFetchPromise
  return [...res]
}

export async function saveCustomProp(prop: Omit<CustomProp, 'isCustom'>): Promise<CustomProp> {
  const completeProp: CustomProp = { ...prop, isCustom: true }

  if (_customPropsCache) {
    _customPropsCache = [completeProp, ..._customPropsCache.filter((p) => p.id !== completeProp.id)]
  }

  // 1. Sync to Cloud Server
  syncFetch('/api/sync/props', {
    method: 'POST',
    body: JSON.stringify(completeProp),
  }).catch(() => {})

  // 2. Persist locally
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('custom_props', 'readwrite')
    const store = tx.objectStore('custom_props')
    const req = store.put(completeProp)
    req.onsuccess = () => resolve(completeProp)
    req.onerror = () => reject(req.error)
  })
}

export async function deleteCustomProp(id: string): Promise<void> {
  if (_customPropsCache) {
    _customPropsCache = _customPropsCache.filter((p) => p.id !== id)
  }

  syncFetch('/api/sync/props/delete', {
    method: 'POST',
    body: JSON.stringify({ id }),
  }).catch(() => {})

  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('custom_props', 'readwrite')
    const store = tx.objectStore('custom_props')
    const req = store.delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export async function getPropConfigs(): Promise<PropConfigsMap> {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      try {
        const tx = db.transaction('settings', 'readonly')
        const store = tx.objectStore('settings')
        const req = store.get('prop_configs')
        req.onsuccess = () => {
          resolve((req.result && req.result.data) || {})
        }
        req.onerror = () => resolve({})
      } catch {
        resolve({})
      }
    })
  } catch {
    return {}
  }
}

export async function savePropConfig(propId: string, config: PropConfig): Promise<void> {
  const all = await getPropConfigs()
  all[propId] = { ...(all[propId] || {}), ...config }
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite')
    const store = tx.objectStore('settings')
    const req = store.put({ key: 'prop_configs', data: all })
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export async function resetPropConfig(propId: string): Promise<void> {
  const all = await getPropConfigs()
  delete all[propId]
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite')
    const store = tx.objectStore('settings')
    const req = store.put({ key: 'prop_configs', data: all })
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

/* ================= CUSTOM STICKERS OPERATIONS ================= */

export async function getCustomStickers(): Promise<CustomSticker[]> {
  if (_customStickersCache !== null) {
    return [..._customStickersCache]
  }

  const db = await openDB()

  // Read local IndexedDB first
  const localStickers = await new Promise<CustomSticker[]>((resolve) => {
    try {
      const tx = db.transaction('custom_stickers', 'readonly')
      const store = tx.objectStore('custom_stickers')
      const req = store.getAll()
      req.onsuccess = () => resolve(req.result as CustomSticker[])
      req.onerror = () => resolve([])
    } catch {
      resolve([])
    }
  })

  if (localStickers.length > 0) {
    _customStickersCache = localStickers
    if (!_customStickersFetchPromise) {
      _customStickersFetchPromise = syncFetch<CustomSticker[]>('/api/sync/stickers')
        .then((serverStickers) => {
          if (serverStickers && Array.isArray(serverStickers)) {
            _customStickersCache = serverStickers
            try {
              const tx = db.transaction('custom_stickers', 'readwrite')
              const store = tx.objectStore('custom_stickers')
              store.clear()
              serverStickers.forEach((s) => store.put(s))
            } catch {}
          }
          return _customStickersCache || []
        })
        .finally(() => {
          _customStickersFetchPromise = null
        })
    }
    return [..._customStickersCache]
  }

  if (!_customStickersFetchPromise) {
    _customStickersFetchPromise = syncFetch<CustomSticker[]>('/api/sync/stickers')
      .then((serverStickers) => {
        if (serverStickers && Array.isArray(serverStickers)) {
          _customStickersCache = serverStickers
          try {
            const tx = db.transaction('custom_stickers', 'readwrite')
            const store = tx.objectStore('custom_stickers')
            store.clear()
            serverStickers.forEach((s) => store.put(s))
          } catch {}
          return serverStickers
        }
        _customStickersCache = localStickers
        return localStickers
      })
      .finally(() => {
        _customStickersFetchPromise = null
      })
  }

  const res = await _customStickersFetchPromise
  return [...res]
}

export async function saveCustomSticker(
  sticker: Omit<CustomSticker, 'isCustom'>
): Promise<CustomSticker> {
  const completeSticker: CustomSticker = { ...sticker, isCustom: true }

  if (_customStickersCache) {
    _customStickersCache = [completeSticker, ..._customStickersCache.filter((s) => s.id !== completeSticker.id)]
  }

  // 1. Sync to Cloud Server
  syncFetch('/api/sync/stickers', {
    method: 'POST',
    body: JSON.stringify(completeSticker),
  }).catch(() => {})

  // 2. Persist locally
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('custom_stickers', 'readwrite')
    const store = tx.objectStore('custom_stickers')
    const req = store.put(completeSticker)
    req.onsuccess = () => resolve(completeSticker)
    req.onerror = () => reject(req.error)
  })
}

export async function deleteCustomSticker(id: string): Promise<void> {
  if (_customStickersCache) {
    _customStickersCache = _customStickersCache.filter((s) => s.id !== id)
  }

  syncFetch('/api/sync/stickers/delete', {
    method: 'POST',
    body: JSON.stringify({ id }),
  }).catch(() => {})

  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('custom_stickers', 'readwrite')
    const store = tx.objectStore('custom_stickers')
    const req = store.delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

/* ================= STICKER FOLDERS & USAGE TRACKING ================= */

export const DEFAULT_STICKER_FOLDERS = [
  'Cute & Doodles',
  'MLBB',
  'Valorant',
  'Anime & Chibi',
  'Y2K Retro',
  'Event & Badges',
]

export async function getStickerFolders(): Promise<string[]> {
  try {
    const db = await openDB()
    const customFolders = await new Promise<string[]>((resolve) => {
      try {
        const tx = db.transaction('settings', 'readonly')
        const store = tx.objectStore('settings')
        const req = store.get('sticker_folders')
        req.onsuccess = () => resolve((req.result && req.result.data) || [])
        req.onerror = () => resolve([])
      } catch {
        resolve([])
      }
    })

    const merged = Array.from(new Set([...DEFAULT_STICKER_FOLDERS, ...customFolders]))
    return merged
  } catch {
    return DEFAULT_STICKER_FOLDERS
  }
}

export async function saveStickerFolder(folderName: string): Promise<string[]> {
  const trimmed = folderName.trim()
  if (!trimmed) return await getStickerFolders()
  const all = await getStickerFolders()
  if (!all.includes(trimmed)) {
    all.push(trimmed)
    const db = await openDB()
    await new Promise<void>((resolve) => {
      const tx = db.transaction('settings', 'readwrite')
      const store = tx.objectStore('settings')
      const req = store.put({ key: 'sticker_folders', data: all })
      req.onsuccess = () => resolve()
      req.onerror = () => resolve()
    })
  }
  return all
}

export async function deleteStickerFolder(folderName: string): Promise<string[]> {
  const all = await getStickerFolders()
  const filtered = all.filter((f) => f !== folderName)
  const db = await openDB()
  await new Promise<void>((resolve) => {
    const tx = db.transaction('settings', 'readwrite')
    const store = tx.objectStore('settings')
    const req = store.put({ key: 'sticker_folders', data: filtered })
    req.onsuccess = () => resolve()
    req.onerror = () => resolve()
  })
  return filtered
}

export async function getStickerConfigs(): Promise<Record<string, { category?: string }>> {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      try {
        const tx = db.transaction('settings', 'readonly')
        const store = tx.objectStore('settings')
        const req = store.get('sticker_configs')
        req.onsuccess = () => resolve((req.result && req.result.data) || {})
        req.onerror = () => resolve({})
      } catch {
        resolve({})
      }
    })
  } catch {
    return {}
  }
}

export async function updateStickerCategory(id: string, newCategory: string): Promise<void> {
  const isCustom = id.startsWith('custom_sticker_')
  if (isCustom) {
    const db = await openDB()
    const current: CustomSticker | undefined = await new Promise((resolve) => {
      const tx = db.transaction('custom_stickers', 'readonly')
      const store = tx.objectStore('custom_stickers')
      const req = store.get(id)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(undefined)
    })
    if (current) {
      await saveCustomSticker({
        ...current,
        category: newCategory,
      })
    }
  }

  // Also save to sticker_configs override store
  const allConfigs = await getStickerConfigs()
  allConfigs[id] = { ...(allConfigs[id] || {}), category: newCategory }
  const db = await openDB()
  await new Promise<void>((resolve) => {
    const tx = db.transaction('settings', 'readwrite')
    const store = tx.objectStore('settings')
    const req = store.put({ key: 'sticker_configs', data: allConfigs })
    req.onsuccess = () => resolve()
    req.onerror = () => resolve()
  })
}

export type StickerUsageRecord = { count: number; lastUsed: number }

export function getStickerUsageMap(): Record<string, StickerUsageRecord> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem('itguild_sticker_usage')
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function recordStickerUsage(stickerId: string): void {
  if (typeof window === 'undefined') return
  try {
    const current = getStickerUsageMap()
    const prev = current[stickerId] || { count: 0, lastUsed: 0 }
    current[stickerId] = {
      count: prev.count + 1,
      lastUsed: Date.now(),
    }
    localStorage.setItem('itguild_sticker_usage', JSON.stringify(current))
  } catch {}
}

/* ================= CUSTOM BACKGROUNDS OPERATIONS ================= */

export async function getCustomBackgrounds(): Promise<CustomBackground[]> {
  if (_customBackgroundsCache !== null) {
    return [..._customBackgroundsCache]
  }

  const db = await openDB()

  // Read local IndexedDB first
  const localBgs = await new Promise<CustomBackground[]>((resolve) => {
    try {
      const tx = db.transaction('custom_backgrounds', 'readonly')
      const store = tx.objectStore('custom_backgrounds')
      const req = store.getAll()
      req.onsuccess = () => resolve(req.result as CustomBackground[])
      req.onerror = () => resolve([])
    } catch {
      resolve([])
    }
  })

  if (localBgs.length > 0) {
    _customBackgroundsCache = localBgs
    if (!_customBackgroundsFetchPromise) {
      _customBackgroundsFetchPromise = syncFetch<CustomBackground[]>('/api/sync/backgrounds')
        .then((serverBgs) => {
          if (serverBgs && Array.isArray(serverBgs)) {
            _customBackgroundsCache = serverBgs
            try {
              const tx = db.transaction('custom_backgrounds', 'readwrite')
              const store = tx.objectStore('custom_backgrounds')
              store.clear()
              serverBgs.forEach((b) => store.put(b))
            } catch {}
          }
          return _customBackgroundsCache || []
        })
        .finally(() => {
          _customBackgroundsFetchPromise = null
        })
    }
    return [..._customBackgroundsCache]
  }

  if (!_customBackgroundsFetchPromise) {
    _customBackgroundsFetchPromise = syncFetch<CustomBackground[]>('/api/sync/backgrounds')
      .then((serverBgs) => {
        if (serverBgs && Array.isArray(serverBgs)) {
          _customBackgroundsCache = serverBgs
          try {
            const tx = db.transaction('custom_backgrounds', 'readwrite')
            const store = tx.objectStore('custom_backgrounds')
            store.clear()
            serverBgs.forEach((b) => store.put(b))
          } catch {}
          return serverBgs
        }
        _customBackgroundsCache = localBgs
        return localBgs
      })
      .finally(() => {
        _customBackgroundsFetchPromise = null
      })
  }

  const res = await _customBackgroundsFetchPromise
  return [...res]
}

export async function saveCustomBackground(
  bg: Omit<CustomBackground, 'isCustom' | 'kind'>
): Promise<CustomBackground> {
  const completeBg: CustomBackground = { ...bg, kind: 'image', isCustom: true }

  if (_customBackgroundsCache) {
    _customBackgroundsCache = [completeBg, ..._customBackgroundsCache.filter((b) => b.id !== completeBg.id)]
  }

  // 1. Sync to Cloud Server
  syncFetch('/api/sync/backgrounds', {
    method: 'POST',
    body: JSON.stringify(completeBg),
  }).catch(() => {})

  // 2. Persist locally
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('custom_backgrounds', 'readwrite')
    const store = tx.objectStore('custom_backgrounds')
    const req = store.put(completeBg)
    req.onsuccess = () => resolve(completeBg)
    req.onerror = () => reject(req.error)
  })
}

export async function deleteCustomBackground(id: string): Promise<void> {
  if (_customBackgroundsCache) {
    _customBackgroundsCache = _customBackgroundsCache.filter((b) => b.id !== id)
  }

  syncFetch('/api/sync/backgrounds/delete', {
    method: 'POST',
    body: JSON.stringify({ id }),
  }).catch(() => {})

  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('custom_backgrounds', 'readwrite')
    const store = tx.objectStore('custom_backgrounds')
    const req = store.delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

/* ================= SETTINGS OPERATIONS ================= */

export async function getSettings(): Promise<EventSettings> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readonly')
    const store = tx.objectStore('settings')
    const req = store.get('event_settings')
    req.onsuccess = () => {
      if (req.result && req.result.data) {
        resolve({ ...DEFAULT_SETTINGS, ...req.result.data })
      } else {
        resolve(DEFAULT_SETTINGS)
      }
    }
    req.onerror = () => reject(req.error)
  })
}

export async function saveSettings(settings: Partial<EventSettings>): Promise<EventSettings> {
  const current = await getSettings()
  const updated = { ...current, ...settings }
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite')
    const store = tx.objectStore('settings')
    const req = store.put({ key: 'event_settings', data: updated })
    req.onsuccess = () => resolve(updated)
    req.onerror = () => reject(req.error)
  })
}

/* ================= ACTIVE SESSION PERSISTENCE & AUTO-RECOVERY ================= */

export type ActiveSessionState = {
  id?: string
  step: 'layout' | 'camera' | 'edit'
  templateId: string
  rawFrames: string[] // data URLs of captured frames
  filter?: string
  backgroundId?: string
  customText?: string
  textColor?: string
  stickers?: any[]
  updatedAt: number
}

export async function saveActiveSessionState(state: Omit<ActiveSessionState, 'id'>): Promise<void> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('active_session', 'readwrite')
      const store = tx.objectStore('active_session')
      const req = store.put({ ...state, id: 'current_active_session' })
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } catch (err) {
    console.warn('Could not save active session:', err)
  }
}

export async function getActiveSessionState(): Promise<ActiveSessionState | null> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('active_session', 'readonly')
      const store = tx.objectStore('active_session')
      const req = store.get('current_active_session')
      req.onsuccess = () => resolve(req.result ? (req.result as ActiveSessionState) : null)
      req.onerror = () => reject(req.error)
    })
  } catch {
    return null
  }
}

export async function clearActiveSessionState(): Promise<void> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('active_session', 'readwrite')
      const store = tx.objectStore('active_session')
      const req = store.delete('current_active_session')
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } catch (err) {
    console.warn('Could not clear active session:', err)
  }
}

/* ================= HIDDEN ASSETS (PROPS, STICKERS, FRAMES) ================= */

export type HiddenAssets = {
  props: string[]
  stickers: string[]
  backgrounds: string[]
}

export const DEFAULT_HIDDEN_ASSETS: HiddenAssets = {
  props: [],
  stickers: [],
  backgrounds: [],
}

export async function getHiddenAssets(): Promise<HiddenAssets> {
  const db = await openDB()

  // 1. Fetch latest from Server Cloud
  const serverHidden = await syncFetch<HiddenAssets>('/api/sync/hidden')
  if (serverHidden && typeof serverHidden === 'object') {
    try {
      const tx = db.transaction('settings', 'readwrite')
      const store = tx.objectStore('settings')
      store.put({ key: 'hidden_assets', data: serverHidden })
    } catch {}
    return {
      props: Array.isArray(serverHidden.props) ? serverHidden.props : [],
      stickers: Array.isArray(serverHidden.stickers) ? serverHidden.stickers : [],
      backgrounds: Array.isArray(serverHidden.backgrounds) ? serverHidden.backgrounds : [],
    }
  }

  // 2. Fallback to Local IndexedDB
  try {
    return new Promise((resolve) => {
      const tx = db.transaction('settings', 'readonly')
      const store = tx.objectStore('settings')
      const req = store.get('hidden_assets')
      req.onsuccess = () => {
        if (req.result && req.result.data) {
          resolve({
            props: Array.isArray(req.result.data.props) ? req.result.data.props : [],
            stickers: Array.isArray(req.result.data.stickers) ? req.result.data.stickers : [],
            backgrounds: Array.isArray(req.result.data.backgrounds) ? req.result.data.backgrounds : [],
          })
        } else {
          resolve(DEFAULT_HIDDEN_ASSETS)
        }
      }
      req.onerror = () => resolve(DEFAULT_HIDDEN_ASSETS)
    })
  } catch {
    return DEFAULT_HIDDEN_ASSETS
  }
}

export async function toggleHideAsset(
  type: 'props' | 'stickers' | 'backgrounds',
  id: string
): Promise<boolean> {
  const current = await getHiddenAssets()
  const list = current[type] || []
  const isHidden = list.includes(id)
  const updatedList = isHidden ? list.filter((item) => item !== id) : [...list, id]
  const updated: HiddenAssets = {
    ...current,
    [type]: updatedList,
  }

  syncFetch('/api/sync/hidden', {
    method: 'POST',
    body: JSON.stringify({ type, id }),
  }).catch(() => {})

  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite')
    const store = tx.objectStore('settings')
    const req = store.put({ key: 'hidden_assets', data: updated })
    req.onsuccess = () => resolve(!isHidden)
    req.onerror = () => reject(req.error)
  })
}


