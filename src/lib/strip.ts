import { stickerImage, type PlacedSticker } from './stickers'

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
  { id: 'pixelate', label: 'Pixelate', css: 'contrast(1.05)' }, // handled specially on canvas
]

export const cssForFilter = (id: FilterId) =>
  FILTERS.find((f) => f.id === id)?.css ?? 'none'

/* ---------------- Layout templates (carousel on the Select screen) ---------------- */
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
  { id: 'grid4', label: '4x4', sub: '4 photo', cols: 2, rows: 2 },
  { id: 'grid8', label: '4x6', sub: '8 photo', cols: 2, rows: 4 },
]
export const countFor = (t: Template) => (t ? t.cols * t.rows : 0)

/* ---------------- Logo language (Translation buttons) ---------------- */
export type LogoLang = 'en' | 'zh' | 'ko' | 'ja'
export const LOGOS: { id: LogoLang; label: string; text: string }[] = [
  { id: 'en', label: 'OmoideCam', text: 'OmoideCam' },
  { id: 'zh', label: '思忆相机', text: '思忆相机' },
  { id: 'ko', label: '오모이드캠', text: '오모이드캠' },
  { id: 'ja', label: 'おもいでカメラ', text: 'おもいでカメラ' },
]
export const logoText = (id: LogoLang) => LOGOS.find((l) => l.id === id)?.text ?? 'OmoideCam'

/* ---------------- Backgrounds (frame): none + real image frames ---------------- */
export type BgKind = 'none' | 'image'
export type Background = {
  id: string
  kind: BgKind
  url?: string // image url (local imported asset)
  _img?: HTMLImageElement // preloaded image (filled at runtime)
}

// Preloads all image-backed backgrounds so composeStrip can draw them synchronously.
export function preloadBackgrounds() {
  BACKGROUNDS.forEach((b) => {
    if (b.kind === 'image' && b.url && !b._img) {
      const im = new Image()
      im.src = b.url
      b._img = im
    }
  })
}
export const BACKGROUNDS: Background[] = [
  { id: 'none', kind: 'none' },
  { id: 'bg1', kind: 'image', url: bg1 },
  { id: 'bg2', kind: 'image', url: bg2 },
  { id: 'bg3', kind: 'image', url: bg3 },
  { id: 'bg4', kind: 'image', url: bg4 },
  { id: 'bg5', kind: 'image', url: bg5 },
  { id: 'bg6', kind: 'image', url: bg6 },
  { id: 'bg7', kind: 'image', url: bg7 },
  { id: 'bg8', kind: 'image', url: bg8 },
  { id: 'bg9', kind: 'image', url: bg9 },
  { id: 'bg10', kind: 'image', url: bg10 },
  { id: 'bg11', kind: 'image', url: bg11 },
]

/* Frame background can also just be a flat color (kept for the color swatches). */
export const FRAME_COLORS = ['#ffffff', '#ffe3ec', '#dbe8f5', '#e7f0dc', '#efe6f7', '#fff4d6']

/* ---------------- Compositor ---------------- */
type ComposeOpts = {
  frames: HTMLCanvasElement[]
  template: Template
  filter: FilterId
  background: Background
  frameColor: string
  stickers: PlacedSticker[]
  logo: LogoLang
}

const CELL_W = 520
const CELL_H = 390
const PAD = 30
const GAP = 14
const FOOT = 80

export function stripSize(t: Template) {
  const width = PAD * 2 + t.cols * CELL_W + (t.cols - 1) * GAP
  const height = PAD + t.rows * CELL_H + (t.rows - 1) * GAP + FOOT
  return { width, height }
}

export function composeStrip(opts: ComposeOpts): HTMLCanvasElement {
  const { frames, template, filter, background, frameColor, stickers, logo } = opts
  const { width, height } = stripSize(template)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!

  // ---- frame background ----
  ctx.fillStyle = frameColor
  ctx.fillRect(0, 0, width, height)
  if (background.kind === 'image' && background._img && background._img.complete && background._img.naturalWidth) {
    drawCover(ctx, background._img, 0, 0, width, height)
  }

  // ---- photos ----
  frames.forEach((frame, i) => {
    const c = i % template.cols
    const r = Math.floor(i / template.cols)
    const x = PAD + c * (CELL_W + GAP)
    const y = PAD + r * (CELL_H + GAP)
    drawPhoto(ctx, frame, x, y, CELL_W, CELL_H, filter)
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'
    ctx.lineWidth = 2
    ctx.strokeRect(x, y, CELL_W, CELL_H)
  })

  // ---- stickers (normalized to whole canvas) ----
  stickers.forEach((s) => {
    const im = stickerImage(s.src)
    if (!im || !im.complete || !im.naturalWidth) return
    const base = 130 * s.scale
    const sw = base
    const sh = base * (im.naturalHeight / im.naturalWidth)
    ctx.save()
    ctx.translate(s.x * width, s.y * height)
    ctx.rotate((s.rotation * Math.PI) / 180)
    ctx.drawImage(im, -sw / 2, -sh / 2, sw, sh)
    ctx.restore()
  })

  // ---- footer logo ----
  const footY = height - FOOT
  ctx.fillStyle = readableOn(frameColor, background)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `28px "${logo === 'en' ? 'Press Start 2P' : 'Noto Sans JP'}", monospace`
  ctx.fillText(logoText(logo), width / 2, footY + FOOT / 2)

  return canvas
}

function drawPhoto(
  ctx: CanvasRenderingContext2D,
  frame: HTMLCanvasElement,
  x: number, y: number, w: number, h: number,
  filter: FilterId,
) {
  if (filter === 'pixelate') {
    const tmp = document.createElement('canvas')
    const scale = 0.06
    tmp.width = Math.max(1, Math.round(w * scale))
    tmp.height = Math.max(1, Math.round(h * scale))
    const tctx = tmp.getContext('2d')!
    tctx.drawImage(frame, 0, 0, tmp.width, tmp.height)
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(tmp, x, y, w, h)
    ctx.imageSmoothingEnabled = true
    return
  }
  ctx.filter = cssForFilter(filter)
  ctx.drawImage(frame, x, y, w, h)
  ctx.filter = 'none'
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number, y: number, w: number, h: number,
) {
  const r = Math.max(w / img.width, h / img.height)
  const dw = img.width * r
  const dh = img.height * r
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
}

function readableOn(_color: string, bg: Background) {
  if (bg.kind === 'image') return '#ffffff'
  return '#5b6fbc'
}
