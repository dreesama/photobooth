import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import QRCode from 'qrcode'
import {
  BACKGROUNDS,
  FILTERS,
  LOGOS,
  TEXT_COLORS,
  preloadBackgrounds,
  composeStrip,
  stripSize,
  type Background,
  type FilterId,
  type LogoLang,
  type Template,
} from '../../lib/strip'
import { STICKERS, loadStickers, type PlacedSticker } from '../../lib/stickers'
import { saveToArchive, saveActiveSessionState, getActiveSessionState } from '../../lib/db'
import { uploadPhotoStrip } from '../../lib/upload'

type Props = {
  frames: HTMLCanvasElement[]
  template: Template
  onRetake: () => void
}

export default function Editor({ frames, template, onRetake }: Props) {
  const [filter, setFilter] = useState<FilterId>('original')
  const [bg, setBg] = useState<Background>(BACKGROUNDS[0])
  const [frameColor] = useState('#ffffff')
  const [logo, setLogo] = useState<LogoLang>('en')
  const [customText, setCustomText] = useState<string>('IT GUILD')
  const [textColor, setTextColor] = useState<string>('#5b7fcb')
  const [stickers, setStickers] = useState<PlacedSticker[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [ready, setReady] = useState(0)

  // QR Modal State
  const [showShare, setShowShare] = useState(false)
  const [qrLoading, setQrLoading] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [hostedUrl, setHostedUrl] = useState<string>('')
  const [qrError, setQrError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const stageRef = useRef<HTMLDivElement | null>(null)
  const drag = useRef<{ uid: string } | null>(null)

  useEffect(() => {
    preloadBackgrounds()
    loadStickers()
    BACKGROUNDS.forEach((b) => {
      if (b._img && !b._img.complete) b._img.onload = () => setReady((r) => r + 1)
    })

    // Restore customization states if session exists
    async function restoreActiveCustomizations() {
      const saved = await getActiveSessionState()
      if (saved) {
        if (saved.filter) setFilter(saved.filter as FilterId)
        if (saved.customText !== undefined) setCustomText(saved.customText)
        if (saved.textColor) setTextColor(saved.textColor)
        if (saved.stickers && Array.isArray(saved.stickers)) setStickers(saved.stickers)
        if (saved.backgroundId) {
          const matchingBg = BACKGROUNDS.find((b) => b.id === saved.backgroundId)
          if (matchingBg) setBg(matchingBg)
        }
      }
    }
    restoreActiveCustomizations()
  }, [])

  // Persist customization edits into active session
  useEffect(() => {
    if (frames.length > 0 && template) {
      saveActiveSessionState({
        step: 'edit',
        templateId: template.id,
        rawFrames: frames.map((f) => f.toDataURL('image/png')),
        filter,
        backgroundId: bg.id,
        customText,
        textColor,
        stickers,
        updatedAt: Date.now(),
      }).catch(() => {})
    }
  }, [frames, template, filter, bg, customText, textColor, stickers])

  const { width, height } = stripSize(template)

  const baseUrl = useMemo(
    () =>
      composeStrip({ frames, template, filter, background: bg, frameColor, stickers: [], logo, customText, textColor })
        .toDataURL('image/png'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [frames, template, filter, bg, frameColor, logo, customText, textColor, ready]
  )

  const toggleSticker = (src: string) => {
    const existing = stickers.find((s) => s.src === src)
    if (existing) {
      setStickers((list) => list.filter((s) => s.src !== src))
      if (selected === existing.uid) setSelected(null)
    } else {
      const uid = `st_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      const next: PlacedSticker = {
        uid,
        src,
        x: 0.5,
        y: 0.5,
        scale: 1,
        rotation: 0,
      }
      setStickers((list) => [...list, next])
      setSelected(uid)
    }
  }

  const onStickerDown = (uid: string) => (e: PointerEvent) => {
    e.stopPropagation()
    setSelected(uid)
    drag.current = { uid }
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    } catch {}
  }

  const onStageMove = (e: PointerEvent) => {
    const dragging = drag.current
    if (!dragging || !stageRef.current) return
    const currentUid = dragging.uid
    const r = stageRef.current.getBoundingClientRect()
    if (!r.width || !r.height) return
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
    setStickers((l) => l.map((s) => (s.uid === currentUid ? { ...s, x, y } : s)))
  }

  // Handle Delete/Backspace to delete selected sticker
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
        if (
          document.activeElement?.tagName === 'INPUT' ||
          document.activeElement?.tagName === 'TEXTAREA'
        ) {
          return
        }
        setStickers((l) => l.filter((s) => s.uid !== selected))
        setSelected(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selected])

  const download = async () => {
    const c = composeStrip({ frames, template, filter, background: bg, frameColor, stickers, logo, customText, textColor })
    const stripDataUrl = c.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = stripDataUrl
    a.download = `itguild-${Date.now()}.png`
    a.click()

    try {
      const rawFrames = frames.map((f) => f.toDataURL('image/png'))
      await saveToArchive({
        stripDataUrl,
        rawFrames,
        templateId: template.id,
        filter,
        backgroundId: bg.id,
      })
    } catch (e) {
      console.warn('Archive save error:', e)
    }
  }

  // Handle QR Modal Open & Instant Upload
  const handleOpenQR = async () => {
    setShowShare(true)
    setQrLoading(true)
    setQrDataUrl('')
    setHostedUrl('')
    setQrError(null)

    try {
      const c = composeStrip({ frames, template, filter, background: bg, frameColor, stickers, logo, customText, textColor })
      const stripDataUrl = c.toDataURL('image/png')

      const directUrl = await uploadPhotoStrip(stripDataUrl)
      setHostedUrl(directUrl)

      // Generate QR Code strictly for the public hosted image link
      const qrCodeUrl = await QRCode.toDataURL(directUrl, {
        margin: 1,
        width: 260,
        color: { dark: '#1e293b', light: '#ffffff' },
      })
      setQrDataUrl(qrCodeUrl)
    } catch (err: any) {
      console.warn('QR generation error:', err)
      setQrError('Could not connect to image server. Please check your internet connection or save directly.')
    } finally {
      setQrLoading(false)
    }
  }

  // Auto-save on initial mount
  const hasSavedRef = useRef(false)
  useEffect(() => {
    if (frames.length > 0 && !hasSavedRef.current) {
      hasSavedRef.current = true
      const c = composeStrip({ frames, template, filter, background: bg, frameColor, stickers, logo, customText, textColor })
      const stripDataUrl = c.toDataURL('image/png')
      const rawFrames = frames.map((f) => f.toDataURL('image/png'))
      saveToArchive({
        stripDataUrl,
        rawFrames,
        templateId: template.id,
        filter,
        backgroundId: bg.id,
      }).catch(() => {})
    }
  }, [frames, template, filter, bg, frameColor, logo, customText, textColor, stickers])

  const copyLink = () => {
    navigator.clipboard?.writeText(hostedUrl || window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="w-full min-h-screen grid grid-cols-1 lg:grid-cols-[40%_60%] xl:grid-cols-[42%_58%] items-stretch">
      {/* ================= LEFT HALF: Preview Title + Photo Strip + Download/QR ================= */}
      <div className="flex flex-col justify-between p-6 sm:p-10 lg:p-12 min-h-screen relative">
        {/* Top Header: Preview */}
        <div className="w-full flex items-center justify-between">
          <h2
            className="font-pixel text-[#5b7fcb] text-3xl sm:text-4xl tracking-wider select-none"
            style={{
              textShadow: '0 3px 0 #9cb6ec, 0 6px 14px rgba(91,127,203,0.3)',
            }}
          >
            Preview
          </h2>
          <button
            onClick={onRetake}
            className="font-pixel text-[10px] sm:text-xs text-[#8792c4] hover:text-[#5b7fcb] underline select-none cursor-pointer"
          >
            ↺ Retake
          </button>
        </div>

        {/* Center: Photo Strip Canvas */}
        <div className="my-auto py-6 flex items-center justify-center">
          <div
            ref={stageRef}
            className="relative bg-white shadow-[0_12px_36px_rgba(90,110,185,0.25)] rounded-xs overflow-hidden select-none"
            style={{
              width: template.cols === 2 ? 'clamp(200px, 24vw, 300px)' : 'clamp(145px, 16vw, 210px)',
              aspectRatio: `${width} / ${height}`,
            }}
            onPointerMove={onStageMove}
            onPointerUp={() => (drag.current = null)}
            onPointerCancel={() => (drag.current = null)}
            onPointerDown={() => setSelected(null)}
          >
            <img
              src={baseUrl}
              alt="Your photo strip"
              className="w-full h-full block pointer-events-none"
            />

            {stickers.map((s) => (
              <button
                key={s.uid}
                onPointerDown={onStickerDown(s.uid)}
                onPointerMove={onStageMove}
                onPointerUp={() => (drag.current = null)}
                onPointerCancel={() => (drag.current = null)}
                className={`absolute leading-none touch-none cursor-move ${
                  selected === s.uid ? 'outline outline-2 outline-dashed outline-[#8198ed]' : ''
                }`}
                style={{
                  left: `${s.x * 100}%`,
                  top: `${s.y * 100}%`,
                  transform: `translate(-50%,-50%) rotate(${s.rotation}deg)`,
                  width: `${s.scale * 36}px`,
                }}
              >
                <img
                  src={s.src}
                  alt=""
                  className="w-full h-full object-contain pointer-events-none select-none"
                />
              </button>
            ))}
          </div>
        </div>

        {/* Bottom Bar: Download & QR */}
        <div className="flex items-center gap-3 w-full max-w-[340px]">
          {/* Download Button with outer white container card */}
          <div className="flex-1 p-1 bg-white rounded-xl shadow-[0_4px_12px_rgba(100,120,190,0.18)]">
            <button
              type="button"
              onClick={download}
              className="w-full bg-[#8198ed] hover:bg-[#6e88e8] active:translate-y-0.5 text-white py-3 rounded-lg font-pixel text-xs sm:text-sm tracking-wider shadow-[3px_3px_0px_#5b6fbc] transition-all cursor-pointer select-none text-center"
            >
              Download
            </button>
          </div>

          {/* QR Button with outer white container card */}
          <div className="p-1 bg-white rounded-xl shadow-[0_4px_12px_rgba(100,120,190,0.18)]">
            <button
              type="button"
              onClick={handleOpenQR}
              className="bg-[#8198ed] hover:bg-[#6e88e8] active:translate-y-0.5 text-white px-5 py-3 rounded-lg font-pixel text-xs sm:text-sm tracking-wider shadow-[3px_3px_0px_#5b6fbc] transition-all cursor-pointer select-none"
            >
              QR
            </button>
          </div>
        </div>
      </div>

      {/* ================= RIGHT HALF: Full Height Customization Panel ================= */}
      <div className="bg-[#efefff] min-h-screen px-6 sm:px-10 lg:px-14 py-8 sm:py-10 overflow-y-auto space-y-8 shadow-2xl flex flex-col justify-start">
        {/* ---- 1. Filters ---- */}
        <section>
          <h3 className="font-pixel text-[#5b7fcb] text-xl sm:text-2xl tracking-wider mb-4 select-none">
            Filters
          </h3>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2.5 sm:gap-3">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className="flex flex-col items-center group cursor-pointer text-left"
              >
                <div
                  className={`relative w-full aspect-square overflow-hidden bg-[#1e2337] rounded-lg transition-all ${
                    filter === f.id
                      ? 'ring-3 ring-[#8198ed] shadow-md scale-105'
                      : 'hover:scale-105 opacity-90 hover:opacity-100'
                  }`}
                >
                  {frames[0] && (
                    <img
                      src={frames[0].toDataURL()}
                      alt=""
                      className="w-full h-full object-cover"
                      style={{ filter: f.id === 'pixelate' ? 'contrast(1.05)' : f.css }}
                    />
                  )}
                  {filter === f.id && (
                    <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#5b7fcb] text-white grid place-items-center text-[9px] font-bold shadow">
                      ✓
                    </span>
                  )}
                </div>
                <p className="font-pixel text-[6px] sm:text-[7px] text-[#5b7fcb] text-center mt-1.5 truncate w-full group-hover:text-[#4162b8]">
                  {f.label}
                </p>
              </button>
            ))}
          </div>
        </section>

        {/* ---- 2. Background ---- */}
        <section>
          <h3 className="font-pixel text-[#5b7fcb] text-xl sm:text-2xl tracking-wider mb-4 select-none">
            Background
          </h3>
          <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-thin">
            {/* None Option */}
            <button
              onClick={() => setBg(BACKGROUNDS[0])}
              className={`shrink-0 size-20 sm:size-24 rounded-xl bg-[#ffe5ec] border-2 border-[#ffb3c6] flex items-center justify-center transition-all cursor-pointer ${
                bg.id === 'none' ? 'ring-3 ring-[#ff80a0] shadow-md scale-105' : 'hover:scale-105'
              }`}
            >
              <span className="text-[#ff5c8a] text-2xl font-bold font-mono">✕</span>
            </button>

            {/* Pattern/Frame image backgrounds */}
            {BACKGROUNDS.filter((b) => b.kind === 'image' && b.url).map((b) => (
              <button
                key={b.id}
                onClick={() => setBg(b)}
                className={`shrink-0 size-20 sm:size-24 rounded-xl overflow-hidden border-2 bg-white transition-all cursor-pointer ${
                  bg.id === b.id
                    ? 'border-[#8198ed] ring-3 ring-[#8198ed]/50 shadow-md scale-105'
                    : 'border-[#cdd6f0] hover:scale-105'
                }`}
              >
                <img src={b.url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </section>

        {/* ---- 3. Stickers ---- */}
        <section>
          <h3 className="font-pixel text-[#5b7fcb] text-xl sm:text-2xl tracking-wider mb-4 select-none">
            Stickers
          </h3>
          <div className="grid grid-cols-5 gap-3 sm:gap-4 max-w-[620px]">
            {/* Clear All Stickers Button */}
            <button
              onClick={() => setStickers([])}
              className="size-20 sm:size-24 rounded-xl bg-[#ffe5ec] border-2 border-[#ffb3c6] flex items-center justify-center transition-all cursor-pointer hover:scale-105"
              title="Clear all stickers"
            >
              <span className="text-[#ff5c8a] text-2xl font-bold font-mono">✕</span>
            </button>

            {/* Stickers List */}
            {STICKERS.map((s) => {
              const isPlaced = stickers.some((st) => st.src === s.src)
              return (
                <button
                  key={s.id}
                  onClick={() => toggleSticker(s.src)}
                  className={`size-20 sm:size-24 rounded-xl bg-[#e8eeff] hover:bg-white border-2 flex items-center justify-center p-3 transition-all cursor-pointer ${
                    isPlaced
                      ? 'border-[#8198ed] ring-3 ring-[#8198ed]/50 shadow-md scale-105'
                      : 'border-transparent hover:border-[#8198ed] hover:scale-105'
                  }`}
                >
                  <img
                    src={s.src}
                    alt={s.label}
                    className="max-h-full max-w-full object-contain pointer-events-none"
                  />
                </button>
              )
            })}
          </div>
        </section>

        {/* ---- 4. Translation & Custom Text ---- */}
        <section>
          <h3 className="font-pixel text-[#5b7fcb] text-xl sm:text-2xl tracking-wider mb-4 select-none">
            Translation & Text
          </h3>
          <div className="flex flex-col gap-3.5 max-w-[560px]">
            {/* Custom Text Input Bar */}
            <div className="flex gap-2 w-full">
              <input
                type="text"
                placeholder="Write custom text (or leave blank)..."
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                className="flex-1 bg-white border border-[#cdd6f0] focus:border-[#8198ed] focus:ring-2 focus:ring-[#8198ed]/30 px-3.5 py-2.5 rounded-xl font-mono text-xs text-[#334155] outline-none shadow-xs"
              />
              <button
                type="button"
                onClick={() => setCustomText('')}
                className="btn95 !px-3 !py-2 text-[10px] font-bold text-[#ff5c8a] shrink-0"
                title="Clear text (Blank Polaroid)"
              >
                ✕ Blank
              </button>
            </div>

            {/* Text Color Swatches */}
            <div className="flex flex-col gap-1.5">
              <span className="font-pixel text-[9px] text-[#5b7fcb] tracking-wider">Text Color:</span>
              <div className="flex items-center gap-2 flex-wrap">
                {TEXT_COLORS.map((tc) => (
                  <button
                    key={tc.id}
                    onClick={() => setTextColor(tc.color)}
                    title={tc.label}
                    className={`size-7 sm:size-8 rounded-full border-2 transition-transform cursor-pointer shadow-xs ${
                      textColor.toLowerCase() === tc.color.toLowerCase()
                        ? 'border-[#5b7fcb] scale-110 ring-2 ring-[#8198ed]'
                        : 'border-slate-300 hover:scale-105'
                    }`}
                    style={{ backgroundColor: tc.color }}
                  />
                ))}
                {/* Custom Color Input */}
                <label
                  title="Custom Color"
                  className="size-7 sm:size-8 rounded-full border-2 border-dashed border-[#8198ed] grid place-items-center cursor-pointer hover:scale-105 bg-white shadow-xs text-xs overflow-hidden"
                >
                  <span className="text-[10px]">🎨</span>
                  <input
                    type="color"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="opacity-0 absolute size-0"
                  />
                </label>
              </div>
            </div>

            {/* Language / Logo Quick Presets */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              {LOGOS.map((l) => (
                <button
                  key={l.id}
                  onClick={() => {
                    setLogo(l.id)
                    setCustomText(l.text)
                  }}
                  className={`py-3 px-3 rounded-xl font-pixel text-xs tracking-wider transition-all cursor-pointer shadow-md select-none text-center truncate ${
                    customText === l.text
                      ? 'bg-[#8198ed] text-white shadow-[0_3px_0_#5b6fbc]'
                      : 'bg-[#b3c1ff] text-white hover:bg-[#a1b2ff] shadow-[0_3px_0_#8198ed]'
                  }`}
                >
                  {l.text}
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* ================= Scan to Download Modal ================= */}
      {showShare && (
        <div className="fixed inset-0 z-50 bg-black/35 backdrop-blur-[2px] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 sm:p-9 shadow-2xl max-w-sm sm:max-w-md w-full flex flex-col items-center text-center relative border border-slate-100">
            {/* Close Button */}
            <button
              onClick={() => setShowShare(false)}
              className="absolute top-4 right-4 size-8 rounded-lg bg-[#e8eeff] hover:bg-[#d8e4ff] text-[#5b7fcb] font-bold text-sm flex items-center justify-center cursor-pointer transition-colors"
            >
              ✕
            </button>

            {/* Title */}
            <h3 className="font-pixel text-[#5b7fcb] text-sm sm:text-base tracking-wider mb-6 mt-1 select-none">
              Scan to Download
            </h3>

            {/* QR Content / Spinner */}
            {qrLoading ? (
              <div className="flex flex-col items-center justify-center my-10 py-6">
                <div className="w-12 h-12 border-4 border-[#8198ed]/30 border-t-[#8198ed] rounded-full animate-spin mb-4"></div>
                <p className="font-pixel text-[10px] text-[#8792c4] tracking-wider animate-pulse">
                  Uploading softcopy...
                </p>
              </div>
            ) : qrDataUrl ? (
              <div className="flex flex-col items-center w-full">
                <div className="p-3 bg-white rounded-2xl shadow-inner border border-[#dce3f8] mb-4">
                  <img
                    src={qrDataUrl}
                    alt="QR Code"
                    className="size-48 sm:size-56 object-contain rounded-lg"
                  />
                </div>
                <p className="font-pixel text-[10px] sm:text-xs text-[#5b7fcb] mb-4 tracking-wider select-none">
                  Scan with your phone camera to save!
                </p>

                {/* Direct Action Buttons */}
                <div className="flex flex-col gap-2 w-full pt-1">
                  {hostedUrl ? (
                    <div className="flex gap-1.5 w-full">
                      <input
                        readOnly
                        value={hostedUrl}
                        className="flex-1 bg-[#f8fafc] border border-slate-200 px-3 py-2 font-mono text-[10px] outline-none truncate rounded-lg text-slate-600 select-all"
                      />
                      <button
                        className="btn95 is-primary !px-3 !py-2 text-[10px] font-bold"
                        onClick={copyLink}
                      >
                        {copied ? '✓ Copied' : 'Copy'}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={download}
                      className="btn95 is-primary !px-4 !py-2.5 text-xs font-bold w-full"
                    >
                      💾 Download High-Res PNG
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="my-6 flex flex-col items-center gap-3">
                <p className="text-[#5b7fcb] font-pixel text-[10px]">Ready to save your photos!</p>
                <button
                  type="button"
                  onClick={download}
                  className="btn95 is-primary !px-5 !py-2.5 text-xs font-bold"
                >
                  💾 Save to Device
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
