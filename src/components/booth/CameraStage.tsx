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

  // Wearable prop overlay positioning on live video
  let propStyle: React.CSSProperties = { top: '4%', left: '50%', width: '50%', transform: 'translateX(-50%)' }
  if (prop.src && metrics.hasFace) {
    const anchor = prop.anchor || 'forehead'
    if (anchor === 'ear') {
      const leftPct = (1 - metrics.earRight.x + 0.04) * 100
      const topPct = (metrics.earRight.y + (prop.offsetY || -0.02)) * 100
      const scale = metrics.scale * (prop.scaleFactor || 1.3)

      propStyle = {
        position: 'absolute',
        left: `${leftPct}%`,
        top: `${topPct}%`,
        width: `${28 * scale}%`,
        transform: `translate(-50%, -50%) rotate(${metrics.rotation}deg)`,
        transition: 'transform 0.05s linear, left 0.05s linear, top 0.05s linear',
      }
    } else {
      let pt = metrics.forehead
      if (anchor === 'eyes') pt = metrics.eyeCenter
      else if (anchor === 'nose') pt = metrics.nose

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
    <div className="w-full flex flex-col items-center gap-4 py-2 select-none">
      {/* Row 1: Large Touch-Friendly Wearable Props Buttons */}
      <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
        {PROPS.map((p) => (
          <button
            key={p.id}
            onClick={() => setProp(p)}
            title={p.label}
            className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl grid place-items-center bg-white shadow-md transition-all cursor-pointer ${prop.id === p.id
              ? 'ring-3 ring-[#8198ed] border-2 border-[#5b7fcb] bg-[#eef2ff] scale-110 shadow-lg'
              : 'border border-slate-200 hover:border-[#8198ed] hover:scale-105'
              }`}
          >
            {p.src ? (
              <img src={p.src} alt={p.label} className="size-10 sm:size-11 object-contain pointer-events-none" />
            ) : (
              <span className="text-[#ff5c8a] text-xl font-bold font-mono">✕</span>
            )}
          </button>
        ))}
      </div>

      {/* Main Row: Large Live Camera Stage + Clear Right-Side Strip Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-5 sm:gap-8 items-center justify-center w-full max-w-5xl">
        {/* Large Video Box */}
        <div className="relative bg-black rounded-2xl overflow-hidden aspect-[4/3] w-full max-w-3xl mx-auto shadow-2xl border-4 border-white/90">
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full h-full object-cover -scale-x-100"
          />

          {/* Tracked Wearable Prop */}
          {prop.src && (
            <img
              src={prop.src}
              alt=""
              className="pointer-events-none select-none"
              style={propStyle}
            />
          )}

          {/* Flash Effect */}
          {flash && <div className="absolute inset-0 bg-white flash pointer-events-none" />}

          {/* Countdown Display */}
          {count !== null && (
            <div className="absolute inset-0 grid place-items-center pointer-events-none">
              <span className="font-pixel text-white text-6xl sm:text-7xl md:text-8xl drop-shadow-[0_6px_0_rgba(91,111,188,0.95)]">
                {count}
              </span>
            </div>
          )}

          {/* Camera Status Overlay */}
          {status !== 'live' && (
            <div className="absolute inset-0 grid place-items-center text-center p-4 bg-black/85">
              <div className="font-pixel text-sm sm:text-base text-white/90 leading-relaxed">
                {status === 'starting' && 'Connecting camera…'}
                {status === 'denied' && 'Camera access blocked. Please allow camera permissions.'}
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
              <span>⏱ {seconds}s</span>
              <span className="text-[8px]">▼</span>
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
                    className={`font-pixel text-[9px] px-3 py-1.5 text-left rounded-lg transition-colors cursor-pointer ${seconds === s
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
              <span className="font-pixel text-[9px] text-[#5b7fcb] bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-lg shadow-md">
                {metrics.expression === 'smile' ? '😊 Smile!' : '👤 Face Locked'}
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
              width: template.cols === 2 ? 'clamp(280px, 28vw, 360px)' : 'clamp(200px, 20vw, 260px)',
            }}
          >
            {/* Photo Slots Grid with straight edges */}
            <div
              className="grid gap-2 sm:gap-2.5 w-full"
              style={{ gridTemplateColumns: `repeat(${template.cols}, 1fr)` }}
            >
              {Array.from({ length: total }).map((_, n) => (
                <div
                  key={n}
                  className="relative bg-[#101420] aspect-[4/3] overflow-hidden grid place-items-center w-full"
                >
                  {shots[n] ? (
                    <img
                      src={shots[n].toDataURL()}
                      alt=""
                      className="w-full h-full object-cover block"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-1">
                      <span className="font-pixel text-sm sm:text-base text-white/40 font-bold">
                        #{n + 1}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Polaroid Bottom White Chin with Blue Logo */}
            <p className="font-pixel text-[11px] sm:text-xs text-[#5b7fcb] text-center mt-3 sm:mt-4 tracking-wider select-none">
              OmoideCam
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
            className="bg-[#9cb2f8] hover:bg-[#8ca8f5] active:translate-y-0.5 text-white px-5 sm:px-6 py-2.5 sm:py-3 rounded-lg font-pixel text-xs tracking-wider shadow-[3px_3px_0px_#7088bc] transition-all cursor-pointer select-none"
          >
            ← Back
          </button>
        </div>

        {/* Start / Snap Button */}
        <div className="p-1 bg-white rounded-xl shadow-[0_4px_12px_rgba(100,120,190,0.18)]">
          <button
            type="button"
            disabled={status !== 'live' || shooting}
            onClick={runSequence}
            className="bg-[#8198ed] hover:bg-[#6e88e8] active:translate-y-0.5 text-white px-8 sm:px-12 py-2.5 sm:py-3 rounded-lg font-pixel text-xs sm:text-sm tracking-wider shadow-[3px_3px_0px_#5b6fbc] transition-all cursor-pointer select-none font-bold disabled:opacity-50"
          >
            {shooting ? 'Capturing…' : 'Start'}
          </button>
        </div>

        {/* Retake Button */}
        <div className="p-1 bg-white rounded-xl shadow-[0_4px_12px_rgba(100,120,190,0.18)]">
          <button
            type="button"
            disabled={shooting || shots.length === 0}
            onClick={() => setShots([])}
            className="bg-[#9cb2f8] hover:bg-[#8ca8f5] active:translate-y-0.5 text-white px-5 sm:px-6 py-2.5 sm:py-3 rounded-lg font-pixel text-xs tracking-wider shadow-[3px_3px_0px_#7088bc] transition-all cursor-pointer select-none disabled:opacity-50"
          >
            Retake
          </button>
        </div>

        {/* Confirm Button */}
        <div className="p-1 bg-white rounded-xl shadow-[0_4px_12px_rgba(100,120,190,0.18)]">
          <button
            type="button"
            disabled={!done || shooting}
            onClick={() => onConfirm(shots)}
            className="bg-[#8198ed] hover:bg-[#6e88e8] active:translate-y-0.5 text-white px-6 sm:px-8 py-2.5 sm:py-3 rounded-lg font-pixel text-xs sm:text-sm tracking-wider shadow-[3px_3px_0px_#5b6fbc] transition-all cursor-pointer select-none font-bold disabled:opacity-50"
          >
            Confirm ›
          </button>
        </div>
      </div>
    </div>
  )
}
