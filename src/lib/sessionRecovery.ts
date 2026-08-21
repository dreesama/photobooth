import { getActiveSessionState, saveActiveSessionState, clearActiveSessionState, type ActiveSessionState } from './db'

export async function dataUrlsToCanvases(dataUrls: string[]): Promise<HTMLCanvasElement[]> {
  const promises = dataUrls.map(
    (url) =>
      new Promise<HTMLCanvasElement>((resolve) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.src = url
        img.onload = () => {
          const canvas = document.createElement('canvas')
          canvas.width = img.naturalWidth || 1040
          canvas.height = img.naturalHeight || 780
          const ctx = canvas.getContext('2d')!
          ctx.drawImage(img, 0, 0)
          resolve(canvas)
        }
        img.onerror = () => {
          const canvas = document.createElement('canvas')
          canvas.width = 1040
          canvas.height = 780
          resolve(canvas)
        }
      })
  )
  return Promise.all(promises)
}

export { getActiveSessionState, saveActiveSessionState, clearActiveSessionState, type ActiveSessionState }
