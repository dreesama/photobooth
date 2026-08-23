import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Ban,
  Timer,
  ChevronDown,
  Smile,
  UserCheck,
  ArrowLeft,
  Camera,
  RotateCcw,
  Check,
  Sparkles,
} from 'lucide-react'
import { useCamera } from '../../hooks/useCamera'
import { useFaceLandmarker } from '../../hooks/useFaceLandmarker'
import { countFor, type Template } from '../../lib/strip'
import { PROPS, loadProps, propImage, type PropDef } from '../../lib/props'
import type { FaceMetrics } from '../../lib/faceTracking'

type Props = {
  template: Template
  onConfirm: (frames: HTMLCanvasElement[]) => void
  onBack: () => void
}

// 1080p native 4:3 high-res photo capture
const CAP_W = 1040
const CAP_H = 780

function playShutterSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.1)
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.1)
  } catch {
    // audio context blocked
  }
}

/**
 * Universal AR prop renderer for both 60fps live canvas overlay and high-res snapshot capture.
 * Guarantees 100% exact alignment between preview and captured photo.
 */
export function drawPropOnCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  prop: PropDef | null,
  metrics: FaceMetrics | undefined,
  isMirrored = true
) {
  if (!prop || !prop.src) return
  const im = propImage(prop.src)
  if (!im || !im.complete || !im.naturalWidth) return

  if (metrics && metrics.hasFace) {
    const anchor = prop.anchor || 'forehead'
    let pt = metrics.forehead
    if (anchor === 'eyes') {
      pt = metrics.eyeCenter
    } else if (anchor === 'nose') {
      pt = metrics.nose
    } else if (anchor === 'ear') {
      // Subject's right ear / hairpin (viewer's right in mirror)
      pt = metrics.earLeft
    } else if (anchor === 'ear-left') {
      // Subject's left ear / hairpin (viewer's left in mirror)
      pt = metrics.earRight
    }

    const offX = prop.offsetX ?? 0
    const rawDisplayX = (isMirrored ? 1 - pt.x : pt.x) + (isMirrored ? -offX : offX)
    const rawDisplayY = pt.y + (prop.offsetY ?? -0.02)

    const px = rawDisplayX * width
    const py = rawDisplayY * height

    const isEar = anchor === 'ear' || anchor === 'ear-left'
    const baseWidthRatio = isEar ? 0.22 : 0.4
    const pw = width * baseWidthRatio * metrics.scale * (prop.scaleFactor ?? 1.3)
    const ph = pw * (im.naturalHeight / im.naturalWidth)

    // In mirrored display, head roll rotation matches mirrored orientation directly
    const rotationDeg = isMirrored ? metrics.rotation : -metrics.rotation

    ctx.save()
    ctx.translate(px, py)
    ctx.rotate((rotationDeg * Math.PI) / 180)

    // Subtle 3D perspective pitch tilt squish:
    if (metrics.pitch) {
      const pitchSquish = 1 - Math.abs(metrics.pitch) * 0.003
      ctx.scale(1, Math.max(0.85, Math.min(1.15, pitchSquish)))
    }

    ctx.drawImage(im, -pw / 2, -ph / 2, pw, ph)
    ctx.restore()
  } else {
    // Default fallback position when no face is locked
    const isEar = prop.anchor === 'ear' || prop.anchor === 'ear-left'
    const baseWidth = width * (isEar ? 0.22 : 0.45)
    const pw = baseWidth * (prop.scaleFactor ?? 1.3)
    const ph = pw * (im.naturalHeight / im.naturalWidth)
    const offX = prop.offsetX ?? 0
    const defaultX = prop.anchor === 'ear-left' ? width * 0.24 : prop.anchor === 'ear' ? width * 0.76 : width * 0.5
    const px = defaultX + (isMirrored ? -offX * width : offX * width)
    const py = (isEar ? height * 0.32 : height * 0.18) + (prop.offsetY ?? 0) * height

    ctx.save()
    ctx.translate(px, py)
    ctx.drawImage(im, -pw / 2, -ph / 2, pw, ph)
    ctx.restore()
  }
}

function snapshot(
  video: HTMLVideoElement,
  prop: PropDef,
  metrics?: FaceMetrics
): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = CAP_W
  c.height = CAP_H
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  const vw = video.videoWidth || CAP_W
  const vh = video.videoHeight || CAP_H
  const ratio = CAP_W / CAP_H
  let sw = vw,
    sh = vw / ratio
  if (sh > vh) {
    sh = vh
    sw = vh * ratio
  }
  const sx = (vw - sw) / 2,
    sy = (vh - sh) / 2

  // 1. Draw mirrored 4:3 cropped video frame
  ctx.save()
  ctx.translate(CAP_W, 0)
  ctx.scale(-1, 1)
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, CAP_W, CAP_H)
  ctx.restore()

  // 2. Draw prop with exact matching coordinate transformation
  if (prop && prop.src) {
    drawPropOnCanvas(ctx, CAP_W, CAP_H, prop, metrics, true)
  }

  return c
}

