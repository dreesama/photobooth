import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { getSettings } from './db'

let cachedClient: SupabaseClient | null = null
let cachedConfigKey = ''

/**
 * Get the Supabase credentials from Vite environment variables or Admin Settings
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

  const url = (settings?.supabaseUrl || envUrl || '').trim()
  const key = (settings?.supabaseAnonKey || envKey || '').trim()
  const bucket = (settings?.supabaseBucket || envBucket || 'photobooth').trim()

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
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const viewerUrl = `${baseUrl}/?photo=${id}`

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
