/**
 * Public Cloud Uploader for Photo Booth QR Softcopies
 * Uploads photo strips directly to Catbox / Litterbox so any phone on any network (4G/5G/Wi-Fi) can view & save.
 */

export async function uploadPhotoStrip(dataUrl: string): Promise<string> {
  // Priority 1: Backend proxy (/api/upload -> Catbox Litterbox / Catbox / FreeImage)
  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataUrl }),
    })

    if (res.ok) {
      const json = await res.json()
      if (json?.url && json.url.startsWith('http')) {
        return json.url
      }
    }
  } catch (e) {
    console.warn('Backend upload proxy error, trying browser direct upload...', e)
  }

  // Priority 2: Catbox / Litterbox direct from browser (72h retention)
  try {
    const blobRes = await fetch(dataUrl)
    const blob = await blobRes.blob()
    const formData = new FormData()
    formData.append('reqtype', 'fileupload')
    formData.append('time', '72h')
    formData.append('fileToUpload', blob, `omoidecam-${Date.now()}.png`)

    const res = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', {
      method: 'POST',
      body: formData,
    })

    if (res.ok) {
      const text = (await res.text()).trim()
      if (text.startsWith('http')) {
        return text
      }
    }
  } catch (e) {
    console.warn('Direct Litterbox upload error:', e)
  }

  // Priority 3: Catbox permanent direct from browser
  try {
    const blobRes = await fetch(dataUrl)
    const blob = await blobRes.blob()
    const formData = new FormData()
    formData.append('reqtype', 'fileupload')
    formData.append('fileToUpload', blob, `omoidecam-${Date.now()}.png`)

    const res = await fetch('https://catbox.moe/user/api.php', {
      method: 'POST',
      body: formData,
    })

    if (res.ok) {
      const text = (await res.text()).trim()
      if (text.startsWith('http')) {
        return text
      }
    }
  } catch (e) {
    console.warn('Direct Catbox upload error:', e)
  }

  // Priority 4: FreeImage.host direct
  try {
    const base64Data = dataUrl.split(',')[1] || dataUrl
    const formData = new FormData()
    formData.append('key', '6d207e02198a847aa98d0a2a901485a5')
    formData.append('action', 'upload')
    formData.append('source', base64Data)
    formData.append('format', 'json')

    const res = await fetch('https://freeimage.host/api/1/upload', {
      method: 'POST',
      body: formData,
    })

    if (res.ok) {
      const json = await res.json()
      if (json?.image?.url) {
        return json.image.url
      }
    }
  } catch (e) {
    console.warn('Direct FreeImage upload error:', e)
  }

  throw new Error('Upload service could not be reached. Please check your internet connection or save directly.')
}
