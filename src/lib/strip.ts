import { stickerImage, type PlacedSticker } from './stickers'
import frameTextureUrl from '../assets/frame_texture.png'

const frameTextureImg = new Image()
frameTextureImg.src = frameTextureUrl

// Real frame backgrounds imported from the OmoideCam Figma design (imgImage4–13),
// plus the couple illustration the user added.
import bg1 from '../imports/OmoideCam-4/fee84632e3e63445545e7e25d5dccf9dac3d044f.png'
import bg2 from '../imports/OmoideCam-4/51287c9a54cb7600aac6a0912c63898a7a12c19a.png'
import bg3 from '../imports/OmoideCam-4/db8f34fe443221ebdc3c2f80cfcc637a7704f650.png'
import bg4 from '../imports/OmoideCam-4/9a942c1e8eec583a9ccdbee60b2ef02317561cb6.png'
import bg5 from '../imports/OmoideCam-4/08793c4cb32818bf8aa366a632220e1a3e01b98e.png'
import bg6 from '../imports/OmoideCam-4/e9c94177d104c894f9a44a9bdc8e2041eb6e3f2f.png'
import bg7 from '../imports/OmoideCam-4/90cca7137c3aeaf05c584f4b476b35f5c27c8bac.png'
import bg8 from '../imports/OmoideCam-4/b8a025252b86f486febcd65176804b39569a5a21.png'
import bg9 from '../imports/OmoideCam-4/77370f2e7b062f5b55f4ffe393a4915793469d2e.png'
import bg10 from '../imports/OmoideCam-4/e7b0e741171e09129e4fa94734631b75341f0381.png'
import bg11 from '../imports/image-4.png'

/* ---------------- Filters (16, names matched to the original) ---------------- */
export type FilterId =
  | 'original' | 'athena' | 'aurora' | 'eucalyptus' | 'frost' | 'hokusai'
  | 'sepia' | 'sharpen' | 'aldente' | 'audrey' | 'daguerre' | 'fes'
  | 'hairspray' | 'bw' | 'blur' | 'pixelate'

export const FILTERS: { id: FilterId; label: string; css: string }[] = [
  { id: 'original', label: 'Original', css: 'none' },
  { id: 'athena', label: 'Athena', css: 'brightness(1.06) contrast(0.96) saturate(1.12)' },
  { id: 'aurora', label: 'Aurora', css: 'brightness(1.12) saturate(1.25) hue-rotate(-10deg)' },
  { id: 'eucalyptus', label: 'Eucalyptus', css: 'sepia(0.2) saturate(1.15) hue-rotate(35deg) brightness(1.06)' },
  { id: 'frost', label: 'Frost', css: 'brightness(1.1) saturate(0.85) contrast(1.05) hue-rotate(150deg)' },
  { id: 'hokusai', label: 'Hokusai', css: 'contrast(1.12) saturate(1.35) brightness(1.02)' },
  { id: 'sepia', label: 'Sepia', css: 'sepia(0.8) contrast(1.05) brightness(1.02)' },
  { id: 'sharpen', label: 'Sharpen', css: 'contrast(1.4) brightness(1.05) saturate(1.15)' },
  { id: 'aldente', label: 'Al Dente', css: 'sepia(0.32) saturate(1.4) contrast(1.1) brightness(1.03)' },
  { id: 'audrey', label: 'Audrey', css: 'grayscale(0.35) contrast(1.2) brightness(1.06)' },
  { id: 'daguerre', label: 'Daguerre', css: 'sepia(0.6) contrast(1.1) brightness(0.94)' },
  { id: 'fes', label: 'Fes', css: 'saturate(1.5) contrast(1.1) hue-rotate(-15deg) brightness(1.05)' },
  { id: 'hairspray', label: 'Hairspray', css: 'saturate(1.3) contrast(0.9) brightness(1.12)' },
  { id: 'bw', label: 'B&W', css: 'grayscale(1) contrast(1.1)' },
  { id: 'blur', label: 'Blur', css: 'blur(2.5px)' },
  { id: 'pixelate', label: 'Pixelate', css: 'contrast(1.05)' },
]

export const cssForFilter = (id: FilterId) =>
  FILTERS.find((f) => f.id === id)?.css ?? 'none'

