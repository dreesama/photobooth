import { useEffect, useRef, useState, useCallback } from 'react'
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision'
import {
  computeFaceMetrics,
  lerpFaceMetrics,
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
  const lastTimeRef = useRef<number>(-1)
  const currentMetricsRef = useRef<FaceMetrics>(DEFAULT_FACE_METRICS)

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

  const detectFrame = useCallback(() => {
    const video = videoRef.current
    const landmarker = landmarkerRef.current

    if (
      enabled &&
      video &&
      video.readyState >= 2 &&
      !video.paused &&
      !video.ended
    ) {
      const now = performance.now()
      if (now !== lastTimeRef.current) {
        lastTimeRef.current = now
        try {
          let target = DEFAULT_FACE_METRICS
          if (landmarker) {
            const results = landmarker.detectForVideo(video, now)
            if (results.faceLandmarks && results.faceLandmarks.length > 0) {
              target = computeFaceMetrics(results.faceLandmarks[0])
            }
          }
          const smoothed = lerpFaceMetrics(currentMetricsRef.current, target, 0.35)
          currentMetricsRef.current = smoothed
          setMetrics(smoothed)
        } catch {
          // ignore tracking frame errors
        }
      }
    }

    if (enabled) {
      animRef.current = requestAnimationFrame(detectFrame)
    }
  }, [videoRef, enabled])

  useEffect(() => {
    if (enabled) {
      animRef.current = requestAnimationFrame(detectFrame)
    } else {
      setMetrics(DEFAULT_FACE_METRICS)
    }
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [enabled, detectFrame])

  return { metrics, isReady }
}
