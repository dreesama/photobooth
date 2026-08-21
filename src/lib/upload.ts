/**
 * Self-Hosted Photo Uploader for Photobooth Softcopies
 * Uploads high-res photo strips directly to the self-hosted server backend (/api/upload).
 * When deployed to Railway, the server returns your custom branded mobile download link.
 */

export async function uploadPhotoStrip(dataUrl: string): Promise<string> {
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataUrl }),
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