/* ---------------- Layout templates ---------------- */
export type Template = {
  id: string
  label: string
  sub: string
  cols: number
  rows: number
}
export const TEMPLATES: Template[] = [
  { id: 'strip2', label: '2x6', sub: '2 photo', cols: 1, rows: 2 },
  { id: 'strip3', label: '2x6', sub: '3 photo', cols: 1, rows: 3 },
  { id: 'strip4', label: '2x6', sub: '4 photo', cols: 1, rows: 4 },
  { id: 'grid6', label: '4x6', sub: '6 photo', cols: 2, rows: 3 },
  { id: 'grid8', label: '4x6', sub: '8 photo', cols: 2, rows: 4 },
]
export const countFor = (t: Template) => (t ? t.cols * t.rows : 0)

/* ---------------- Logo language (Translation buttons) ---------------- */
export type LogoLang = 'en' | 'zh' | 'ko' | 'ja' | 'tl'
export const LOGOS: { id: LogoLang; label: string; text: string }[] = [
  { id: 'en', label: 'IT GUILD', text: 'IT GUILD' },
  { id: 'zh', label: '思忆相机', text: '思忆相机' },
  { id: 'ko', label: '오모이드캠', text: '오모이드캠' },
  { id: 'ja', label: 'おもいでカメラ', text: 'おもいでカメラ' },
  { id: 'tl', label: 'ᜂᜋᜓᜁᜇᜒᜃ᜔ᜀᜋ᜔', text: 'ᜂᜋᜓᜁᜇᜒᜃ᜔ᜀᜋ᜔' },
]
export const logoText = (id: LogoLang) => LOGOS.find((l) => l.id === id)?.text ?? 'IT GUILD'

/* ---------------- Text Colors ---------------- */
export const TEXT_COLORS = [
  { id: 'blue', label: 'Classic Blue', color: '#5b7fcb' },
  { id: 'white', label: 'Pure White', color: '#ffffff' },
  { id: 'black', label: 'Charcoal Black', color: '#1e293b' },
  { id: 'pink', label: 'Sakura Pink', color: '#ff6b9d' },
  { id: 'purple', label: 'Lavender', color: '#9b72cf' },
  { id: 'mint', label: 'Mint Green', color: '#2ec4b6' },
  { id: 'coral', label: 'Sunset Coral', color: '#ff8360' },
  { id: 'gold', label: 'Warm Gold', color: '#e09f3e' },
]

/* ---------------- Font Options ---------------- */
export type FontOption = {
  id: string
  label: string
  family: string
  sample: string
  size: number
}

export const FONT_OPTIONS: FontOption[] = [
  { id: 'pixel', label: '8-Bit Pixel', family: '"Press Start 2P", monospace', sample: 'PIXEL', size: 44 },
  { id: 'digital', label: 'Retro CRT', family: '"VT323", monospace', sample: 'Retro', size: 68 },
  { id: 'handwritten', label: 'Handwritten', family: '"Caveat", cursive', sample: 'Lovely', size: 64 },
  { id: 'bubble', label: 'Cute Bubble', family: '"Fredoka", sans-serif', sample: 'Bubble', size: 52 },
  { id: 'bold', label: 'Modern Bold', family: '"Montserrat", sans-serif', sample: 'Bold', size: 48 },
  { id: 'typewriter', label: 'Typewriter', family: '"Special Elite", monospace', sample: 'Type', size: 46 },
]

import { getCustomBackgrounds, getHiddenAssets, type CustomBackground } from './db'

/* ---------------- Backgrounds (frame) ---------------- */
export type BgKind = 'none' | 'image'
export type Background = {
  id: string
  label?: string
  kind: BgKind
  url?: string
  _img?: HTMLImageElement
  isCustom?: boolean
  isHidden?: boolean
}

export const BUILTIN_BACKGROUNDS: Background[] = [
  { id: 'none', label: 'None', kind: 'none' },
  { id: 'bg1', label: 'Frame 1', kind: 'image', url: bg1 },
  { id: 'bg2', label: 'Frame 2', kind: 'image', url: bg2 },
  { id: 'bg3', label: 'Frame 3', kind: 'image', url: bg3 },
  { id: 'bg4', label: 'Frame 4', kind: 'image', url: bg4 },
  { id: 'bg5', label: 'Frame 5', kind: 'image', url: bg5 },
  { id: 'bg6', label: 'Frame 6', kind: 'image', url: bg6 },
  { id: 'bg7', label: 'Frame 7', kind: 'image', url: bg7 },
  { id: 'bg8', label: 'Frame 8', kind: 'image', url: bg8 },
  { id: 'bg9', label: 'Frame 9', kind: 'image', url: bg9 },
  { id: 'bg10', label: 'Frame 10', kind: 'image', url: bg10 },
  { id: 'bg11', label: 'Frame 11', kind: 'image', url: bg11 },
]

