import { useCallback, useEffect, useRef, useState } from 'react'
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

const CAP_W = 520
const CAP_H = 390

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

function snapshot(
  video: HTMLVideoElement,
  prop: PropDef,
  metrics?: FaceMetrics
): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = CAP_W
  c.height = CAP_H
  const ctx = c.getContext('2d')!
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

  // Draw mirrored video frame
  ctx.translate(CAP_W, 0)
  ctx.scale(-1, 1)
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, CAP_W, CAP_H)

  const im = propImage(prop.src)
  if (im && im.complete && im.naturalWidth) {
    if (metrics && metrics.hasFace) {
      const anchor = prop.anchor || 'forehead'
      let pt = metrics.forehead
      if (anchor === 'eyes') pt = metrics.eyeCenter
      else if (anchor === 'nose') pt = metrics.nose
      else if (anchor === 'ear') pt = { x: metrics.earLeft.x - 0.04, y: metrics.earLeft.y }

      const px = pt.x * CAP_W
      const py = (pt.y + (prop.offsetY || -0.15)) * CAP_H

      const baseWidth = CAP_W * (anchor === 'ear' ? 0.24 : 0.38)
      const pw = baseWidth * metrics.scale * (prop.scaleFactor || 1.3)
      const ph = pw * (im.naturalHeight / im.naturalWidth)

      ctx.save()
      ctx.translate(px, py)
      ctx.rotate((-metrics.rotation * Math.PI) / 180)
      ctx.drawImage(im, -pw / 2, -ph / 2, pw, ph)
      ctx.restore()
    } else {
      const pw = CAP_W * (prop.anchor === 'ear' ? 0.25 : 0.5)
      const ph = pw * (im.naturalHeight / im.naturalWidth)
      const px = prop.anchor === 'ear' ? CAP_W * 0.2 : (CAP_W - pw) / 2
      ctx.drawImage(im, px, CAP_H * 0.1, pw, ph)
    }
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  return c
}

