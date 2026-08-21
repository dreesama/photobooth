import { useCallback, useEffect, useRef, useState } from 'react'

type CameraStatus = 'idle' | 'starting' | 'live' | 'denied' | 'error'

// Manages the webcam MediaStream lifecycle and binds it to a <video> ref.
export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [status, setStatus] = useState<CameraStatus>('idle')

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setStatus('idle')
  }, [])

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('error')
      return
    }
    setStatus('starting')

    let stream: MediaStream | null = null

    // Multi-tier fallback to support all webcams (1080p, 720p, 480p, virtual cameras)
    try {
      // Tier 1: Ideal Full HD
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1440 },
          facingMode: 'user',
        },
        audio: false,
      })
    } catch {
      try {
        // Tier 2: Standard 720p
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user',
          },
          audio: false,
        })
      } catch {
        try {
          // Tier 3: Basic universal video constraint (guaranteed to work on any camera)
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          })
        } catch (err) {
          const denied =
            err instanceof DOMException &&
            (err.name === 'NotAllowedError' || err.name === 'SecurityError')
          setStatus(denied ? 'denied' : 'error')
          return
        }
      }
    }

    if (stream) {
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(() => {})
        }
      }
      setStatus('live')
    }
  }, [])

  useEffect(() => () => stop(), [stop])

  return { videoRef, status, start, stop }
}