export default function CameraStage({ template, onConfirm, onBack }: Props) {
  const { videoRef, status, start } = useCamera()
  const { metrics, metricsRef } = useFaceLandmarker(videoRef, true)

  const total = countFor(template)
  const [propsList, setPropsList] = useState<PropDef[]>(PROPS)
  const [prop, setProp] = useState<PropDef>(PROPS[0])
  const propRef = useRef<PropDef>(prop)

  const [seconds, setSeconds] = useState(3)
  const [showTimerMenu, setShowTimerMenu] = useState(false)
  const [count, setCount] = useState<number | null>(null)
  const [currentShotIndex, setCurrentShotIndex] = useState<number>(0)
  const [shots, setShots] = useState<HTMLCanvasElement[]>([])
  const [shooting, setShooting] = useState(false)
  const [flash, setFlash] = useState(false)

  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null)

  // Keep propRef always synced to active prop selection
  useEffect(() => {
    propRef.current = prop
  }, [prop])

  useEffect(() => {
    start()
    loadProps(false).then((loaded) => {
      setPropsList(loaded)
      if (loaded.length > 0 && !loaded.some((p) => p.id === prop.id)) {
        setProp(loaded[0])
        propRef.current = loaded[0]
      }
    })
  }, [start])

  // 60FPS Direct Hardware Overlay Render Loop (0 React re-renders)
  useEffect(() => {
    let animId: number
    const renderLoop = () => {
      const canvas = overlayCanvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          if (propRef.current && propRef.current.src) {
            drawPropOnCanvas(
              ctx,
              canvas.width,
              canvas.height,
              propRef.current,
              metricsRef.current,
              true
            )
          }
        }
      }
      animId = requestAnimationFrame(renderLoop)
    }

    animId = requestAnimationFrame(renderLoop)
    return () => cancelAnimationFrame(animId)
  }, [metricsRef])

  const runSequence = useCallback(async () => {
    if (shooting || !videoRef.current) return
    setShooting(true)
    setShots([])
    const grabbed: HTMLCanvasElement[] = []

    for (let i = 0; i < total; i++) {
      setCurrentShotIndex(i)

      for (let s = seconds; s > 0; s--) {
        setCount(s)
        await new Promise((r) => setTimeout(r, 1000))
      }
      setCount(null)
      setFlash(true)
      playShutterSound()
      setTimeout(() => setFlash(false), 450)

      // Use propRef.current at the exact moment of each snapshot to capture latest chosen prop!
      const activeProp = propRef.current
      const activeMetrics = metricsRef.current
      grabbed.push(snapshot(videoRef.current, activeProp, activeMetrics))
      setShots([...grabbed])

      if (i < total - 1) {
        // Brief comfortable inter-shot transition so user can switch props or pose
        await new Promise((r) => setTimeout(r, 900))
      }
    }
    setShooting(false)
  }, [shooting, videoRef, total, seconds, metricsRef])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && status === 'live' && !shooting) {
        e.preventDefault()
        runSequence()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [runSequence, status, shooting])

  const done = shots.length >= total

  const handleSelectProp = (p: PropDef) => {
    setProp(p)
    propRef.current = p
  }

  return (
    <div className="w-full flex flex-col items-center gap-4 py-2 select-none">
      {/* Row 1: Interactive Wearable Props Buttons (Changeable anytime before/during sequence) */}
      <div className="flex flex-col items-center gap-1.5">
        <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
          {propsList.map((p) => {
            const isSelected = prop.id === p.id
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelectProp(p)}
                title={p.label}
                className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl grid place-items-center bg-white shadow-md transition-all cursor-pointer ${
                  isSelected
                    ? 'ring-3 ring-[#8198ed] border-2 border-[#5b7fcb] bg-[#eef2ff] scale-110 shadow-lg'
                    : 'border border-slate-200 hover:border-[#8198ed] hover:scale-105 active:scale-95'
                }`}
              >
                {p.src ? (
                  <img
                    src={p.src}
                    alt={p.label}
                    className="size-10 sm:size-11 object-contain pointer-events-none"
                  />
                ) : (
                  <Ban className="w-6 h-6 text-rose-400" />
                )}
              </button>
            )
          })}
        </div>

        {shooting && (
          <p className="font-pixel text-[9px] text-[#5b7fcb] animate-pulse">
            ✨ Click any wearable above to change prop for the next shot!
          </p>
        )}
      </div>

      {/* Main Row: Live Camera Stage + Right-Side Strip Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-5 sm:gap-8 items-center justify-center w-full max-w-5xl">
        {/* Large Video Box with Direct 60FPS AR Overlay */}
        <div className="relative bg-black rounded-2xl overflow-hidden aspect-[4/3] w-full max-w-3xl mx-auto shadow-2xl border-4 border-white/90">
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full h-full object-cover -scale-x-100 block"
          />

          {/* Real-Time 60FPS AR Wearable Canvas Overlay (zero-lag direct GPU rendering) */}
          <canvas
            ref={overlayCanvasRef}
            width={CAP_W}
            height={CAP_H}
            className="absolute inset-0 w-full h-full pointer-events-none z-10"
          />

          {/* Flash & Countdowns */}
          {flash && (
            <div className="absolute inset-0 bg-white z-40 animate-out fade-out duration-300 pointer-events-none" />
          )}

          {/* Countdown Display */}
          {count !== null && (
            <div className="absolute inset-0 grid place-items-center pointer-events-none z-30">
              <div className="flex flex-col items-center gap-2">
                <span className="font-pixel text-white text-6xl sm:text-7xl md:text-8xl drop-shadow-[0_6px_0_rgba(91,111,188,0.95)] animate-in zoom-in-75 duration-200">
                  {count}
                </span>
                <span className="font-pixel text-xs sm:text-sm text-white bg-black/60 px-3 py-1 rounded-full backdrop-blur-xs border border-white/40">
                  Shot #{currentShotIndex + 1} of {total}
                </span>
              </div>
            </div>
          )}

          {/* Camera Status Overlay */}
          {status !== 'live' && (
            <div className="absolute inset-0 grid place-items-center text-center p-4 bg-black/85 z-30">
              <div className="font-pixel text-sm sm:text-base text-white/90 leading-relaxed">
                {status === 'starting' && 'Connecting camera…'}
                {status === 'denied' &&
                  'Camera access blocked. Please allow camera permissions.'}
                {status === 'error' && 'No camera found. Please check connection.'}
                {status === 'idle' && 'Starting camera…'}
              </div>
            </div>
          )}

          {/* Top Left Timer Pill */}
          <div className="absolute top-3 left-3 z-20">
            <button
              onClick={() => setShowTimerMenu((v) => !v)}
              className="font-pixel text-[10px] text-[#5b7fcb] bg-white/90 hover:bg-white backdrop-blur-xs px-3 py-1.5 rounded-lg shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <Timer className="w-3.5 h-3.5 text-[#5b7fcb]" />
              <span>{seconds}s</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
            {showTimerMenu && (
              <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-xl p-1.5 flex flex-col gap-1 border border-slate-200 z-30">
                {[3, 5, 10].map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setSeconds(s)
                      setShowTimerMenu(false)
                    }}
                    className={`font-pixel text-[9px] px-3 py-1.5 text-left rounded-lg transition-colors cursor-pointer ${
                      seconds === s
                        ? 'bg-[#8198ed] text-white font-bold'
                        : 'text-slate-600 hover:bg-[#eef2ff]'
                    }`}
                  >
                    {s}s Timer
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Top Right Status & Shot Counter Badge */}
          <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
            {metrics.hasFace && (
              <span className="font-pixel text-[9px] text-[#5b7fcb] bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-lg shadow-md flex items-center gap-1.5">
                {metrics.expression === 'smile' ? (
                  <>
                    <Smile className="w-3.5 h-3.5 text-amber-500" />
                    <span>Smile!</span>
                  </>
                ) : (
                  <>
                    <UserCheck className="w-3.5 h-3.5 text-[#5b7fcb]" />
                    <span>Face Locked</span>
                  </>
                )}
              </span>
            )}
            <span className="font-pixel text-[10px] text-white bg-black/60 backdrop-blur-xs px-3 py-1 rounded-lg shadow-md border border-white/30 font-bold">
              {shots.length} / {total}
            </span>
          </div>
        </div>

        {/* Right Side: Exact Polaroid Layout Strip Preview */}
        <div className="flex flex-col items-center justify-center shrink-0">
          <h4 className="font-pixel text-[11px] sm:text-xs text-[#5b7fcb] mb-2.5 font-bold tracking-wider select-none">
            Preview
          </h4>

          <div
            className="polaroid-texture p-3.5 sm:p-4 pt-3.5 pb-6 sm:pb-8 shadow-2xl flex flex-col items-center transition-all border border-white/60"
            style={{
              width:
                template.cols === 2
                  ? 'clamp(280px, 28vw, 360px)'
                  : 'clamp(200px, 20vw, 260px)',
            }}
          >
            {/* Photo Slots Grid */}
            <div
              className="grid gap-2 sm:gap-2.5 w-full"
              style={{ gridTemplateColumns: `repeat(${template.cols}, 1fr)` }}
            >
              {Array.from({ length: total }).map((_, n) => {
                const isCurrent = shooting && currentShotIndex === n
                return (
                  <div
                    key={n}
                    className={`relative bg-[#101420] aspect-[4/3] overflow-hidden grid place-items-center w-full transition-all ${
                      isCurrent
                        ? 'ring-2 ring-[#8198ed] scale-[1.02] shadow-lg'
                        : ''
                    }`}
                  >
                    {shots[n] ? (
                      <img
                        src={shots[n].toDataURL()}
                        alt=""
                        className="w-full h-full object-cover block"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-1">
                        <span
                          className={`font-pixel text-sm sm:text-base font-bold ${
                            isCurrent
                              ? 'text-[#8198ed] animate-pulse'
                              : 'text-white/40'
                          }`}
                        >
                          #{n + 1}
                        </span>
                        {isCurrent && (
                          <Sparkles className="w-3 h-3 text-[#8198ed] animate-spin" />
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Polaroid Bottom White Chin */}
            <p className="font-pixel text-[11px] sm:text-xs text-[#5b7fcb] text-center mt-3 sm:mt-4 tracking-wider select-none">
              IT GUILD
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Action Buttons Bar */}
      <div className="flex items-center justify-center gap-3 sm:gap-4 mt-2">
        {/* Back Button */}
        <div className="p-1 bg-white rounded-xl shadow-[0_4px_12px_rgba(100,120,190,0.18)]">
          <button
            type="button"
            onClick={onBack}
            className="bg-[#9cb2f8] hover:bg-[#8ca8f5] active:translate-y-0.5 text-white px-5 sm:px-6 py-2.5 sm:py-3 rounded-lg font-pixel text-xs tracking-wider shadow-[3px_3px_0px_#7088bc] transition-all cursor-pointer select-none flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>
        </div>

        {/* Start / Snap Button */}
        <div className="p-1 bg-white rounded-xl shadow-[0_4px_12px_rgba(100,120,190,0.18)]">
          <button
            type="button"
            disabled={status !== 'live' || shooting}
            onClick={runSequence}
            className="bg-[#8198ed] hover:bg-[#6e88e8] active:translate-y-0.5 text-white px-8 sm:px-12 py-2.5 sm:py-3 rounded-lg font-pixel text-xs sm:text-sm tracking-wider shadow-[3px_3px_0px_#5b6fbc] transition-all cursor-pointer select-none font-bold disabled:opacity-50 flex items-center gap-2"
          >
            <Camera className="w-4 h-4" />
            <span>{shooting ? 'Capturing…' : 'Start'}</span>
          </button>
        </div>

        {/* Retake Button */}
        <div className="p-1 bg-white rounded-xl shadow-[0_4px_12px_rgba(100,120,190,0.18)]">
          <button
            type="button"
            disabled={shooting || shots.length === 0}
            onClick={() => setShots([])}
            className="bg-[#9cb2f8] hover:bg-[#8ca8f5] active:translate-y-0.5 text-white px-5 sm:px-6 py-2.5 sm:py-3 rounded-lg font-pixel text-xs tracking-wider shadow-[3px_3px_0px_#7088bc] transition-all cursor-pointer select-none disabled:opacity-50 flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retake</span>
          </button>
        </div>

        {/* Confirm Button */}
        <div className="p-1 bg-white rounded-xl shadow-[0_4px_12px_rgba(100,120,190,0.18)]">
          <button
            type="button"
            disabled={!done || shooting}
            onClick={() => onConfirm(shots)}
            className="bg-[#8198ed] hover:bg-[#6e88e8] active:translate-y-0.5 text-white px-6 sm:px-8 py-2.5 sm:py-3 rounded-lg font-pixel text-xs sm:text-sm tracking-wider shadow-[3px_3px_0px_#5b6fbc] transition-all cursor-pointer select-none font-bold disabled:opacity-50 flex items-center gap-1.5"
          >
            <span>Confirm</span>
            <Check className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
