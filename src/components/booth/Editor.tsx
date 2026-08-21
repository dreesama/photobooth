import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import QRCode from 'qrcode'
import {
  Download,
  QrCode,
  Ban,
  Trash2,
  Check,
  Copy,
  X,
  ExternalLink,
  RotateCcw,
  Palette,
} from 'lucide-react'
import {
  BACKGROUNDS,
  FILTERS,
  LOGOS,
  TEXT_COLORS,
  preloadBackgrounds,
  reloadBackgrounds,
  composeStrip,
  composeStripAsync,
  renderStripToCanvas,
  getBgImage,
  stripSize,
  FONT_OPTIONS,
  type Background,
  type FilterId,
  type LogoLang,
  type Template,
  type FontOption,
} from '../../lib/strip'
import { STICKERS, loadStickers, type PlacedSticker, type StickerDef } from '../../lib/stickers'
import { saveToArchive, saveActiveSessionState, getActiveSessionState } from '../../lib/db'
import { uploadPhotoStrip } from '../../lib/upload'

type Props = {
  frames: HTMLCanvasElement[]
  template: Template
  onRetake: () => void
  onDone: () => void
}

export default function Editor({ frames, template, onRetake, onDone }: Props) {
  const [filter, setFilter] = useState<FilterId>('original')
  const [bg, setBg] = useState<Background>(BACKGROUNDS[0])
  const [frameColor] = useState('#ffffff')
  const [logo, setLogo] = useState<LogoLang>('en')
  const [customText, setCustomText] = useState<string>('IT GUILD')
  const [textColor, setTextColor] = useState<string>('#5b7fcb')
  const [fontStyle, setFontStyle] = useState<string>('pixel')
  const [stickers, setStickers] = useState<PlacedSticker[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [ready, setReady] = useState(0)

  // Unique session ID for persistent archive entry
  const archiveSessionIdRef = useRef<string>(
    `session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  )

  // QR Modal State
  const [showShare, setShowShare] = useState(false)
  const [qrLoading, setQrLoading] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [hostedUrl, setHostedUrl] = useState<string>('')
  const [qrError, setQrError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const [bgsList, setBgsList] = useState<Background[]>(BACKGROUNDS)
  const [stickersList, setStickersList] = useState<StickerDef[]>(STICKERS)

  const stageRef = useRef<HTMLDivElement | null>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const drag = useRef<{ uid: string } | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const archiveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cached first frame thumbnail for instant filter previews (zero lag)
  const firstFrameThumb = useMemo(() => {
    return frames[0] ? frames[0].toDataURL('image/jpeg', 0.75) : ''
  }, [frames])

  // Raw frames base64 computed once per capture session, never during sticker drag
  const rawFramesDataUrls = useMemo(() => {
    return frames.map((f) => f.toDataURL('image/jpeg', 0.85))
  }, [frames])

  useEffect(() => {
    reloadBackgrounds(false).then((loadedBgs) => {
      setBgsList(loadedBgs)
      loadedBgs.forEach((b) => {
        if (b.url) {
          const img = getBgImage(b.url)
          if (img && !img.complete) {
            img.onload = () => setReady((r) => r + 1)
          }
        }
      })
    })

    loadStickers(false).then((loadedStickers) => {
      setStickersList(loadedStickers)
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
          if (matchingBg) handleSelectBg(matchingBg)
        }
      }
    }
    restoreActiveCustomizations()
  }, [])

  // Fast direct GPU canvas render on the preview stage
  useEffect(() => {
    if (!previewCanvasRef.current || frames.length === 0 || !template) return
    renderStripToCanvas(previewCanvasRef.current, {
      frames,
      template,
      filter,
      background: bg,
      frameColor,
      stickers: [],
      logo,
      customText,
      textColor,
      fontStyle,
    })
  }, [frames, template, filter, bg, frameColor, logo, customText, textColor, fontStyle, ready])

  // Debounced persistence: saves customization state without blocking UI during dragging
  useEffect(() => {
    if (frames.length > 0 && template) {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        saveActiveSessionState({
          step: 'edit',
          templateId: template.id,
          rawFrames: rawFramesDataUrls,
          filter,
          backgroundId: bg.id,
          customText,
          textColor,
          stickers,
          updatedAt: Date.now(),
        }).catch(() => {})
      }, 500)
    }
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [frames, template, rawFramesDataUrls, filter, bg.id, customText, textColor, stickers])

  // Continuous background auto-sync to Archive: ensures latest background, filter, text, and stickers are saved
  useEffect(() => {
    if (frames.length === 0 || !template) return

    if (archiveTimerRef.current) clearTimeout(archiveTimerRef.current)
    archiveTimerRef.current = setTimeout(async () => {
      try {
        const c = await composeStripAsync({
          frames,
          template,
          filter,
          background: bg,
          frameColor,
          stickers,
          logo,
          customText,
          textColor,
          fontStyle,
        })
        const stripDataUrl = c.toDataURL('image/png')
        await saveToArchive({
          id: archiveSessionIdRef.current,
          stripDataUrl,
          rawFrames: rawFramesDataUrls,
          templateId: template.id,
          filter,
          backgroundId: bg.id,
          stickers,
          customText,
          textColor,
        })
      } catch (e) {
        console.warn('Archive auto-sync error:', e)
      }
    }, 600)

    return () => {
      if (archiveTimerRef.current) clearTimeout(archiveTimerRef.current)
    }
  }, [frames, template, rawFramesDataUrls, filter, bg, frameColor, stickers, logo, customText, textColor, fontStyle, ready])

  const { width, height } = stripSize(template)

  const handleSelectBg = (selectedBg: Background) => {
    setBg(selectedBg)
    if (selectedBg.url) {
      const img = getBgImage(selectedBg.url)
      if (img && !img.complete) {
        img.onload = () => setReady((r) => r + 1)
      } else {
        setReady((r) => r + 1)
      }
    } else {
      setReady((r) => r + 1)
    }
  }

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
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
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

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    animFrameRef.current = requestAnimationFrame(() => {
      setStickers((l) => l.map((s) => (s.uid === currentUid ? { ...s, x, y } : s)))
    })
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
    try {
      const c = await composeStripAsync({
        frames,
        template,
        filter,
        background: bg,
        frameColor,
        stickers,
        logo: null,
        customText,
        textColor,
        fontStyle,
      })
      const stripDataUrl = c.toDataURL('image/png')

      // Save to local archive
      await saveToArchive({
        id: archiveSessionIdRef.current,
        stripDataUrl,
        rawFrames: rawFramesDataUrls,
        templateId: template.id,
        filter,
        backgroundId: bg.id,
        stickers,
        customText,
        textColor,
      }).catch(() => {})

      // Universal Reliable Blob Download
      c.toBlob((blob) => {
        if (!blob) {
          const a = document.createElement('a')
          a.href = stripDataUrl
          a.download = `itguild-${Date.now()}.png`
          document.body.appendChild(a)
          a.click()
          setTimeout(() => document.body.removeChild(a), 500)
          return
        }
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.style.display = 'none'
        a.href = url
        a.download = `itguild-${Date.now()}.png`
        document.body.appendChild(a)
        a.click()
        setTimeout(() => {
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
        }, 1500)
      }, 'image/png')
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
      const c = await composeStripAsync({ frames, template, filter, background: bg, frameColor, stickers, logo: null, customText, textColor, fontStyle })
      const stripDataUrl = c.toDataURL('image/png')

      // Save latest customized photo strip with all backgrounds, stickers, and filters to Archive
      await saveToArchive({
        id: archiveSessionIdRef.current,
        stripDataUrl,
        rawFrames: rawFramesDataUrls,
        templateId: template.id,
        filter,
        backgroundId: bg.id,
        stickers,
        customText,
        textColor,
      }).catch(() => {})

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

  const copyLink = () => {
    navigator.clipboard?.writeText(hostedUrl || window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="w-full h-screen max-h-screen overflow-hidden grid grid-cols-1 lg:grid-cols-[45%_55%] xl:grid-cols-[46%_54%] select-none">
      {/* ================= LEFT HALF: Preview Title + Photo Strip + Download/QR/Done ================= */}
      <div className="flex flex-col justify-between p-4 sm:p-5 lg:p-6 h-full max-h-screen overflow-hidden min-h-0 relative">
        {/* Top Header: Preview */}
        <div className="w-full flex items-center justify-between shrink-0">
          <h2
            className="font-pixel text-[#5b7fcb] text-2xl sm:text-3xl tracking-wider select-none"
            style={{
              textShadow: '0 3px 0 #9cb6ec, 0 6px 14px rgba(91,127,203,0.3)',
            }}
          >
            Preview
          </h2>
          <button
            onClick={onRetake}
            className="font-pixel text-[10px] sm:text-xs text-[#8792c4] hover:text-[#5b7fcb] underline select-none cursor-pointer flex items-center gap-1.5 bg-white/80 hover:bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-xs transition-all"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Retake</span>
          </button>
        </div>

        {/* Center: Large High-Visibility Photo Strip Canvas */}
        <div className="my-auto flex-1 min-h-0 flex items-center justify-center py-2 sm:py-3 overflow-hidden">
          <div
            ref={stageRef}
            className="relative bg-white shadow-[0_16px_40px_rgba(90,110,185,0.28)] rounded-xs select-none touch-none"
            style={{
              height: '100%',
              maxHeight: 'min(72vh, 620px)',
              aspectRatio: `${width} / ${height}`,
            }}
            onPointerMove={onStageMove}
            onPointerUp={() => (drag.current = null)}
            onPointerCancel={() => (drag.current = null)}
            onPointerDown={() => setSelected(null)}
          >
            {/* Direct GPU Rendered Canvas for 60fps instant previews */}
            <canvas
              ref={previewCanvasRef}
              className="w-full h-full block pointer-events-none rounded-xs"
            />

            {stickers.map((s) => (
              <button
                key={s.uid}
                onPointerDown={onStickerDown(s.uid)}
                onPointerMove={onStageMove}
                onPointerUp={() => (drag.current = null)}
                onPointerCancel={() => (drag.current = null)}
                className={`absolute leading-none touch-none cursor-move select-none ${
                  selected === s.uid ? 'outline outline-2 outline-dashed outline-[#8198ed]' : ''
                }`}
                style={{
                  left: `${s.x * 100}%`,
                  top: `${s.y * 100}%`,
                  transform: `translate(-50%,-50%) rotate(${s.rotation}deg)`,
                  width: `${s.scale * 42}px`,
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

        {/* Bottom Bar: Download, QR, Done (Always visible) */}
        <div className="flex items-center gap-2.5 sm:gap-3 w-full max-w-[460px] mx-auto shrink-0 pt-2 pb-1">
          {/* Download Button with outer white container card */}
          <div className="flex-1 p-0.5 bg-white rounded-xl shadow-[0_4px_12px_rgba(100,120,190,0.18)]">
            <button
              type="button"
              onClick={download}
              className="w-full bg-[#8198ed] hover:bg-[#6e88e8] active:translate-y-0.5 text-white py-2.5 sm:py-3 rounded-lg font-pixel text-[10px] sm:text-xs tracking-wider shadow-[2px_2px_0px_#5b6fbc] transition-all cursor-pointer select-none text-center flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Download</span>
            </button>
          </div>

          {/* QR Button with outer white container card */}
          <div className="flex-1 p-0.5 bg-white rounded-xl shadow-[0_4px_12px_rgba(100,120,190,0.18)]">
            <button
              type="button"
              onClick={handleOpenQR}
              className="w-full bg-[#8198ed] hover:bg-[#6e88e8] active:translate-y-0.5 text-white py-2.5 sm:py-3 rounded-lg font-pixel text-[10px] sm:text-xs tracking-wider shadow-[2px_2px_0px_#5b6fbc] transition-all cursor-pointer select-none flex items-center justify-center gap-1.5"
            >
              <QrCode className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>QR</span>
            </button>
          </div>

          {/* Done Button: returns to layout picker for next guest */}
          <div className="flex-1 p-0.5 bg-white rounded-xl shadow-[0_4px_12px_rgba(100,120,190,0.18)]">
            <button
              type="button"
              onClick={onDone}
              className="w-full bg-[#52b788] hover:bg-[#40916c] active:translate-y-0.5 text-white py-2.5 sm:py-3 rounded-lg font-pixel text-[10px] sm:text-xs tracking-wider shadow-[2px_2px_0px_#2d6a4f] transition-all cursor-pointer select-none flex items-center justify-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Done</span>
            </button>
          </div>
        </div>
      </div>

      {/* ================= RIGHT HALF: Full Height Customization Panel ================= */}
      <div className="bg-[#efefff] h-full max-h-screen px-5 sm:px-8 lg:px-10 py-5 sm:py-6 overflow-y-auto space-y-6 shadow-2xl flex flex-col justify-start scrollbar-thin">
        {/* ---- 1. Filters ---- */}
        <section>
          <h3 className="font-pixel text-[#5b7fcb] text-lg sm:text-xl tracking-wider mb-3 select-none">
            Filters
          </h3>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 sm:gap-2.5">
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
                  {firstFrameThumb && (
                    <img
                      src={firstFrameThumb}
                      alt=""
                      className="w-full h-full object-cover pointer-events-none"
                      style={{ filter: f.id === 'pixelate' ? 'contrast(1.05)' : f.css }}
                    />
                  )}
                  {filter === f.id && (
                    <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#5b7fcb] text-white grid place-items-center text-[9px] font-bold shadow">
                      <Check className="w-2.5 h-2.5" />
                    </span>
                  )}
                </div>
                <p className="font-pixel text-[6px] sm:text-[7px] text-[#5b7fcb] text-center mt-1 truncate w-full group-hover:text-[#4162b8]">
                  {f.label}
                </p>
              </button>
            ))}
          </div>
        </section>

        {/* ---- 2. Background ---- */}
        <section>
          <h3 className="font-pixel text-[#5b7fcb] text-lg sm:text-xl tracking-wider mb-2 select-none">
            Background
          </h3>
          {/* Container with top and bottom padding so scale-105 and rings are never clipped */}
          <div className="flex gap-3 overflow-x-auto pt-2 pb-3 px-1.5 scrollbar-thin items-center">
            {/* None Option */}
            <button
              onClick={() => handleSelectBg(BACKGROUNDS[0])}
              className={`shrink-0 size-16 sm:size-20 rounded-xl bg-[#ffe5ec] border-2 border-[#ffb3c6] flex items-center justify-center transition-all cursor-pointer ${
                bg.id === 'none' ? 'ring-3 ring-[#ff80a0] shadow-md scale-105' : 'hover:scale-105'
              }`}
            >
              <Ban className="w-5 h-5 text-rose-400" />
            </button>

            {/* Pattern/Frame image backgrounds */}
            {bgsList.filter((b) => b.kind === 'image' && b.url).map((b) => (
              <button
                key={b.id}
                onClick={() => handleSelectBg(b)}
                className={`shrink-0 size-16 sm:size-20 rounded-xl overflow-hidden border-2 bg-white transition-all cursor-pointer ${
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
          <h3 className="font-pixel text-[#5b7fcb] text-lg sm:text-xl tracking-wider mb-3 select-none">
            Stickers
          </h3>
          <div className="grid grid-cols-5 sm:grid-cols-6 gap-2.5 sm:gap-3 max-w-[620px]">
            {/* Clear All Stickers Button */}
            <button
              onClick={() => setStickers([])}
              className="size-16 sm:size-20 rounded-xl bg-[#ffe5ec] border-2 border-[#ffb3c6] flex items-center justify-center transition-all cursor-pointer hover:scale-105"
              title="Clear all stickers"
            >
              <Trash2 className="w-5 h-5 text-rose-400" />
            </button>

            {/* Stickers List */}
            {stickersList.map((s) => {
              const isPlaced = stickers.some((st) => st.src === s.src)
              return (
                <button
                  key={s.id}
                  onClick={() => toggleSticker(s.src)}
                  className={`size-16 sm:size-20 rounded-xl bg-[#e8eeff] hover:bg-white border-2 flex items-center justify-center p-2.5 transition-all cursor-pointer ${
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

        {/* ---- 4. Custom Text ---- */}
        <section>
          <h3 className="font-pixel text-[#5b7fcb] text-lg sm:text-xl tracking-wider mb-3 select-none">
            Text
          </h3>
          <div className="flex flex-col gap-3 max-w-[560px]">
            {/* Custom Text Input Bar */}
            <div className="flex gap-2 w-full">
              <input
                type="text"
                placeholder="Write custom text (or leave blank)..."
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                className="flex-1 bg-white border border-[#cdd6f0] focus:border-[#8198ed] focus:ring-2 focus:ring-[#8198ed]/30 px-3 py-2 rounded-xl font-mono text-xs text-[#334155] outline-none shadow-xs"
              />
              <button
                type="button"
                onClick={() => setCustomText('')}
                className="btn95 !px-3 !py-1.5 text-[10px] font-bold text-[#ff5c8a] shrink-0"
                title="Clear text (Blank Polaroid)"
              >
                ✕ Blank
              </button>
            </div>

            {/* Font Style Picker */}
            <div className="flex flex-col gap-1.5 pt-1">
              <span className="font-pixel text-[9px] text-[#5b7fcb] tracking-wider">Font Style:</span>
              <div className="grid grid-cols-3 gap-2">
                {FONT_OPTIONS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFontStyle(f.id)}
                    className={`py-2 px-2 rounded-xl border text-center transition-all cursor-pointer shadow-xs truncate flex flex-col items-center justify-center gap-0.5 ${
                      fontStyle === f.id
                        ? 'bg-[#8198ed] text-white border-[#5b6fbc] ring-2 ring-[#8198ed]/50 shadow-md scale-[1.02]'
                        : 'bg-white text-[#334155] border-[#cdd6f0] hover:border-[#8198ed] hover:bg-[#f8faff]'
                    }`}
                  >
                    <span
                      className="text-xs sm:text-sm leading-tight"
                      style={{ fontFamily: f.family.replace(/"/g, '') }}
                    >
                      {f.sample}
                    </span>
                    <span
                      className={`text-[8px] font-pixel truncate opacity-80 ${
                        fontStyle === f.id ? 'text-white' : 'text-[#8792c4]'
                      }`}
                    >
                      {f.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Text Color Swatches */}
            <div className="flex flex-col gap-1.5 pt-1">
              <span className="font-pixel text-[9px] text-[#5b7fcb] tracking-wider">Text Color:</span>
              <div className="flex items-center gap-2 flex-wrap">
                {TEXT_COLORS.map((tc) => (
                  <button
                    key={tc.id}
                    onClick={() => setTextColor(tc.color)}
                    title={tc.label}
                    className={`size-7 rounded-full border-2 transition-transform cursor-pointer shadow-xs ${
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
                  className="size-7 rounded-full border-2 border-dashed border-[#8198ed] grid place-items-center cursor-pointer hover:scale-105 bg-white shadow-xs text-xs overflow-hidden text-[#8198ed]"
                >
                  <Palette className="w-3 h-3" />
                  <input
                    type="color"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="opacity-0 absolute size-0"
                  />
                </label>
              </div>
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
              <X className="w-4 h-4" />
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
                        className="btn95 is-primary !px-3 !py-2 text-[10px] font-bold flex items-center gap-1"
                        onClick={copyLink}
                      >
                        {copied ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-300" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={download}
                      className="btn95 is-primary !px-4 !py-2.5 text-xs font-bold w-full flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download High-Res PNG</span>
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
                  className="btn95 is-primary !px-5 !py-2.5 text-xs font-bold flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Save to Device</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
