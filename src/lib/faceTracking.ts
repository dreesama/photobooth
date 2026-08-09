export interface Point2D {
  x: number
  y: number
}

export type ExpressionType = 'smile' | 'surprised' | 'neutral'

export interface FaceMetrics {
  hasFace: boolean
  x: number // 0..1 normalized center
  y: number // 0..1 normalized center
  scale: number // relative scale (1.0 default)
  rotation: number // roll rotation in degrees
  faceWidth: number // normalized distance across temples
  expression: ExpressionType
  smileScore: number // 0..1
  forehead: Point2D
  eyeCenter: Point2D
  nose: Point2D
  earLeft: Point2D
  earRight: Point2D
}

export const DEFAULT_FACE_METRICS: FaceMetrics = {
  hasFace: false,
  x: 0.5,
  y: 0.25,
  scale: 1.0,
  rotation: 0,
  faceWidth: 0.28,
  expression: 'neutral',
  smileScore: 0,
  forehead: { x: 0.5, y: 0.15 },
  eyeCenter: { x: 0.5, y: 0.25 },
  nose: { x: 0.5, y: 0.32 },
  earLeft: { x: 0.35, y: 0.28 },
  earRight: { x: 0.65, y: 0.28 },
}

export function computeFaceMetrics(landmarks: Array<Point2D>): FaceMetrics {
  if (!landmarks || landmarks.length < 357) {
    return DEFAULT_FACE_METRICS
  }

  // Key MediaPipe FaceLandmarker indices:
  // 10: Top forehead center
  // 9: Lower forehead
  // 127: Left temple/ear area
  // 356: Right temple/ear area
  // 1: Nose tip
  // 33: Left eye outer
  // 263: Right eye outer
  // 61: Mouth left corner
  // 291: Mouth right corner
  // 13: Upper lip
  // 14: Lower lip
  const foreheadPt = landmarks[10] || landmarks[9] || { x: 0.5, y: 0.2 }
  const leftTemple = landmarks[127] || { x: 0.35, y: 0.3 }
  const rightTemple = landmarks[356] || { x: 0.65, y: 0.3 }
  const nosePt = landmarks[1] || { x: 0.5, y: 0.35 }
  const leftEye = landmarks[33] || { x: 0.4, y: 0.25 }
  const rightEye = landmarks[263] || { x: 0.6, y: 0.25 }
  const leftMouth = landmarks[61] || { x: 0.42, y: 0.45 }
  const rightMouth = landmarks[291] || { x: 0.58, y: 0.45 }
  const upperLip = landmarks[13] || { x: 0.5, y: 0.43 }
  const lowerLip = landmarks[14] || { x: 0.5, y: 0.47 }

  // 1. Calculate roll angle (tilt of head) from temples
  const dx = rightTemple.x - leftTemple.x
  const dy = rightTemple.y - leftTemple.y
  const rotation = Math.atan2(dy, dx) * (180 / Math.PI)

  // 2. Calculate face width and relative scale
  const faceWidth = Math.hypot(dx, dy)
  const baseWidth = 0.28 // reference face width ratio
  const scale = Math.min(2.5, Math.max(0.4, faceWidth / baseWidth))

  // 3. Eye center
  const eyeCenter: Point2D = {
    x: (leftEye.x + rightEye.x) / 2,
    y: (leftEye.y + rightEye.y) / 2,
  }

  // 4. Expression detection (Smile / Surprised / Neutral)
  const mouthWidth = Math.hypot(rightMouth.x - leftMouth.x, rightMouth.y - leftMouth.y)
  const mouthHeight = Math.hypot(lowerLip.y - upperLip.y, lowerLip.x - upperLip.x)
  const mouthRatio = faceWidth > 0 ? mouthWidth / faceWidth : 0.4
  const openRatio = faceWidth > 0 ? mouthHeight / faceWidth : 0.1

  const smileScore = Math.min(1, Math.max(0, (mouthRatio - 0.41) / 0.16))

  let expression: ExpressionType = 'neutral'
  if (smileScore > 0.45) {
    expression = 'smile'
  } else if (openRatio > 0.15) {
    expression = 'surprised'
  }

  return {
    hasFace: true,
    x: foreheadPt.x,
    y: foreheadPt.y,
    scale,
    rotation,
    faceWidth,
    expression,
    smileScore,
    forehead: foreheadPt,
    eyeCenter,
    nose: nosePt,
    earLeft: leftTemple,
    earRight: rightTemple,
  }
}

// Exponential lerp smoothing function to eliminate noise and jitter
export function lerpFaceMetrics(current: FaceMetrics, target: FaceMetrics, alpha = 0.35): FaceMetrics {
  if (!target.hasFace) return { ...current, hasFace: false }
  if (!current.hasFace) return target

  return {
    hasFace: true,
    x: current.x + (target.x - current.x) * alpha,
    y: current.y + (target.y - current.y) * alpha,
    scale: current.scale + (target.scale - current.scale) * alpha,
    rotation: current.rotation + (target.rotation - current.rotation) * alpha,
    faceWidth: current.faceWidth + (target.faceWidth - current.faceWidth) * alpha,
    expression: target.expression,
    smileScore: current.smileScore + (target.smileScore - current.smileScore) * alpha,
    forehead: {
      x: current.forehead.x + (target.forehead.x - current.forehead.x) * alpha,
      y: current.forehead.y + (target.forehead.y - current.forehead.y) * alpha,
    },
    eyeCenter: {
      x: current.eyeCenter.x + (target.eyeCenter.x - current.eyeCenter.x) * alpha,
      y: current.eyeCenter.y + (target.eyeCenter.y - current.eyeCenter.y) * alpha,
    },
    nose: {
      x: current.nose.x + (target.nose.x - current.nose.x) * alpha,
      y: current.nose.y + (target.nose.y - current.nose.y) * alpha,
    },
    earLeft: {
      x: current.earLeft.x + (target.earLeft.x - current.earLeft.x) * alpha,
      y: current.earLeft.y + (target.earLeft.y - current.earLeft.y) * alpha,
    },
    earRight: {
      x: current.earRight.x + (target.earRight.x - current.earRight.x) * alpha,
      y: current.earRight.y + (target.earRight.y - current.earRight.y) * alpha,
    },
  }
}
