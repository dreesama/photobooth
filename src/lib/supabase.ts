import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { getSettings, type ArchiveItem } from './db'

let cachedClient: SupabaseClient | null = null
let cachedConfigKey = ''

const FALLBACK_URL = 'https://vygozdxjuflsyadcataw.supabase.co'
const FALLBACK_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5Z296ZHhqdWZsc3lhZGNhdGF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNTkwNTEsImV4cCI6MjEwNDgzNTA1MX0.rhbMEYlHXNIi6SxfZd476a8b6Zl1lYj4ijyg2FBxlA4'
const FALLBACK_BUCKET = 'photobooth'

/**
 * Get the Supabase credentials from Vite environment variables, Admin Settings, or hardcoded fallbacks
 */
export async function getSupabaseConfig(): Promise<{
  url: string
  key: string
  bucket: string
}> {
  const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || ''
  const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || ''
  const envBucket = (import.meta as any).env?.VITE_SUPABASE_BUCKET || 'photobooth'

  const settings = await getSettings().catch(() => null)

  const url = (settings?.supabaseUrl || envUrl || FALLBACK_URL).trim()
  const key = (settings?.supabaseAnonKey || envKey || FALLBACK_KEY).trim()
  const bucket = (settings?.supabaseBucket || envBucket || FALLBACK_BUCKET).trim()

  return { url, key, bucket }
}

/**
 * Check if Supabase credentials are configured
 */
export async function isSupabaseConfigured(): Promise<boolean> {
  const { url, key } = await getSupabaseConfig()
  return Boolean(url && key && url.startsWith('http'))
}

/**
 * Get or create Supabase client singleton
 */
export async function getSupabaseClient(): Promise<SupabaseClient | null> {
  const { url, key } = await getSupabaseConfig()
  if (!url || !key) return null

  const configKey = `${url}:::${key}`
  if (cachedClient && cachedConfigKey === configKey) {
    return cachedClient
  }

  try {
    cachedClient = createClient(url, key, {
      auth: { persistSession: false },
    })
    cachedConfigKey = configKey
    return cachedClient
  } catch (err) {
    console.warn('Failed to initialize Supabase client:', err)
    return null
  }
}

/**
 * Helper to convert a data URL or base64 string to a Blob
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',')
  const mime = parts[0]?.match(/:(.*?);/)?.[1] || 'image/jpeg'
  const bstr = atob(parts[1] || parts[0])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }
  return new Blob([u8arr], { type: mime })
}

export type UploadResult = {
  id: string
  viewerUrl: string
  stripUrl: string
  frameUrls: string[]
}

/**
 * Upload high-res photo strip and raw individual captures to Supabase Storage
 */
