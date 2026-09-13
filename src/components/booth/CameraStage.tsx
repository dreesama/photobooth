import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Timer,
  ChevronDown,
  ArrowLeft,
  Camera,
  RotateCcw,
  Check,
  Sparkles,
  FlipHorizontal,
  Pause,
  Play,
} from 'lucide-react'
import { useCamera } from '../../hooks/useCamera'
import { countFor, type Template } from '../../lib/strip'
import { propImage, type PropDef } from '../../lib/props'
import type { FaceMetrics } from '../../lib/faceTracking'

type Props = {
  template: Template
  onConfirm: (frames: HTMLCanvasElement[]) => void
  onBack: () => void
}

// 1080p native 4:3 high-res photo capture
const CAP_W = 1040
const CAP_H = 780

/**
 * Prop rendering helper retained for Admin Studio / PropsTab prop previewing.
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
      pt = metrics.earLeft
    } else if (anchor === 'ear-left') {
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

    const rotationDeg = isMirrored ? metrics.rotation : -metrics.rotation

    ctx.save()
    ctx.translate(px, py)
    ctx.rotate((rotationDeg * Math.PI) / 180)

    if (metrics.pitch) {
      const pitchSquish = 1 - Math.abs(metrics.pitch) * 0.003
      ctx.scale(1, Math.max(0.85, Math.min(1.15, pitchSquish)))
    }

    ctx.drawImage(im, -pw / 2, -ph / 2, pw, ph)
    ctx.restore()
  } else {
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

function snapshot(video: HTMLVideoElement, isMirrored: boolean): HTMLCanvasElement {
  const c = document.createElement('canvas')
  const vw = video.videoWidth || 1440
  const vh = video.videoHeight || 1080
  
  // Capture at native sensor resolution (4:3 aspect ratio), minimum 1040x780 up to full 1440x1080+
  const targetH = Math.max(780, vh)
  const targetW = Math.round(targetH * (4 / 3))
  
  c.width = targetW
  c.height = targetH
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  const ratio = 4 / 3
  let sw = vw,
    sh = vw / ratio
  if (sh > vh) {
    sh = vh
    sw = vh * ratio
  }
  const sx = (vw - sw) / 2,
    sy = (vh - sh) / 2

  // Draw video frame (mirrored or normal) with high-quality smoothing
  ctx.save()
  if (isMirrored) {
    ctx.translate(targetW, 0)
    ctx.scale(-1, 1)
  }
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, targetW, targetH)
  ctx.restore()

  return c
}

export default function CameraStage({ template, onConfirm, onBack }: Props) {
  const { videoRef, status, start } = useCamera()

  const total = countFor(template)
  const [seconds, setSeconds] = useState(3)
  const [showTimerMenu, setShowTimerMenu] = useState(false)
  const [count, setCount] = useState<number | null>(null)
  const [currentShotIndex, setCurrentShotIndex] = useState<number>(0)
  const [shots, setShots] = useState<HTMLCanvasElement[]>([])
  const [shotUrls, setShotUrls] = useState<string[]>([])
  const [shooting, setShooting] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const isPausedRef = useRef(false)
  const cancelSequenceRef = useRef(false)
  const [flash, setFlash] = useState(false)
  const [isMirrored, setIsMirrored] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('itguild_camera_mirrored')
      if (saved !== null) return saved === 'true'
    }
    return true
  })

  useEffect(() => {
    start()
  }, [start])

  const toggleMirror = () => {
    setIsMirrored((prev) => {
      const next = !prev
      if (typeof window !== 'undefined') {
        localStorage.setItem('itguild_camera_mirrored', String(next))
      }
      return next
    })
  }

  const togglePause = useCallback(() => {
    isPausedRef.current = !isPausedRef.current
    setIsPaused(isPausedRef.current)
  }, [])

  const runSequence = useCallback(async () => {
    if (shooting) {
      togglePause()
      return
    }
    if (!videoRef.current) return

    cancelSequenceRef.current = false
    isPausedRef.current = false
    setIsPaused(false)
    setShooting(true)
    setShots([])
    setShotUrls([])
    const grabbed: HTMLCanvasElement[] = []
    const urls: string[] = []

    for (let i = 0; i < total; i++) {
      if (cancelSequenceRef.current) break
      setCurrentShotIndex(i)

      for (let s = seconds; s > 0; s--) {
        if (cancelSequenceRef.current) break
        setCount(s)

        // Wait 1 second in 100ms ticks, pausing if isPaused is true
        let ticks = 0
        while (ticks < 10) {
          if (cancelSequenceRef.current) break
          if (isPausedRef.current) {
            await new Promise((r) => setTimeout(r, 100))
            continue
          }
          await new Promise((r) => setTimeout(r, 100))
          ticks++
        }
      }
      if (cancelSequenceRef.current) break

      setCount(null)
      setFlash(true)
      playShutterSound()
      setTimeout(() => setFlash(false), 450)

      const snap = snapshot(videoRef.current, isMirrored)
      grabbed.push(snap)
      urls.push(snap.toDataURL('image/jpeg', 0.85))
      setShots([...grabbed])
      setShotUrls([...urls])

      if (i < total - 1) {
        // Brief transition for poses with pause responsiveness
        let transitionTicks = 0
        while (transitionTicks < 9) {
          if (cancelSequenceRef.current) break
          if (isPausedRef.current) {
            await new Promise((r) => setTimeout(r, 100))
            continue
          }
          await new Promise((r) => setTimeout(r, 100))
          transitionTicks++
        }
      }
    }

    setShooting(false)
    setIsPaused(false)
    isPausedRef.current = false
  }, [shooting, togglePause, videoRef, total, seconds, isMirrored])

  const handleRetake = () => {
    cancelSequenceRef.current = true
    isPausedRef.current = false
    setIsPaused(false)
    setShooting(false)
    setCount(null)
    setShots([])
    setShotUrls([])
  }

  const handleBack = () => {
    cancelSequenceRef.current = true
    isPausedRef.current = false
    setIsPaused(false)
    setShooting(false)
    setCount(null)
    onBack()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && status === 'live') {
        e.preventDefault()
        if (shooting) {
          togglePause()
        } else {
          runSequence()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [runSequence, togglePause, status, shooting])

  const done = shots.length >= total

  // Dynamic grid column and max-width class based on total number of photos
  // Wraps into clean rows (e.g. 2 rows of 3 for 6 photos, 2 rows of 4 for 8 photos) so cards wrap below and never squish
  // Proportional max-width for the unified photobooth console (Camera + 2-Column Tray + Buttons)
  // Guarantees all cards maintain an exact 4:3 photo aspect ratio without horizontal squishing
  const getContainerMaxWidth = () => {
    if (total <= 2) return 'max-w-2xl sm:max-w-3xl'
    if (total <= 4) return 'max-w-xl sm:max-w-2xl'
    if (total === 6) return 'max-w-lg sm:max-w-xl'
    return 'max-w-md sm:max-w-lg' // 8 photos (4 rows x 2 cols, perfectly proportioned)
  }

  const getCardNumberTextSize = () => {
    if (total <= 2) return 'text-3xl sm:text-4xl'
    if (total <= 4) return 'text-2xl sm:text-3xl'
    if (total === 6) return 'text-xl sm:text-2xl'
    return 'text-lg sm:text-xl'
  }

  return (
    <div className="w-full h-full max-h-screen overflow-hidden flex flex-col justify-center items-center gap-2.5 sm:gap-3.5 py-2 px-2 sm:px-4 select-none">
      {/* 1. TOP: Live Camera Stage (Matches tray width for unified arcade console look) */}
      <div className={`w-full relative flex items-center justify-center shrink-0 ${getContainerMaxWidth()}`}>
        <div className="relative bg-black rounded-2xl sm:rounded-3xl overflow-hidden aspect-[4/3] w-full shadow-2xl border-3 sm:border-4 border-white/90">
          <video
            ref={videoRef}
            playsInline
            muted
            className={`w-full h-full object-cover block transition-transform duration-200 ${
              isMirrored ? '-scale-x-100' : 'scale-x-100'
            }`}
          />

          {/* Flash Effect */}
          {flash && (
            <div className="absolute inset-0 bg-white z-40 animate-out fade-out duration-300 pointer-events-none" />
          )}

          {/* Countdown Display with Pause Indicator */}
          {count !== null && (
            <div className="absolute inset-0 grid place-items-center pointer-events-none z-30">
              <div className="flex flex-col items-center gap-2">
                <span className="font-pixel text-white text-5xl sm:text-7xl drop-shadow-[0_6px_0_rgba(91,111,188,0.95)] animate-in zoom-in-75 duration-200">
                  {count}
                </span>
                {isPaused ? (
                  <span className="font-pixel text-xs text-amber-300 bg-black/85 px-3 py-1 rounded-full border border-amber-400 font-bold shadow-xl animate-pulse">
                    ⏸ PAUSED - Click Resume
                  </span>
                ) : (
                  <span className="font-pixel text-[10px] sm:text-xs text-white bg-black/60 px-3 py-1 rounded-full backdrop-blur-xs border border-white/40 shadow-lg">
                    Shot #{currentShotIndex + 1} of {total}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Camera Status Overlay */}
          {status !== 'live' && (
            <div className="absolute inset-0 grid place-items-center text-center p-4 bg-black/85 z-30">
              <div className="font-pixel text-xs sm:text-sm text-white/90 leading-relaxed">
                {status === 'starting' && 'Connecting camera…'}
                {status === 'denied' &&
                  'Camera access blocked. Please allow camera permissions.'}
                {status === 'error' && 'No camera found. Please check connection.'}
                {status === 'idle' && 'Starting camera…'}
              </div>
            </div>
          )}

          {/* Top Left Controls: Timer Selection */}
          <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowTimerMenu((v) => !v)}
                className="font-pixel text-[10px] text-[#5b7fcb] bg-white/90 hover:bg-white backdrop-blur-xs px-2.5 py-1.5 rounded-lg shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <Timer className="w-3 h-3 text-[#5b7fcb]" />
                <span>{seconds}s</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>
              {showTimerMenu && (
                <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-xl p-1.5 flex flex-col gap-1 border border-slate-200 z-30">
                  {[3, 5, 10].map((s) => (
                    <button
                      key={s}
                      type="button"
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
          </div>

          {/* Top Right Controls: Camera Flip/Mirror Toggle & Shot Counter */}
          <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-2">
            <button
              type="button"
              onClick={toggleMirror}
              title={isMirrored ? 'Camera is Mirrored (Selfie mode). Click to flip.' : 'Camera is Not Mirrored (Normal mode). Click to flip.'}
              className={`font-pixel text-[10px] px-2.5 py-1.5 rounded-lg shadow-md backdrop-blur-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                isMirrored
                  ? 'bg-white/90 hover:bg-white text-[#5b7fcb]'
                  : 'bg-[#8198ed] hover:bg-[#6e88e8] text-white'
              }`}
            >
              <FlipHorizontal className="w-3 h-3" />
              <span>{isMirrored ? 'Mirrored' : 'Flipped'}</span>
            </button>

            <span className="font-pixel text-[10px] text-white bg-black/60 backdrop-blur-xs px-2.5 py-1.5 rounded-lg shadow-md border border-white/30 font-bold">
              {shots.length} / {total}
            </span>
          </div>
        </div>
      </div>

      {/* 2. MIDDLE: Dynamic 2-Column Photo Tray (True 4:3 aspect ratio, right below camera) */}
      <div className={`w-full flex flex-col items-center gap-1.5 shrink-0 ${getContainerMaxWidth()}`}>
        <div className="flex items-center justify-between w-full px-2">
          <span className="font-pixel text-xs sm:text-sm text-[#5b7fcb] font-bold tracking-wider">
            Captured Photos ({shots.length}/{total})
          </span>
          {shots.length > 0 && (
            <span className="font-pixel text-[9px] sm:text-xs text-slate-400">
              Raw captures without frame
            </span>
          )}
        </div>

        {/* 2-Column Photo Cards Tray with Exact 4:3 Ratio */}
        <div className="grid grid-cols-2 gap-2 sm:gap-2.5 w-full justify-center items-center px-1">
          {Array.from({ length: total }).map((_, n) => {
            const isCurrent = shooting && currentShotIndex === n
            const isOddLast = total === 3 && n === 2
            return (
              <div
                key={n}
                className={`relative aspect-[4/3] w-full rounded-xl sm:rounded-2xl overflow-hidden shadow-md transition-all duration-200 bg-[#1e2337] flex items-center justify-center border-2 sm:border-3 ${
                  isOddLast ? 'col-span-2 sm:col-span-1 sm:col-start-1 sm:translate-x-1/2' : ''
                } ${
                  isCurrent
                    ? 'ring-3 sm:ring-4 ring-[#8198ed] border-white scale-[1.02] shadow-xl z-10'
                    : shotUrls[n]
                    ? 'border-white/90 hover:scale-[1.01]'
                    : 'border-white/30 border-dashed bg-[#101420]/80'
                }`}
              >
                {shotUrls[n] ? (
                  <div className="relative w-full h-full">
                    <img
                      src={shotUrls[n]}
                      alt={`Shot ${n + 1}`}
                      className="w-full h-full object-cover block"
                    />
                    <span className="absolute bottom-1.5 left-1.5 font-pixel text-[9px] sm:text-[10px] text-white bg-black/75 px-2 py-0.5 rounded-md backdrop-blur-xs border border-white/25 font-bold shadow-md">
                      #{n + 1}
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-1 p-1 text-center">
                    <span
                      className={`font-pixel ${getCardNumberTextSize()} font-bold ${
                        isCurrent
                          ? 'text-[#8198ed] animate-pulse'
                          : 'text-white/40'
                      }`}
                    >
                      #{n + 1}
                    </span>
                    {isCurrent ? (
                      <span className="font-pixel text-[8px] sm:text-[9px] text-[#8198ed] flex items-center gap-1 animate-pulse font-bold">
                        <Sparkles className="w-3 h-3 animate-spin" />
                        <span>Ready</span>
                      </span>
                    ) : (
                      <span className="font-pixel text-[8px] sm:text-[9px] text-white/35 font-medium">
                        Pending
                      </span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* 3. BOTTOM: Action Buttons Bar */}
      <div className="flex items-center justify-center gap-2.5 sm:gap-4 shrink-0 py-1">
        {/* Back Button */}
        <div className="p-0.5 bg-white rounded-xl shadow-[0_4px_12px_rgba(100,120,190,0.18)]">
          <button
            type="button"
            onClick={handleBack}
            className="bg-[#9cb2f8] hover:bg-[#8ca8f5] active:translate-y-0.5 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-pixel text-xs tracking-wider shadow-[2px_2px_0px_#7088bc] transition-all cursor-pointer select-none flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>
        </div>

        {/* Start / Pause / Resume Button */}
        <div className="p-0.5 bg-white rounded-xl shadow-[0_4px_12px_rgba(100,120,190,0.18)]">
          <button
            type="button"
            disabled={status !== 'live'}
            onClick={() => {
              if (shooting) {
                togglePause()
              } else {
                runSequence()
              }
            }}
            className={`px-7 sm:px-12 py-2.5 sm:py-3 rounded-lg font-pixel text-xs sm:text-sm tracking-wider transition-all cursor-pointer select-none font-bold flex items-center gap-2 ${
              shooting && isPaused
                ? 'bg-[#10b981] hover:bg-[#059669] text-white shadow-[2px_2px_0px_#047857] animate-pulse ring-2 ring-emerald-300'
                : shooting && !isPaused
                ? 'bg-[#f59e0b] hover:bg-[#d97706] text-white shadow-[2px_2px_0px_#b45309]'
                : 'bg-[#8198ed] hover:bg-[#6e88e8] text-white shadow-[2px_2px_0px_#5b6fbc]'
            } active:translate-y-0.5 disabled:opacity-50`}
          >
            {shooting ? (
              isPaused ? (
                <>
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Resume</span>
                </>
              ) : (
                <>
                  <Pause className="w-3.5 h-3.5 fill-white" />
                  <span>Pause</span>
                </>
              )
            ) : (
              <>
                <Camera className="w-3.5 h-3.5" />
                <span>Start</span>
              </>
            )}
          </button>
        </div>

        {/* Retake Button */}
        <div className="p-0.5 bg-white rounded-xl shadow-[0_4px_12px_rgba(100,120,190,0.18)]">
          <button
            type="button"
            disabled={shots.length === 0}
            onClick={handleRetake}
            className="bg-[#9cb2f8] hover:bg-[#8ca8f5] active:translate-y-0.5 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-pixel text-xs tracking-wider shadow-[2px_2px_0px_#7088bc] transition-all cursor-pointer select-none disabled:opacity-50 flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retake</span>
          </button>
        </div>

        {/* Confirm Button */}
        <div className="p-0.5 bg-white rounded-xl shadow-[0_4px_12px_rgba(100,120,190,0.18)]">
          <button
            type="button"
            disabled={!done || shooting}
            onClick={() => onConfirm(shots)}
            className="bg-[#52b788] hover:bg-[#40916c] active:translate-y-0.5 text-white px-5 sm:px-8 py-2.5 sm:py-3 rounded-lg font-pixel text-xs sm:text-sm tracking-wider shadow-[2px_2px_0px_#2d6a4f] transition-all cursor-pointer select-none font-bold disabled:opacity-50 flex items-center gap-1.5"
          >
            <span>Confirm</span>
            <Check className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
