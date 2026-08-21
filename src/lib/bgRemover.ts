// Fast, high-quality client-side background removal & transparency keying for Stickers & Wearable Props

export type RemoveBgOptions = {
  tolerance?: number // 10 - 80 (default 35)
  targetColor?: 'auto' | 'white' | 'black'
  feather?: boolean
}

export function removeBackground(
  imageSource: string | HTMLImageElement,
  options: RemoveBgOptions = {}
): Promise<string> {
  const { tolerance = 35, targetColor = 'auto', feather = true } = options

  return new Promise((resolve, reject) => {
    const processImage = (img: HTMLImageElement) => {
      try {
        const canvas = document.createElement('canvas')
        const w = img.naturalWidth || img.width
        const h = img.naturalHeight || img.height
        canvas.width = w
        canvas.height = h

        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) return resolve(img.src)

        ctx.drawImage(img, 0, 0, w, h)
        const imgData = ctx.getImageData(0, 0, w, h)
        const data = imgData.data

        // Detect background color from corners
        let bgR = 255
        let bgG = 255
        let bgB = 255

        if (targetColor === 'auto') {
          const corners = [
            0, // Top-left
            (w - 1) * 4, // Top-right
            (h - 1) * w * 4, // Bottom-left
            ((h - 1) * w + (w - 1)) * 4, // Bottom-right
          ]

          let sumR = 0,
            sumG = 0,
            sumB = 0,
            valid = 0

          corners.forEach((idx) => {
            if (data[idx + 3] > 10) {
              sumR += data[idx]
              sumG += data[idx + 1]
              sumB += data[idx + 2]
              valid++
            }
          })

          if (valid > 0) {
            bgR = Math.round(sumR / valid)
            bgG = Math.round(sumG / valid)
            bgB = Math.round(sumB / valid)
          }
        } else if (targetColor === 'black') {
          bgR = 0
          bgG = 0
          bgB = 0
        }

        // Color distance function
        const maxDist = tolerance * 4.4
        const softDist = maxDist * 1.35

        // Connected border flood-fill mask
        const visited = new Uint8Array(w * h)
        const queue: number[] = []

        // Push border pixels
        for (let x = 0; x < w; x++) {
          queue.push(x, 0)
          queue.push(x, h - 1)
        }
        for (let y = 1; y < h - 1; y++) {
          queue.push(0, y)
          queue.push(w - 1, y)
        }

        // Flood fill from borders to remove background while preserving internal whites/colors
        let head = 0
        while (head < queue.length) {
          const x = queue[head++]
          const y = queue[head++]
          const pIndex = y * w + x

          if (visited[pIndex]) continue
          visited[pIndex] = 1

          const idx = pIndex * 4
          const r = data[idx]
          const g = data[idx + 1]
          const b = data[idx + 2]
          const a = data[idx + 3]

          if (a === 0) continue

          const dist = Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2)

          if (dist <= softDist) {
            if (dist <= maxDist) {
              data[idx + 3] = 0 // Completely transparent
            } else if (feather) {
              const alphaRatio = (dist - maxDist) / (softDist - maxDist)
              data[idx + 3] = Math.round(a * alphaRatio)
            }

            // Neighboring 4 pixels
            if (x > 0 && !visited[pIndex - 1]) queue.push(x - 1, y)
            if (x < w - 1 && !visited[pIndex + 1]) queue.push(x + 1, y)
            if (y > 0 && !visited[pIndex - w]) queue.push(x, y - 1)
            if (y < h - 1 && !visited[pIndex + w]) queue.push(x, y + 1)
          }
        }

        ctx.putImageData(imgData, 0, 0)
        resolve(canvas.toDataURL('image/png'))
      } catch (err) {
        console.warn('BG removal failed:', err)
        resolve(typeof imageSource === 'string' ? imageSource : imageSource.src)
      }
    }

    if (typeof imageSource === 'string') {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => processImage(img)
      img.onerror = () => resolve(imageSource)
      img.src = imageSource
    } else {
      if (imageSource.complete) {
        processImage(imageSource)
      } else {
        imageSource.onload = () => processImage(imageSource)
        imageSource.onerror = () => resolve(imageSource.src)
      }
    }
  })
}