export default function CameraStage({ template, onConfirm, onBack }: Props) {
  const { videoRef, status, start } = useCamera()
  const { metrics } = useFaceLandmarker(videoRef, true)

  const total = countFor(template)
  const [prop, setProp] = useState<PropDef>(PROPS[0])
  const [seconds, setSeconds] = useState(3)
  const [showTimerMenu, setShowTimerMenu] = useState(false)
  const [count, setCount] = useState<number | null>(null)
  const [shots, setShots] = useState<HTMLCanvasElement[]>([])
  const [shooting, setShooting] = useState(false)
  const [flash, setFlash] = useState(false)

  const metricsRef = useRef<FaceMetrics>(metrics)
  useEffect(() => {
    metricsRef.current = metrics
  }, [metrics])

  useEffect(() => {
    start()
    loadProps()
  }, [start])

  const runSequence = useCallback(async () => {
    if (shooting || !videoRef.current) return
    setShooting(true)
    setShots([])
    const grabbed: HTMLCanvasElement[] = []
    for (let i = 0; i < total; i++) {
      for (let s = seconds; s > 0; s--) {
        setCount(s)
        await new Promise((r) => setTimeout(r, 1000))
      }
      setCount(null)
      setFlash(true)
      playShutterSound()
      setTimeout(() => setFlash(false), 450)

      grabbed.push(snapshot(videoRef.current, prop, metricsRef.current))
      setShots([...grabbed])
      await new Promise((r) => setTimeout(r, 700))
    }
    setShooting(false)
  }, [shooting, videoRef, total, seconds, prop])

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

  // Wearable prop overlay positioning
  let propStyle: React.CSSProperties = { top: '4%', left: '50%', width: '50%', transform: 'translateX(-50%)' }
  if (prop.src && metrics.hasFace) {
    const anchor = prop.anchor || 'forehead'
    if (anchor === 'ear') {
      // Mirrored space: earRight on face corresponds to left ear on mirrored video screen
      const leftPct = (1 - metrics.earRight.x + 0.04) * 100
      const topPct = (metrics.earRight.y + (prop.offsetY || -0.02)) * 100
      const scale = metrics.scale * (prop.scaleFactor || 0.85)

      propStyle = {
        position: 'absolute',
        left: `${leftPct}%`,
        top: `${topPct}%`,
        width: `${24 * scale}%`,
        transform: `translate(-50%, -50%) rotate(${metrics.rotation}deg)`,
        transition: 'transform 0.05s linear, left 0.05s linear, top 0.05s linear',
      }
    } else {
      const pt =
        anchor === 'eyes'
          ? metrics.eyeCenter
          : anchor === 'nose'
          ? metrics.nose
          : metrics.forehead

      const leftPct = (1 - pt.x) * 100
      const topPct = (pt.y + (prop.offsetY || -0.15)) * 100
      const scale = metrics.scale * (prop.scaleFactor || 1.3)

      propStyle = {
        position: 'absolute',
        left: `${leftPct}%`,
        top: `${topPct}%`,
        width: `${38 * scale}%`,
        transform: `translate(-50%, -50%) rotate(${metrics.rotation}deg)`,
        transition: 'transform 0.05s linear, left 0.05s linear, top 0.05s linear',
      }
    }
  }

  return (
    <div className="flex flex-col gap-2.5 w-full max-w-[760px] mx-auto">
      {/* Row 1: Props square buttons matching original UI 1:1 */}
      <div className="flex items-center justify-center gap-1.5 flex-wrap">
        {PROPS.map((p) => (
          <button
            key={p.id}
            onClick={() => setProp(p)}
            title={p.label}
            className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl grid place-items-center bg-white overflow-hidden transition-all ${
              prop.id === p.id
                ? 'bevel-in !border-[#8198ed] !border-2 shadow-inner bg-[#eef2ff]'
                : 'bevel-in hover:bg-[#f8fafc]'
            }`}
          >
            {p.src ? (
              <img src={p.src} alt={p.label} className="w-8 h-8 sm:w-9 sm:h-9 object-contain" />
            ) : (
              <span className="text-[#8198ed] text-base font-bold">✕</span>
            )}
          </button>
        ))}
      </div>

      {/* Row 2: Timer dropdown on left, shot counter on right */}
      <div className="flex items-center justify-between px-1">
        <div className="relative">
          <button
            onClick={() => setShowTimerMenu((v) => !v)}
            className="font-pixel text-[9px] text-[#8198ed] bg-white bevel-in px-2.5 py-1 flex items-center gap-1"
          >
            <span>{seconds}s</span>
            <span className="text-[7px]">▼</span>
          </button>
          {showTimerMenu && (
            <div className="absolute top-full left-0 mt-1 bg-white bevel-in z-20 shadow-md flex flex-col p-1 gap-1">
              {[3, 5, 10].map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setSeconds(s)
                    setShowTimerMenu(false)
                  }}
                  className={`font-pixel text-[8px] px-2.5 py-1 text-left rounded ${
                    seconds === s ? 'bg-[#8198ed] text-white' : 'text-[#8792c4] hover:bg-[#eef2ff]'
                  }`}
                >
                  {s}s
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {metrics.hasFace && (
            <span className="font-pixel text-[8px] text-[#8792c4] bg-white bevel-in px-2 py-0.5">
              {metrics.expression === 'smile' ? '😊 Ready' : 'Ready'}
            </span>
          )}
          <span className="font-pixel text-[9px] text-[#8792c4]">
            {shots.length}/{total}
          </span>
        </div>
      </div>

      {/* Main Row: Live Video + Layout Box */}
      <div className="grid gap-3 md:grid-cols-[1fr_150px] items-start">
        {/* Video feed box */}
        <div className="relative bg-black bevel-in overflow-hidden aspect-[4/3] rounded-lg">
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full h-full object-cover -scale-x-100"
          />

          {/* Tracked wearable prop */}
          {prop.src && (
            <img
              src={prop.src}
              alt=""
              className="pointer-events-none select-none"
              style={propStyle}
            />
          )}

          {/* Flash animation */}
          {flash && <div className="absolute inset-0 bg-white flash pointer-events-none" />}

          {/* Countdown timer */}
          {count !== null && (
            <div className="absolute inset-0 grid place-items-center pointer-events-none">
              <span className="font-pixel text-white text-5xl sm:text-6xl drop-shadow-[3px_3px_0_rgba(91,111,188,0.95)]">
                {count}
              </span>
            </div>
          )}

          {/* Status overlay */}
          {status !== 'live' && (
            <div className="absolute inset-0 grid place-items-center text-center p-4 bg-black/80">
              <div className="font-crt text-lg sm:text-xl text-white/90 leading-tight">
                {status === 'starting' && 'waking up camera…'}
                {status === 'denied' && 'camera blocked — allow access.'}
                {status === 'error' && 'no camera found.'}
                {status === 'idle' && 'starting camera…'}
              </div>
            </div>
          )}
        </div>

        {/* Layout preview box - fixed to never overflow shots */}
        <div className="flex flex-col items-center">
          <p className="font-pixel text-[9px] text-[#8198ed] mb-1">Layout</p>
          <div className="bevel-in bg-white p-2 w-full max-w-[140px] flex flex-col items-center rounded-lg overflow-hidden shadow-sm">
            <div
              className="w-full grid gap-1 overflow-hidden"
              style={{ gridTemplateColumns: `repeat(${template.cols}, 1fr)` }}
            >
              {Array.from({ length: total }).map((_, n) => (
                <div
                  key={n}
                  className="bg-[#eef2ff] border border-[#d4dcf7] aspect-[4/3] grid place-items-center overflow-hidden rounded-sm w-full"
                >
                  {shots[n] ? (
                    <img
                      src={shots[n].toDataURL()}
                      alt=""
                      className="w-full h-full object-cover block"
                    />
                  ) : (
                    <span className="font-pixel text-[9px] text-[#8198ed] opacity-50">
                      {n + 1}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <p className="font-pixel text-[6px] text-center text-[#8792c4] mt-2 tracking-wider">
              OmoideCam
            </p>
          </div>
          {/* Pagination indicator dots */}
          <div className="flex gap-1 mt-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#8198ed]" />
            <span className="w-1.5 h-1.5 rounded-full bg-[#cdd6f0]" />
          </div>
        </div>
      </div>

      {/* Bottom control bar inside window: centered buttons */}
      <div className="flex items-center justify-center gap-2.5 mt-1">
        <button
          className="btn95 is-primary !px-5 !py-2 text-xs flex items-center gap-1 font-bold"
          disabled={status !== 'live' || shooting}
          onClick={runSequence}
        >
          <span>{shooting ? 'Stop' : 'Start'}</span>
          <span className="text-[9px]">▸</span>
        </button>
        <button
          className="btn95 !px-4 !py-2 text-xs font-bold"
          onClick={() => setShots([])}
          disabled={shooting}
        >
          Retake
        </button>
        <button
          className="btn95 is-accent !px-4 !py-2 text-xs font-bold"
          disabled={!done || shooting}
          onClick={() => onConfirm(shots)}
        >
          Confirm
        </button>
      </div>
    </div>
  )
}
