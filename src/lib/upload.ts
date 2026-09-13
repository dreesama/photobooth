import { getSettings } from './db'
import { isSupabaseConfigured, uploadToSupabase } from './supabase'

/**
 * Universal Photo Uploader for Photobooth Softcopies
 * 1. If Supabase is configured (Vercel + Supabase), uploads directly to Supabase Storage bucket.
 * 2. Otherwise falls back to self-hosted server backend (/api/upload on Railway or local).
 */
export async function uploadPhotoStrip(
  dataUrl: string,
  rawFrames: string[] = [],
  customId?: string
): Promise<string> {
  const photoId = customId || `photo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`

  // 1. Try Supabase Storage first if configured
  const hasSupabase = await isSupabaseConfigured().catch(() => false)
  if (hasSupabase) {
    try {
      const result = await uploadToSupabase(photoId, dataUrl, rawFrames)
      if (result?.viewerUrl) {
        return result.viewerUrl
      }
    } catch (sbErr) {
      console.warn('Supabase upload attempt failed, falling back to server API:', sbErr)
    }
  }

  // 2. Fallback to /api/upload
  const settings = await getSettings().catch(() => null)
  const configuredDomain =
    settings?.publicServerUrl?.trim() || (import.meta as any).env?.VITE_PUBLIC_UPLOAD_URL || ''

  const endpoint = configuredDomain
    ? `${configuredDomain.replace(/\/$/, '')}/api/upload`
    : '/api/upload'

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataUrl, rawFrames, id: photoId }),
  })

  if (!res.ok) {
    const errorText = await res.text().catch(() => '')
    throw new Error(errorText || `Server upload failed (${res.status})`)
  }

  const json = await res.json()
  if (json?.url) {
    return json.url
  }

  throw new Error('Invalid response from upload server.')
}
