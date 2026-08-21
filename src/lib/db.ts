// IndexedDB storage layer for Photo Archive, Custom Assets (Props, Stickers, Frames), and Event Settings

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
  anchor: 'forehead' | 'eyes' | 'nose' | 'ear'
  offsetY: number
  scaleFactor: number
  isCustom: true
}

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
}

export const DEFAULT_SETTINGS: EventSettings = {
  eventName: 'IT GUILD Event',
  customWatermark: 'IT GUILD',
  subWatermark: 'PHOTOBOOTH',
  autoSaveToArchive: true,
  defaultTimer: 3,
  printLayout: 'double_4x6',
  publicServerUrl: 'https://esportcup.up.railway.app',
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

  // 1. Sync to Cloud Server
  syncFetch('/api/sync/archive', {
    method: 'POST',
    body: JSON.stringify(completeItem),
  }).catch(() => {})

  // 2. Persist to Local IndexedDB
  return new Promise((resolve, reject) => {
    const tx = db.transaction('archive', 'readwrite')
    const store = tx.objectStore('archive')
    const req = store.put(completeItem)
    req.onsuccess = () => resolve(completeItem)
    req.onerror = () => reject(req.error)
  })
}

export async function getArchive(): Promise<ArchiveItem[]> {
  const db = await openDB()

  // 1. Fetch latest from Server Cloud
  const serverItems = await syncFetch<ArchiveItem[]>('/api/sync/archive')
  if (serverItems && Array.isArray(serverItems) && serverItems.length > 0) {
    try {
      const tx = db.transaction('archive', 'readwrite')
      const store = tx.objectStore('archive')
      serverItems.forEach((it) => store.put(it))
    } catch {}
    return serverItems.sort((a, b) => b.timestamp - a.timestamp)
  }

  // 2. Fallback to Local IndexedDB
  return new Promise((resolve, reject) => {
    const tx = db.transaction('archive', 'readonly')
    const store = tx.objectStore('archive')
    const req = store.getAll()
    req.onsuccess = () => {
      const items = (req.result as ArchiveItem[]).sort((a, b) => b.timestamp - a.timestamp)
      resolve(items)
    }
    req.onerror = () => reject(req.error)
  })
}

export async function deleteArchiveItem(id: string): Promise<void> {
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
      if (!item) return resolve(false)
      item.favorite = !item.favorite
      store.put(item)
      resolve(item.favorite)
    }
    getReq.onerror = () => reject(getReq.error)
  })
}

export async function incrementPrintCount(id: string): Promise<number> {
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
  const db = await openDB()

  // 1. Fetch latest from Server Cloud
  const serverProps = await syncFetch<CustomProp[]>('/api/sync/props')
  if (serverProps && Array.isArray(serverProps)) {
    try {
      const tx = db.transaction('custom_props', 'readwrite')
      const store = tx.objectStore('custom_props')
      store.clear()
      serverProps.forEach((p) => store.put(p))
    } catch {}
    return serverProps
  }

  // 2. Fallback to Local IndexedDB
  return new Promise((resolve, reject) => {
    const tx = db.transaction('custom_props', 'readonly')
    const store = tx.objectStore('custom_props')
    const req = store.getAll()
    req.onsuccess = () => resolve(req.result as CustomProp[])
    req.onerror = () => reject(req.error)
  })
}

export async function saveCustomProp(prop: Omit<CustomProp, 'isCustom'>): Promise<CustomProp> {
  const completeProp: CustomProp = { ...prop, isCustom: true }

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

/* ================= CUSTOM STICKERS OPERATIONS ================= */

export async function getCustomStickers(): Promise<CustomSticker[]> {
  const db = await openDB()

  // 1. Fetch latest from Server Cloud
  const serverStickers = await syncFetch<CustomSticker[]>('/api/sync/stickers')
  if (serverStickers && Array.isArray(serverStickers)) {
    try {
      const tx = db.transaction('custom_stickers', 'readwrite')
      const store = tx.objectStore('custom_stickers')
      store.clear()
      serverStickers.forEach((s) => store.put(s))
    } catch {}
    return serverStickers
  }

  // 2. Fallback to Local IndexedDB
  return new Promise((resolve, reject) => {
    const tx = db.transaction('custom_stickers', 'readonly')
    const store = tx.objectStore('custom_stickers')
    const req = store.getAll()
    req.onsuccess = () => resolve(req.result as CustomSticker[])
    req.onerror = () => reject(req.error)
  })
}

export async function saveCustomSticker(
  sticker: Omit<CustomSticker, 'isCustom'>
): Promise<CustomSticker> {
  const completeSticker: CustomSticker = { ...sticker, isCustom: true }

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

/* ================= CUSTOM BACKGROUNDS OPERATIONS ================= */

export async function getCustomBackgrounds(): Promise<CustomBackground[]> {
  const db = await openDB()

  // 1. Fetch latest from Server Cloud
  const serverBgs = await syncFetch<CustomBackground[]>('/api/sync/backgrounds')
  if (serverBgs && Array.isArray(serverBgs)) {
    try {
      const tx = db.transaction('custom_backgrounds', 'readwrite')
      const store = tx.objectStore('custom_backgrounds')
      store.clear()
      serverBgs.forEach((b) => store.put(b))
    } catch {}
    return serverBgs
  }

  // 2. Fallback to Local IndexedDB
  return new Promise((resolve, reject) => {
    const tx = db.transaction('custom_backgrounds', 'readonly')
    const store = tx.objectStore('custom_backgrounds')
    const req = store.getAll()
    req.onsuccess = () => resolve(req.result as CustomBackground[])
    req.onerror = () => reject(req.error)
  })
}

export async function saveCustomBackground(
  bg: Omit<CustomBackground, 'isCustom' | 'kind'>
): Promise<CustomBackground> {
  const completeBg: CustomBackground = { ...bg, kind: 'image', isCustom: true }

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


