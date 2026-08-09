import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import QRCode from 'qrcode'
import {
  BACKGROUNDS,
  FILTERS,
  LOGOS,
  preloadBackgrounds,
  composeStrip,
  stripSize,
  type Background,
  type FilterId,
  type LogoLang,
  type Template,
} from '../../lib/strip'
import { STICKERS, loadStickers, type PlacedSticker } from '../../lib/stickers'

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
  const [stickers, setStickers] = useState<PlacedSticker[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [ready, setReady] = useState(0)
  const [qrDataUrl, setQrDataUrl] = useState<string>('')

  const stageRef = useRef<HTMLDivElement | null>(null)
  const drag = useRef<{ uid: string } | null>(null)

  useEffect(() => {
    preloadBackgrounds()
    loadStickers()
    BACKGROUNDS.forEach((b) => {
      if (b._img && !b._img.complete) b._img.onload = () => setReady((r) => r + 1)
    })
  }, [])

  const { width, height } = stripSize(template)

  const baseUrl = useMemo(
    () =>
      composeStrip({ frames, template, filter, background: bg, frameColor, stickers: [], logo })
        .toDataURL('image/png'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [frames, template, filter, bg, frameColor, logo, ready]
  )

  const toggleSticker = (src: string) => {
    // If sticker is already placed, toggle it off; otherwise place it near corner/center
    const existing = stickers.find((s) => s.src === src)
    if (existing) {
      setStickers((list) => list.filter((s) => s.src !== src))
      if (selected === existing.uid) setSelected(null)
    } else {
      const uid = `${src}-${Date.now()}`
      // Preset default smart placements (alternating corners for cute purikura look)
      const count = stickers.length
      const presets = [
        { x: 0.12, y: 0.88 }, // bottom left
        { x: 0.88, y: 0.88 }, // bottom right
        { x: 0.88, y: 0.12 }, // top right
        { x: 0.12, y: 0.12 }, // top left
        { x: 0.5, y: 0.5 },   // center
      ]
      const pos = presets[count % presets.length]
      const newSticker: PlacedSticker = { uid, src, x: pos.x, y: pos.y, scale: 1.1, rotation: 0 }
      setStickers((list) => [...list, newSticker])
      setSelected(uid)
    }
  }

  const onStickerDown = (uid: string) => (e: PointerEvent) => {
    e.stopPropagation()
    setSelected(uid)
    drag.current = { uid }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onStageMove = (e: PointerEvent) => {
    if (!drag.current || !stageRef.current) return
    const r = stageRef.current.getBoundingClientRect()
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
    setStickers((l) => l.map((s) => (s.uid === drag.current!.uid ? { ...s, x, y } : s)))
  }

  const download = () => {
    const c = composeStrip({ frames, template, filter, background: bg, frameColor, stickers, logo })
    const a = document.createElement('a')
    a.href = c.toDataURL('image/png')
    a.download = `omoidecam-${Date.now()}.png`
    a.click()
  }

  const [copied, setCopied] = useState(false)
  const [showShare, setShowShare] = useState(false)

  useEffect(() => {
    if (showShare) {
      QRCode.toDataURL(window.location.href, { margin: 1, width: 160 })
        .then(setQrDataUrl)
        .catch(() => {})
    }
  }, [showShare])

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr] items-start max-w-6xl mx-auto">
      {/* ---- Left Column: Strip Preview + Action Buttons ---- */}
      <div className="flex flex-col items-center">
        <div className="w-full flex items-center justify-between mb-3">
          <h2 className="font-pixel text-[#8198ed] text-xl sm:text-2xl flex items-center gap-1.5">
            <span>Preview</span>
            <span className="text-sm">✨</span>
          </h2>
          <button
            onClick={onRetake}
            className="font-pixel text-[9px] text-[#8792c4] hover:text-[#8198ed] underline"
          >
            ↺ Retake
          </button>
        </div>

        {/* Photo Strip Preview Box */}
        <div
          ref={stageRef}
          className="relative w-full max-w-[220px] touch-none bevel-in p-1 bg-white shadow-md rounded-md"
          style={{ aspectRatio: `${width} / ${height}` }}
          onPointerMove={onStageMove}
          onPointerUp={() => (drag.current = null)}
          onPointerDown={() => setSelected(null)}
        >
          <img src={baseUrl} alt="Your photo strip" className="w-full h-full block rounded-sm" />
          {stickers.map((s) => (
            <button
              key={s.uid}
              onPointerDown={onStickerDown(s.uid)}
              className={`absolute leading-none touch-none ${
                selected === s.uid ? 'outline outline-2 outline-dashed outline-[#8198ed]' : ''
              }`}
              style={{
                left: `${s.x * 100}%`,
                top: `${s.y * 100}%`,
                transform: `translate(-50%,-50%) rotate(${s.rotation}deg)`,
                width: `${s.scale * 38}px`,
              }}
            >
              <img src={s.src} alt="" className="w-full h-full object-contain pointer-events-none select-none" />
            </button>
          ))}
        </div>

        {/* Bottom Action Bar: Download & QR */}
        <div className="flex gap-2 w-full max-w-[220px] mt-4">
          <button className="btn95 is-primary flex-1 !py-2.5 text-xs font-bold" onClick={download}>
            Download
          </button>
          <button className="btn95 is-accent !px-4 !py-2.5 text-xs font-bold" onClick={() => setShowShare((v) => !v)}>
            QR
          </button>
        </div>

        {showShare && (
          <div className="mt-3 bevel-in bg-white p-3 text-center space-y-2 w-full max-w-[220px] rounded">
            <p className="font-crt text-lg text-[#8792c4] font-bold">Scan to open on mobile:</p>
            {qrDataUrl && (
              <img src={qrDataUrl} alt="QR Code" className="w-28 h-28 mx-auto border border-[#d4dcf7] p-1 rounded bg-white" />
            )}
            <div className="flex gap-1.5 pt-1">
              <input
                readOnly
                value={window.location.href}
                className="flex-1 bevel-in bg-white px-2 py-1 font-crt text-base outline-none truncate"
              />
              <button className="btn95 !px-2 !py-1 text-[9px]" onClick={copyLink}>
                {copied ? '✓' : 'copy'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ---- Right Column: Control Options (Filters, Background, Stickers, Translation) ---- */}
      <div className="space-y-6 overflow-hidden">
        {/* Filters */}
        <section>
          <h3 className="font-pixel text-[#8198ed] text-sm sm:text-base mb-2.5">Filters</h3>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
            {FILTERS.map((f) => (
              <button key={f.id} onClick={() => setFilter(f.id)} className="group text-left">
                <div
                  className={`relative aspect-square overflow-hidden bg-[#cdd6f0] rounded-md border-2 transition-all ${
                    filter === f.id ? 'border-[#8198ed] shadow-sm scale-[1.02]' : 'border-transparent hover:border-[#a8b8e0]'
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
                    <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#8198ed] text-white grid place-items-center text-[9px] font-bold">
                      ✓
                    </span>
                  )}
                </div>
                <p className="font-pixel text-[7px] text-[#8792c4] text-center mt-1 truncate">{f.label}</p>
              </button>
            ))}
          </div>
        </section>

        {/* Background */}
        <section>
          <h3 className="font-pixel text-[#8198ed] text-sm sm:text-base mb-2.5">Background</h3>
          <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-thin">
            {BACKGROUNDS.map((b) => (
              <button
                key={b.id}
                onClick={() => setBg(b)}
                className={`shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-md overflow-hidden border-2 grid place-items-center bg-white transition-all ${
                  bg.id === b.id ? 'border-[#8198ed] ring-2 ring-[#8198ed]/30 shadow-sm' : 'border-[#a8b8e0] hover:border-[#8198ed]'
                }`}
              >
                {b.kind === 'none' && <span className="text-[#e79] text-xl font-bold">✕</span>}
                {b.kind === 'image' && b.url && <img src={b.url} alt="" className="w-full h-full object-cover" />}
              </button>
            ))}
          </div>
        </section>

        {/* Stickers */}
        <section>
          <h3 className="font-pixel text-[#8198ed] text-sm sm:text-base mb-2.5">Stickers</h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setStickers([])
                setSelected(null)
              }}
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg grid place-items-center bg-[#fdeef0] border-2 border-[#f4c6cf] text-[#e79] text-xl font-bold hover:bg-[#fcdde2]"
              title="Clear stickers"
            >
              ✕
            </button>
            {STICKERS.map((s) => {
              const active = stickers.some((st) => st.src === s.src)
              return (
                <button
                  key={s.id}
                  onClick={() => toggleSticker(s.src)}
                  title={s.label}
                  className={`w-12 h-12 sm:w-14 sm:h-14 rounded-lg grid place-items-center bg-[#eef2ff] border-2 transition-all p-1.5 ${
                    active ? 'border-[#8198ed] bg-[#d4dcf7] shadow-sm' : 'border-transparent hover:border-[#8198ed]'
                  }`}
                >
                  <img src={s.src} alt={s.label} className="w-full h-full object-contain pointer-events-none" />
                </button>
              )
            })}
          </div>
        </section>

        {/* Translation */}
        <section>
          <h3 className="font-pixel text-[#8198ed] text-sm sm:text-base mb-2.5">Translation</h3>
          <div className="grid grid-cols-2 gap-2.5 max-w-lg">
            {LOGOS.map((l) => (
              <button
                key={l.id}
                onClick={() => setLogo(l.id)}
                className={`py-2.5 px-3 rounded-lg border-2 text-center transition-all ${
                  logo === l.id
                    ? 'bg-[#8198ed] text-white border-[#5b6fbc] shadow-sm'
                    : 'bg-[#eef2ff] text-[#8792c4] border-transparent hover:border-[#a8b8e0]'
                }`}
                style={{ fontFamily: l.id === 'en' ? "'Press Start 2P', monospace" : "'Noto Sans JP', sans-serif" }}
              >
                <span className="text-xs sm:text-sm font-bold">{l.label}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
