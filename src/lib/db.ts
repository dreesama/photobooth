// IndexedDB storage layer for Photo Archive, Custom Assets (Props, Stickers, Frames), and Event Settings

export type ArchiveItem = {
  id: string
  timestamp: number
  stripDataUrl: string
  rawFrames: string[] // data URLs of individual camera captures
  templateId: string
  filter: string
  backgroundId: string
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
}

export const DEFAULT_SETTINGS: EventSettings = {
  eventName: 'OmoideCam Event',
  customWatermark: 'OmoideCam',
  subWatermark: 'PHOTOBOOTH',
  autoSaveToArchive: true,
  defaultTimer: 3,
  printLayout: 'double_4x6',
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
  return new Promise((resolve, reject) => {
    const tx = db.transaction('custom_props', 'readonly')
    const store = tx.objectStore('custom_props')
    const req = store.getAll()
    req.onsuccess = () => resolve(req.result as CustomProp[])
    req.onerror = () => reject(req.error)
  })
}

export async function saveCustomProp(prop: Omit<CustomProp, 'isCustom'>): Promise<CustomProp> {
  const db = await openDB()
  const completeProp: CustomProp = { ...prop, isCustom: true }
  return new Promise((resolve, reject) => {
    const tx = db.transaction('custom_props', 'readwrite')
    const store = tx.objectStore('custom_props')
    const req = store.put(completeProp)
    req.onsuccess = () => resolve(completeProp)
    req.onerror = () => reject(req.error)
  })
}

export async function deleteCustomProp(id: string): Promise<void> {
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
  return new Promise((resolve, reject) => {
    const tx = db.transaction('custom_stickers', 'readonly')
    const store = tx.objectStore('custom_stickers')
    const req = store.getAll()
    req.onsuccess = () => resolve(req.result as CustomSticker[])
    req.onerror = () => reject(req.error)
  })
}

export async function saveCustomSticker(sticker: Omit<CustomSticker, 'isCustom'>): Promise<CustomSticker> {
  const db = await openDB()
  const completeSticker: CustomSticker = { ...sticker, isCustom: true }
  return new Promise((resolve, reject) => {
    const tx = db.transaction('custom_stickers', 'readwrite')
    const store = tx.objectStore('custom_stickers')
    const req = store.put(completeSticker)
    req.onsuccess = () => resolve(completeSticker)
    req.onerror = () => reject(req.error)
  })
}

export async function deleteCustomSticker(id: string): Promise<void> {
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
  const db = await openDB()
  const completeBg: CustomBackground = { ...bg, kind: 'image', isCustom: true }
  return new Promise((resolve, reject) => {
    const tx = db.transaction('custom_backgrounds', 'readwrite')
    const store = tx.objectStore('custom_backgrounds')
    const req = store.put(completeBg)
    req.onsuccess = () => resolve(completeBg)
    req.onerror = () => reject(req.error)
  })
}

export async function deleteCustomBackground(id: string): Promise<void> {
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

