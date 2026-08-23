import { useEffect, useRef, useState, useCallback } from 'react'
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision'
import {
  computeFaceMetrics,
  FaceMetricsFilter,
  DEFAULT_FACE_METRICS,
  type FaceMetrics,
} from '../lib/faceTracking'

let landmarkerPromise: Promise<FaceLandmarker> | null = null

async function getFaceLandmarker(): Promise<FaceLandmarker> {
  if (landmarkerPromise) return landmarkerPromise
  landmarkerPromise = (async () => {
    const filesetResolver = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
    )
    return FaceLandmarker.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate: 'GPU',
      },
      outputFaceBlendshapes: false,
      runningMode: 'VIDEO',
      numFaces: 1,
    })
  })()
  return landmarkerPromise
}

export function useFaceLandmarker(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  enabled: boolean = true
) {
  const [metrics, setMetrics] = useState<FaceMetrics>(DEFAULT_FACE_METRICS)
  const [isReady, setIsReady] = useState(false)
  const landmarkerRef = useRef<FaceLandmarker | null>(null)
  const animRef = useRef<number | null>(null)
  const vfcHandleRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number>(-1)
  const currentMetricsRef = useRef<FaceMetrics>(DEFAULT_FACE_METRICS)
  const filterRef = useRef<FaceMetricsFilter>(new FaceMetricsFilter())
  const lastStateNotifyRef = useRef<{ hasFace: boolean; expression: string }>({
    hasFace: false,
    expression: 'neutral',
  })

  useEffect(() => {
    let mounted = true
    getFaceLandmarker()
      .then((lm) => {
        if (mounted) {
          landmarkerRef.current = lm
          setIsReady(true)
        }
      })
      .catch((err) => {
        console.warn('FaceLandmarker load failed:', err)
      })
    return () => {
      mounted = false
    }
  }, [])

  const processDetection = useCallback(
    (now: number) => {
      const video = videoRef.current
      const landmarker = landmarkerRef.current

      if (
        !enabled ||
        !video ||
        video.readyState < 2 ||
        video.paused ||
        video.ended
      ) {
        return
      }

      if (now !== lastTimeRef.current) {
        lastTimeRef.current = now
        try {
          let target = DEFAULT_FACE_METRICS
          if (landmarker) {
            const results = landmarker.detectForVideo(video, now)
            if (results.faceLandmarks && results.faceLandmarks.length > 0) {
              const vw = video.videoWidth || 1280
              const vh = video.videoHeight || 720
              target = computeFaceMetrics(results.faceLandmarks[0], vw, vh, 4 / 3)
            }
          }

          let smoothed: FaceMetrics
          if (target.hasFace) {
            smoothed = filterRef.current.filter(target, now)
          } else {
            filterRef.current.reset()
            smoothed = DEFAULT_FACE_METRICS
          }

          currentMetricsRef.current = smoothed

          // Check if high-level discrete state changed (e.g. face locked, smile badge)
          // To prevent 60fps React re-renders from throttling performance, only update
          // React state when discrete visual status changes or on periodic interval
          const prev = lastStateNotifyRef.current
          const stateChanged =
            prev.hasFace !== smoothed.hasFace ||
            prev.expression !== smoothed.expression

          if (stateChanged) {
            lastStateNotifyRef.current = {
              hasFace: smoothed.hasFace,
              expression: smoothed.expression,
            }
            setMetrics(smoothed)
          }
        } catch {
          // ignore tracking frame errors
        }
      }
    },
    [videoRef, enabled]
  )

  const loop = useCallback(() => {
    if (!enabled) return

    const video = videoRef.current
    if (video && 'requestVideoFrameCallback' in video) {
      vfcHandleRef.current = (video as any).requestVideoFrameCallback(
        (now: number) => {
          processDetection(now)
          loop()
        }
      )
    } else {
      processDetection(performance.now())
      animRef.current = requestAnimationFrame(loop)
    }
  }, [enabled, processDetection, videoRef])

  useEffect(() => {
    if (enabled) {
      loop()
    } else {
      filterRef.current.reset()
      currentMetricsRef.current = DEFAULT_FACE_METRICS
      setMetrics(DEFAULT_FACE_METRICS)
    }

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      const video = videoRef.current
      if (
        video &&
        'cancelVideoFrameCallback' in video &&
        vfcHandleRef.current !== null
      ) {
        ;(video as any).cancelVideoFrameCallback(vfcHandleRef.current)
      }
    }
  }, [enabled, loop, videoRef])

  return { metrics, metricsRef: currentMetricsRef, isReady }
}