export async function uploadToSupabase(
  id: string,
  stripDataUrl: string,
  rawFrames: string[] = []
): Promise<UploadResult> {
  const { bucket } = await getSupabaseConfig()
  const client = await getSupabaseClient()
  if (!client) {
    throw new Error('Supabase client is not configured.')
  }

  // 1. Convert strip data URL to Blob
  const stripBlob = dataUrlToBlob(stripDataUrl)
  const stripPath = `${id}/strip.jpg`

  let { error: stripError } = await client.storage
    .from(bucket)
    .upload(stripPath, stripBlob, {
      contentType: 'image/jpeg',
      upsert: true,
    })

  // If bucket doesn't exist yet, attempt to auto-create it with public access
  if (stripError && stripError.message?.toLowerCase().includes('bucket not found')) {
    try {
      await client.storage.createBucket(bucket, { public: true })
      const retry = await client.storage
        .from(bucket)
        .upload(stripPath, stripBlob, {
          contentType: 'image/jpeg',
          upsert: true,
        })
      stripError = retry.error
    } catch {}
  }

  if (stripError) {
    throw new Error(`Failed to upload photo strip: ${stripError.message}`)
  }

  const { data: stripPublic } = client.storage.from(bucket).getPublicUrl(stripPath)
  const stripUrl = stripPublic.publicUrl

  // 2. Upload individual raw frames in parallel
  const frameUrls: string[] = []
  if (Array.isArray(rawFrames) && rawFrames.length > 0) {
    await Promise.all(
      rawFrames.map(async (rf, i) => {
        if (!rf) return
        try {
          const frameBlob = dataUrlToBlob(rf)
          const framePath = `${id}/frame_${i + 1}.jpg`
          const { error: frameError } = await client.storage
            .from(bucket)
            .upload(framePath, frameBlob, {
              contentType: 'image/jpeg',
              upsert: true,
            })

          if (!frameError) {
            const { data: framePublic } = client.storage.from(bucket).getPublicUrl(framePath)
            frameUrls[i] = framePublic.publicUrl
          }
        } catch (fErr) {
          console.warn(`Failed to upload frame ${i + 1}:`, fErr)
        }
      })
    )
  }

  // 3. Construct the clean mobile viewer URL
  const settings = await getSettings().catch(() => null)
  const configuredBase =
    settings?.publicServerUrl?.trim() || (import.meta as any).env?.VITE_PUBLIC_APP_URL || ''
  const baseUrl = configuredBase
    ? configuredBase.replace(/\/$/, '')
    : typeof window !== 'undefined'
      ? window.location.origin
      : ''
  const viewerUrl = `${baseUrl}/?photo=${id}`

  // 4. Save metadata json in the session folder
  try {
    const metaBlob = new Blob(
      [
        JSON.stringify({
          id,
          stripUrl,
          frameUrls: frameUrls.filter(Boolean),
          timestamp: Date.now(),
        }),
      ],
      { type: 'application/json' }
    )
    await client.storage.from(bucket).upload(`${id}/meta.json`, metaBlob, {
      contentType: 'application/json',
      upsert: true,
    })
  } catch {}

  return {
    id,
    viewerUrl,
    stripUrl,
    frameUrls: frameUrls.filter(Boolean),
  }
}

/**
 * Fetch photo URLs from Supabase Storage for a given photo ID
 */
export async function getPhotoFromSupabase(
  id: string
): Promise<{ stripUrl: string; frameUrls: string[] } | null> {
  const { bucket } = await getSupabaseConfig()
  const client = await getSupabaseClient()
  if (!client) return null

  try {
    const stripPath = `${id}/strip.jpg`
    const { data: stripPublic } = client.storage.from(bucket).getPublicUrl(stripPath)
    const stripUrl = stripPublic.publicUrl

    // List folder contents to find all frames
    const { data: files, error } = await client.storage.from(bucket).list(id)
    if (error || !files || files.length === 0) {
      return { stripUrl, frameUrls: [] }
    }

    const frameUrls = files
      .filter((f) => f.name.startsWith('frame_'))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((f) => client.storage.from(bucket).getPublicUrl(`${id}/${f.name}`).data.publicUrl)

    return { stripUrl, frameUrls }
  } catch (err) {
    console.warn('Error fetching photo from Supabase:', err)
    return null
  }
}

/* ================= CLOUD ARCHIVE SYNCHRONIZATION (SUPABASE) ================= */

const ARCHIVE_INDEX_PATH = '_archive_index.json'

/**
 * Save / Update Archive Item in Supabase Cloud
 */
export async function saveArchiveToSupabase(item: ArchiveItem): Promise<void> {
  const client = await getSupabaseClient()
  if (!client) return
  const { bucket } = await getSupabaseConfig()

  try {
    // 1. Fetch current index
    const currentList = await getArchiveFromSupabase().catch(() => [])
    const filtered = currentList.filter((x) => x.id !== item.id)
    const updatedList = [item, ...filtered]

    // 2. Upload updated _archive_index.json
    const blob = new Blob([JSON.stringify(updatedList)], { type: 'application/json' })
    await client.storage.from(bucket).upload(ARCHIVE_INDEX_PATH, blob, {
      contentType: 'application/json',
      upsert: true,
    })
  } catch (err) {
    console.warn('Failed to sync archive to Supabase:', err)
  }
}

/**
 * Fetch entire Photo Archive from Supabase Cloud (works in Incognito & across all devices)
 */