export let BACKGROUNDS: Background[] = [...BUILTIN_BACKGROUNDS]

const BG_IMG_CACHE = new Map<string, HTMLImageElement>()

export function getBgImage(url?: string): HTMLImageElement | null {
  if (!url) return null
  let img = BG_IMG_CACHE.get(url)
  if (!img) {
    img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = url
    BG_IMG_CACHE.set(url, img)
  }
  return img
}

export async function reloadBackgrounds(includeHidden = false): Promise<Background[]> {
  try {
    const [customBgs, hiddenAssets] = await Promise.all([
      getCustomBackgrounds(),
      getHiddenAssets(),
    ])
    const hiddenSet = new Set(hiddenAssets.backgrounds || [])
    const mappedCustom: Background[] = customBgs.map((c: CustomBackground) => ({
      id: c.id,
      label: c.label,
      kind: 'image',
      url: c.url,
      isCustom: true,
      _img: getBgImage(c.url) || undefined,
    }))

    const all = [...BUILTIN_BACKGROUNDS, ...mappedCustom].map((b) => {
      if (b.url) {
        b._img = getBgImage(b.url) || undefined
      }
      return {
        ...b,
        isHidden: hiddenSet.has(b.id),
      }
    })

    BACKGROUNDS = includeHidden ? all : all.filter((b) => b.id === 'none' || !b.isHidden)
  } catch {
    BACKGROUNDS = [...BUILTIN_BACKGROUNDS]
  }
  return BACKGROUNDS
}

export function preloadBackgrounds() {
  reloadBackgrounds().then((bgs) => {
    bgs.forEach((b) => {
      if (b.url) {
        getBgImage(b.url)
      }
    })
  })
}

/* ---------------- Ultra High-Resolution 300 DPI Canvas Rendering ---------------- */
export type ComposeOpts = {
  frames: HTMLCanvasElement[]
  template: Template
  filter: FilterId
  background: Background
  frameColor: string
  stickers: PlacedSticker[]
  logo?: LogoLang | null
  customText?: string
  textColor?: string
  fontStyle?: string
}

// 300 DPI Ultra Sharp Super-Sampled Dimensions
const CELL_W = 1040
const CELL_H = 780 // Exact 4:3 Landscape Ratio (1040 / 780 = 1.333)
const PAD_X = 60 // Polaroid side whitespace
const PAD_TOP = 60 // Polaroid top whitespace
const GAP = 36 // Polaroid photo gap
const FOOT = 192 // Iconic polaroid bottom chin

export function stripSize(t: Template) {
  const width = PAD_X * 2 + t.cols * CELL_W + (t.cols - 1) * GAP
  const height = PAD_TOP + t.rows * CELL_H + (t.rows - 1) * GAP + FOOT
  return { width, height }
}

export function renderStripToCanvas(canvas: HTMLCanvasElement, opts: ComposeOpts): void {
  const { frames, template, filter, background, frameColor, stickers, logo, customText, textColor, fontStyle } = opts
  const { width, height } = stripSize(template)

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }

  const ctx = canvas.getContext('2d', { alpha: false })!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  // ---- frame background (clean white polaroid / solid color / image) ----
  ctx.fillStyle = frameColor
  ctx.fillRect(0, 0, width, height)

  // Authentic paper canvas mesh texture
  if (frameTextureImg.complete && frameTextureImg.naturalWidth) {
    const pat = ctx.createPattern(frameTextureImg, 'repeat')
    if (pat) {
      ctx.save()
      ctx.fillStyle = pat
      ctx.globalAlpha = 0.95
      ctx.fillRect(0, 0, width, height)
      ctx.restore()
    }
  }

  // Draw frame / pattern background
  if (background.kind === 'image' && background.url) {
    const bgImg = getBgImage(background.url)
    if (bgImg && bgImg.complete && bgImg.naturalWidth) {
      drawCover(ctx, bgImg, 0, 0, width, height)
    }
  }

  // ---- photos (borderless, polaroid whitespace margins, exact 4:3 landscape) ----
  frames.forEach((frame, i) => {
    const c = i % template.cols
    const r = Math.floor(i / template.cols)
    const x = PAD_X + c * (CELL_W + GAP)
    const y = PAD_TOP + r * (CELL_H + GAP)
    drawPhoto(ctx, frame, x, y, CELL_W, CELL_H, filter)
  })

  // ---- stickers (normalized to whole canvas) ----
  stickers.forEach((s) => {
    const im = stickerImage(s.src)
    if (!im || !im.complete || !im.naturalWidth) return
    const base = 260 * s.scale
    const sw = base
    const sh = base * (im.naturalHeight / im.naturalWidth)
    ctx.save()
    ctx.translate(s.x * width, s.y * height)
    ctx.rotate((s.rotation * Math.PI) / 180)
    ctx.drawImage(im, -sw / 2, -sh / 2, sw, sh)
    ctx.restore()
  })

  // ---- footer text (optional: custom text, logo preset, or completely blank) ----
  const text = customText !== undefined ? customText : logo ? logoText(logo) : ''
  if (text && text.trim().length > 0) {
    const footY = height - FOOT
    const activeColor = textColor || (background.kind === 'image' ? '#ffffff' : '#5b7fcb')

    ctx.save()
    ctx.shadowColor = activeColor === '#ffffff' ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.8)'
    ctx.shadowBlur = 6
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 2

    ctx.fillStyle = activeColor
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const fontDef = FONT_OPTIONS.find((f) => f.id === fontStyle) || FONT_OPTIONS[0]
    ctx.font = `bold ${fontDef.size}px ${fontDef.family}`
    ctx.fillText(text.trim(), width / 2, footY + FOOT / 2)
    ctx.restore()
  }
}

