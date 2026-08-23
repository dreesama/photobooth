// Sticker doodles imported from the OmoideCam Figma design + Custom uploaded stickers
import s1 from '../imports/OmoideCam-4/0aa47425d76beb1eef9ae0ae40f33f6a0c3c219a.png'
import s2 from '../imports/OmoideCam-4/5af19ec57074f92c52d6bca9470b9a75b64c9893.png'
import s3 from '../imports/OmoideCam-4/ada9825bc75151212ba8aa24ece21a5f4a8f1969.png'
import s4 from '../imports/OmoideCam-4/edbcd5ccf00469367aea9add5f791b41770d167f.png'
import s5 from '../imports/OmoideCam-4/1ca4a1b1a34dc58794dd49273de953246cae4280.png'
import s6 from '../imports/OmoideCam-4/e4f5397eea5199258f19cbfb53cef050db0a4fb9.png'
import s7 from '../imports/OmoideCam-4/821d2968f5a1882f034b03e8488d913c097b295a.png'
import s8 from '../imports/OmoideCam-4/5a18eee46d47840055fc98ba07b68922782409b5.png'
import s9 from '../imports/OmoideCam-4/bbbfec1a9a763836c989ead3116814d0d1f9c0f3.png'
import {
  getCustomStickers,
  getHiddenAssets,
  getStickerUsageMap,
  getStickerConfigs,
  type CustomSticker,
} from './db'

export type StickerDef = {
  id: string
  src: string
  label: string
  category?: string
  isCustom?: boolean
  isHidden?: boolean
}

export const BUILTIN_STICKERS: StickerDef[] = [
  { id: 'st1', src: s1, label: 'Star', category: 'Cute & Doodles' },
  { id: 'st2', src: s2, label: 'Sushi', category: 'Cute & Doodles' },
  { id: 'st3', src: s3, label: 'Ribbon', category: 'Cute & Doodles' },
  { id: 'st4', src: s4, label: 'Heart', category: 'Cute & Doodles' },
  { id: 'st5', src: s5, label: 'Sparkle', category: 'Cute & Doodles' },
  { id: 'st6', src: s6, label: 'Drink', category: 'Cute & Doodles' },
  { id: 'st7', src: s7, label: 'Bunny', category: 'Anime & Chibi' },
  { id: 'st8', src: s8, label: 'Cat', category: 'Anime & Chibi' },
  { id: 'st9', src: s9, label: 'Cherry', category: 'Y2K Retro' },
]

export let STICKERS: StickerDef[] = [...BUILTIN_STICKERS]

export type PlacedSticker = {
  uid: string
  src: string
  x: number
  y: number
  scale: number
  rotation: number
}

// Preload sticker art so it can be composited synchronously at export time.
const cache = new Map<string, HTMLImageElement>()

export async function loadStickers(includeHidden = false): Promise<StickerDef[]> {
  try {
    const [custom, hiddenAssets, stickerConfigs] = await Promise.all([
      getCustomStickers(),
      getHiddenAssets(),
      getStickerConfigs(),
    ])
    const hiddenSet = new Set(hiddenAssets.stickers || [])
    const all = [...BUILTIN_STICKERS, ...custom].map((s) => {
      const cfg = stickerConfigs[s.id]
      return {
        ...s,
        category: cfg?.category || s.category || 'Cute & Doodles',
        isHidden: hiddenSet.has(s.id),
      }
    })

    STICKERS = includeHidden ? all : all.filter((s) => !s.isHidden)
  } catch {
    STICKERS = [...BUILTIN_STICKERS]
  }

  for (const s of STICKERS) {
    if (cache.has(s.src)) continue
    const im = new Image()
    im.src = s.src
    cache.set(s.src, im)
  }

  return STICKERS
}

export function stickerImage(src: string): HTMLImageElement | null {
  let im = cache.get(src)
  if (!im) {
    im = new Image()
    im.src = src
    cache.set(src, im)
  }
  return im
}

/**
 * Returns Top 10 most used / recently used stickers.
 */
export function getRecentOrPopularStickers(all: StickerDef[], limit = 10): StickerDef[] {
  const usageMap = getStickerUsageMap()
  const sorted = [...all].sort((a, b) => {
    const statA = usageMap[a.id] || { count: 0, lastUsed: 0 }
    const statB = usageMap[b.id] || { count: 0, lastUsed: 0 }
    if (statB.count !== statA.count) {
      return statB.count - statA.count
    }
    if (statB.lastUsed !== statA.lastUsed) {
      return statB.lastUsed - statA.lastUsed
    }
    return 0
  })
  return sorted.slice(0, limit)
}