export async function getArchiveFromSupabase(): Promise<ArchiveItem[]> {
  const client = await getSupabaseClient()
  if (!client) return []
  const { bucket } = await getSupabaseConfig()

  try {
    // 1. Try reading _archive_index.json
    const { data, error } = await client.storage.from(bucket).download(ARCHIVE_INDEX_PATH)
    if (!error && data) {
      const text = await data.text()
      const parsed = JSON.parse(text)
      if (Array.isArray(parsed)) {
        return parsed.sort((a, b) => b.timestamp - a.timestamp)
      }
    }

    // 2. Fallback: List root folders in bucket and reconstruct items
    const { data: rootFolders, error: listError } = await client.storage.from(bucket).list()
    if (listError || !rootFolders) return []

    const reconstructed: ArchiveItem[] = []
    const folderItems = rootFolders.filter((f) => f.name && !f.name.startsWith('_') && !f.name.includes('.'))

    await Promise.all(
      folderItems.slice(0, 50).map(async (folder) => {
        try {
          const id = folder.name
          const stripUrl = client.storage.from(bucket).getPublicUrl(`${id}/strip.jpg`).data.publicUrl
          const { data: subFiles } = await client.storage.from(bucket).list(id)
          const rawFrames: string[] = []
          if (subFiles) {
            subFiles
              .filter((sf) => sf.name.startsWith('frame_'))
              .sort((a, b) => a.name.localeCompare(b.name))
              .forEach((sf) => {
                rawFrames.push(client.storage.from(bucket).getPublicUrl(`${id}/${sf.name}`).data.publicUrl)
              })
          }

          reconstructed.push({
            id,
            timestamp: folder.created_at ? new Date(folder.created_at).getTime() : Date.now(),
            stripDataUrl: stripUrl,
            rawFrames,
            templateId: '2x6',
            filter: 'original',
            favorite: false,
            printedCount: 0,
          })
        } catch {}
      })
    )

    return reconstructed.sort((a, b) => b.timestamp - a.timestamp)
  } catch (err) {
    console.warn('Error reading archive from Supabase:', err)
    return []
  }
}

/**
 * Delete Archive Item from Supabase Cloud
 */
export async function deleteArchiveFromSupabase(id: string): Promise<void> {
  const client = await getSupabaseClient()
  if (!client) return
  const { bucket } = await getSupabaseConfig()

  try {
    // 1. Delete folder contents
    const { data: files } = await client.storage.from(bucket).list(id)
    if (files && files.length > 0) {
      const paths = files.map((f) => `${id}/${f.name}`)
      await client.storage.from(bucket).remove(paths)
    }

    // 2. Update _archive_index.json
    const currentList = await getArchiveFromSupabase().catch(() => [])
    const updated = currentList.filter((x) => x.id !== id)
    const blob = new Blob([JSON.stringify(updated)], { type: 'application/json' })
    await client.storage.from(bucket).upload(ARCHIVE_INDEX_PATH, blob, {
      contentType: 'application/json',
      upsert: true,
    })
  } catch (err) {
    console.warn('Error deleting from Supabase:', err)
  }
}

/**
 * Toggle Favorite in Supabase Cloud
 */
export async function toggleArchiveFavoriteInSupabase(id: string): Promise<void> {
  const client = await getSupabaseClient()
  if (!client) return
  const { bucket } = await getSupabaseConfig()

  try {
    const currentList = await getArchiveFromSupabase().catch(() => [])
    const updated = currentList.map((x) => (x.id === id ? { ...x, favorite: !x.favorite } : x))
    const blob = new Blob([JSON.stringify(updated)], { type: 'application/json' })
    await client.storage.from(bucket).upload(ARCHIVE_INDEX_PATH, blob, {
      contentType: 'application/json',
      upsert: true,
    })
  } catch (err) {
    console.warn('Error toggling favorite in Supabase:', err)
  }
}

/**
 * Clear All Archive in Supabase Cloud
 */
export async function clearArchiveInSupabase(): Promise<void> {
  const client = await getSupabaseClient()
  if (!client) return
  const { bucket } = await getSupabaseConfig()

  try {
    const blob = new Blob([JSON.stringify([])], { type: 'application/json' })
    await client.storage.from(bucket).upload(ARCHIVE_INDEX_PATH, blob, {
      contentType: 'application/json',
      upsert: true,
    })
  } catch (err) {
    console.warn('Error clearing archive in Supabase:', err)
  }
}