export function composeStrip(opts: ComposeOpts): HTMLCanvasElement {
  const { template } = opts
  const { width, height } = stripSize(template)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  renderStripToCanvas(canvas, opts)
  return canvas
}

export async function composeStripAsync(opts: ComposeOpts): Promise<HTMLCanvasElement> {
  const { background, stickers } = opts
  const promises: Promise<any>[] = []

  if (background.kind === 'image' && background.url) {
    const bgImg = getBgImage(background.url)
    if (bgImg && !bgImg.complete) {
      promises.push(
        new Promise((resolve) => {
          bgImg.onload = resolve
          bgImg.onerror = resolve
        })
      )
    }
  }

  stickers.forEach((s) => {
    const im = stickerImage(s.src)
    if (im && !im.complete) {
      promises.push(
        new Promise((resolve) => {
          im.onload = resolve
          im.onerror = resolve
        })
      )
    }
  })

  if (promises.length > 0) {
    await Promise.all(promises)
  }

  return composeStrip(opts)
}

export function composePrintSheet(stripCanvas: HTMLCanvasElement, double2x6 = true): HTMLCanvasElement {
  const printCanvas = document.createElement('canvas')
  printCanvas.width = 1200
  printCanvas.height = 1800
  const ctx = printCanvas.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, 1200, 1800)

  const sw = stripCanvas.width
  const sh = stripCanvas.height

  if (sw < 1300) {
    // 1-column strip (2x6)
    const targetW = 560
    const targetH = Math.min(1720, (targetW / sw) * sh)
    const offsetY = Math.max(40, (1800 - targetH) / 2)

    if (double2x6) {
      ctx.drawImage(stripCanvas, 24, offsetY, targetW, targetH)
      ctx.drawImage(stripCanvas, 616, offsetY, targetW, targetH)
    } else {
      ctx.drawImage(stripCanvas, (1200 - targetW) / 2, offsetY, targetW, targetH)
    }
  } else {
    // 2-column grid (4x6)
    const targetW = 1120
    const targetH = Math.min(1720, (targetW / sw) * sh)
    const offsetY = Math.max(40, (1800 - targetH) / 2)
    ctx.drawImage(stripCanvas, (1200 - targetW) / 2, offsetY, targetW, targetH)
  }

  return printCanvas
}

function drawPhoto(
  ctx: CanvasRenderingContext2D,
  frame: HTMLCanvasElement,
  x: number, y: number, w: number, h: number,
  filter: FilterId,
) {
  ctx.save()
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  if (filter === 'pixelate') {
    const tmp = document.createElement('canvas')
    const scale = 0.08
    tmp.width = Math.max(1, Math.round(w * scale))
    tmp.height = Math.max(1, Math.round(h * scale))
    const tctx = tmp.getContext('2d')!
    tctx.drawImage(frame, 0, 0, tmp.width, tmp.height)
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(tmp, x, y, w, h)
    ctx.restore()
    return
  }

  ctx.filter = cssForFilter(filter)
  ctx.drawImage(frame, x, y, w, h)
  ctx.restore()
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number, y: number, w: number, h: number,
) {
  ctx.save()
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  const r = Math.max(w / img.width, h / img.height)
  const dw = img.width * r
  const dh = img.height * r
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
  ctx.restore()
}
