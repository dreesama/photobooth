import { useState, useRef, useEffect, useCallback, type PointerEvent as ReactPointerEvent } from 'react'
import {
  Crop,
  X,
  RotateCcw,
  RotateCw,
  Check,
  RefreshCw,
} from 'lucide-react'

type Props = {
  imageUrl: string
  aspectRatio?: number // e.g. 1/3 for 2x6, 2/3 for 4x6, 1 for square
  title?: string
  showFrameOverlay?: '2x6' | '4x6' | 'none'
  onConfirm: (croppedDataUrl: string) => void
  onCancel: () => void
}

export default function ImageCropperModal({
  imageUrl,
  aspectRatio = 1 / 3,
  title = 'Crop & Align Image',
  showFrameOverlay = 'none',
  onConfirm,
  onCancel,
}: Props) {
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [aspect, setAspect] = useState(aspectRatio)
  const [overlay, setOverlay] = useState(showFrameOverlay)

  const containerRef = useRef<HTMLDivElement | null>(null)
  const isDragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const initialPan = useRef({ x: 0, y: 0 })

  const imgRef = useRef<HTMLImageElement | null>(null)
  const [imgLoaded, setImgLoaded] = useState(false)

  // Load image
  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = imageUrl
    img.onload = () => {
      imgRef.current = img
      setImgLoaded(true)
    }
  }, [imageUrl])

  // Drag to pan
  const onPointerDown = (e: ReactPointerEvent) => {
    isDragging.current = true
    dragStart.current = { x: e.clientX, y: e.clientY }
    initialPan.current = { ...pan }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!isDragging.current) return
    const dx = (e.clientX - dragStart.current.x) / zoom
    const dy = (e.clientY - dragStart.current.y) / zoom
    setPan({
      x: initialPan.current.x + dx,
      y: initialPan.current.y + dy,
    })
  }

  const onPointerUp = () => {
    isDragging.current = false
  }

  // Wheel to zoom
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    setZoom((z) => Math.min(4, Math.max(0.4, z - e.deltaY * 0.0015)))
  }, [])

  // Crop Canvas Export
  const handleCrop = () => {
    if (!imgRef.current) return
    const img = imgRef.current

    // High-res export dimensions (e.g. 1200 x 1800 or 600 x 1800)
    const exportWidth = aspect <= 0.4 ? 600 : aspect <= 0.75 ? 1200 : 1000
    const exportHeight = Math.round(exportWidth / aspect)

    const canvas = document.createElement('canvas')
    canvas.width = exportWidth
    canvas.height = exportHeight
    const ctx = canvas.getContext('2d')!

    // Clear canvas completely to preserve 100% transparent PNG sprites
    ctx.clearRect(0, 0, exportWidth, exportHeight)

    ctx.save()
    ctx.translate(exportWidth / 2, exportHeight / 2)
    ctx.rotate((rotation * Math.PI) / 180)
    ctx.scale(zoom, zoom)
    ctx.translate(pan.x * (exportWidth / 280), pan.y * (exportHeight / (280 / aspect)))

    // Draw scaled image centered
    const baseW = exportWidth
    const baseH = baseW * (img.naturalHeight / img.naturalWidth)
    ctx.drawImage(img, -baseW / 2, -baseH / 2, baseW, baseH)
    ctx.restore()

    const cropped = canvas.toDataURL('image/png')
    onConfirm(cropped)
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col overflow-hidden border border-slate-200 max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-[#f8faff]">
          <div className="flex items-center gap-2">
            <Crop className="w-4 h-4 text-[#5b7fcb]" />
            <h3 className="font-pixel text-[#5b7fcb] text-xs sm:text-sm tracking-wider font-bold">
              {title}
            </h3>
          </div>
          <button
            onClick={onCancel}
            className="size-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold text-xs flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Crop Stage Container */}
        <div
          ref={containerRef}
          onWheel={onWheel}
          className="relative flex-1 bg-[#23293e] flex items-center justify-center overflow-hidden p-4 min-h-[320px] select-none"
        >
          {/* Crop Viewport Box with Transparency Checkerboard */}
          <div
            className="relative overflow-hidden border-2 border-[#8198ed] shadow-2xl cursor-grab active:cursor-grabbing"
            style={{
              width: '260px',
              height: `${260 / aspect}px`,
              maxHeight: '440px',
              backgroundImage:
                'linear-gradient(45deg, #1e293b 25%, #0f172a 25%), linear-gradient(-45deg, #1e293b 25%, #0f172a 25%), linear-gradient(45deg, #0f172a 75%, #1e293b 75%), linear-gradient(-45deg, #0f172a 75%, #1e293b 75%)',
              backgroundSize: '16px 16px',
              backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            {/* Background Image with Zoom and Pan */}
            {imgLoaded && (
              <div
                className="absolute origin-top-left pointer-events-none"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg) scale(${zoom})`,
                  transformOrigin: 'center center',
                  width: '100%',
                  height: '100%',
                }}
              >
                <img
                  src={imageUrl}
                  alt="Crop preview"
                  className="max-w-none w-full h-auto object-cover select-none pointer-events-none"
                />
              </div>
            )}

            {/* Optional Live Photo Cutout Overlays (2x6 or 4x6) */}
            {overlay === '2x6' && (
              <div className="absolute inset-0 pointer-events-none p-2 flex flex-col justify-between opacity-80">
                <div className="grid gap-1.5 w-full">
                  {[1, 2, 3].map((n) => (
                    <div
                      key={n}
                      className="aspect-[4/3] border border-dashed border-white/80 bg-black/35 rounded-xs flex items-center justify-center text-[8px] font-pixel text-white/90"
                    >
                      Photo #{n}
                    </div>
                  ))}
                </div>
                <div className="h-6 border border-dashed border-white/60 bg-black/30 rounded-xs flex items-center justify-center text-[7px] font-pixel text-[#8198ed]">
                  Logo Chin
                </div>
              </div>
            )}

            {overlay === '4x6' && (
              <div className="absolute inset-0 pointer-events-none p-2 flex flex-col justify-between opacity-80">
                <div className="grid grid-cols-2 gap-1.5 w-full">
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <div
                      key={n}
                      className="aspect-[4/3] border border-dashed border-white/80 bg-black/35 rounded-xs flex items-center justify-center text-[7px] font-pixel text-white/90"
                    >
                      Photo #{n}
                    </div>
                  ))}
                </div>
                <div className="h-6 border border-dashed border-white/60 bg-black/30 rounded-xs flex items-center justify-center text-[7px] font-pixel text-[#8198ed]">
                  Logo Chin
                </div>
              </div>
            )}

            {/* Corner Alignment Rule Marks */}
            <div className="absolute top-0 left-0 size-3 border-t-2 border-l-2 border-white/90 pointer-events-none"></div>
            <div className="absolute top-0 right-0 size-3 border-t-2 border-r-2 border-white/90 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 size-3 border-b-2 border-l-2 border-white/90 pointer-events-none"></div>
            <div className="absolute bottom-0 right-0 size-3 border-b-2 border-r-2 border-white/90 pointer-events-none"></div>
          </div>
        </div>

        {/* Controls Toolbar */}
        <div className="p-4 sm:p-5 bg-white border-t border-slate-100 flex flex-col gap-3">
          {/* Sliders: Zoom & Rotate */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
            <div className="flex items-center gap-2">
              <span className="font-pixel text-[9px] text-[#5b7fcb] w-14 shrink-0">Zoom:</span>
              <input
                type="range"
                min="0.5"
                max="3.5"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="flex-1 accent-[#8198ed]"
              />
              <span className="font-mono text-xs text-slate-500 w-10 text-right">
                {Math.round(zoom * 100)}%
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-pixel text-[9px] text-[#5b7fcb] w-14 shrink-0">Rotate:</span>
              <button
                type="button"
                onClick={() => setRotation((r) => (r - 90 + 360) % 360)}
                className="btn95 !px-2 !py-1 text-[10px] flex items-center gap-1"
                title="Rotate 90 deg counter-clockwise"
              >
                <RotateCcw className="w-3 h-3" />
                <span>-90°</span>
              </button>
              <button
                type="button"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="btn95 !px-2 !py-1 text-[10px] flex items-center gap-1"
                title="Rotate 90 deg clockwise"
              >
                <RotateCw className="w-3 h-3" />
                <span>+90°</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setZoom(1)
                  setRotation(0)
                  setPan({ x: 0, y: 0 })
                }}
                className="btn95 !px-2 !py-1 text-[9px] text-slate-600 ml-auto flex items-center gap-1"
              >
                <RefreshCw className="w-2.5 h-2.5" />
                <span>Reset</span>
              </button>
            </div>
          </div>

          {/* Aspect Ratio & Frame Overlay Selector */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
            <div className="flex items-center gap-1.5">
              <span className="font-pixel text-[9px] text-[#5b7fcb] mr-1">Format:</span>
              <button
                type="button"
                onClick={() => {
                  setAspect(1 / 3)
                  setOverlay('2x6')
                }}
                className={`btn95 !px-2.5 !py-1 text-[9px] font-bold ${
                  aspect < 0.4 ? 'is-primary' : ''
                }`}
              >
                2x6 Strip
              </button>
              <button
                type="button"
                onClick={() => {
                  setAspect(2 / 3)
                  setOverlay('4x6')
                }}
                className={`btn95 !px-2.5 !py-1 text-[9px] font-bold ${
                  aspect >= 0.6 && aspect <= 0.7 ? 'is-primary' : ''
                }`}
              >
                4x6 Sheet
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="btn95 !px-4 !py-2 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCrop}
                className="btn95 is-primary !px-5 !py-2 text-xs font-bold shadow-md flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Apply & Save</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
