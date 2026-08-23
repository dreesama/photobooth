export interface Point2D {
  x: number
  y: number
}

export type ExpressionType = 'smile' | 'surprised' | 'neutral'

export interface FaceMetrics {
  hasFace: boolean
  x: number // 0..1 normalized in target 4:3 space
  y: number // 0..1 normalized in target 4:3 space
  scale: number // relative scale (1.0 default)
  rotation: number // roll rotation in degrees
  pitch: number // pitch tilt in degrees (-30 to +30)
  yaw: number // yaw turn (-1 to 1)
  faceWidth: number // normalized distance across face in target space
  expression: ExpressionType
  smileScore: number // 0..1
  forehead: Point2D // 4:3 mapped
  eyeCenter: Point2D // 4:3 mapped
  nose: Point2D // 4:3 mapped
  earLeft: Point2D // 4:3 mapped
  earRight: Point2D // 4:3 mapped
  rawForehead: Point2D // uncropped video space
  rawEyeCenter: Point2D
  rawNose: Point2D
  rawEarLeft: Point2D
  rawEarRight: Point2D
}

export const DEFAULT_FACE_METRICS: FaceMetrics = {
  hasFace: false,
  x: 0.5,
  y: 0.25,
  scale: 1.0,
  rotation: 0,
  pitch: 0,
  yaw: 0,
  faceWidth: 0.28,
  expression: 'neutral',
  smileScore: 0,
  forehead: { x: 0.5, y: 0.15 },
  eyeCenter: { x: 0.5, y: 0.25 },
  nose: { x: 0.5, y: 0.32 },
  earLeft: { x: 0.35, y: 0.28 },
  earRight: { x: 0.65, y: 0.28 },
  rawForehead: { x: 0.5, y: 0.15 },
  rawEyeCenter: { x: 0.5, y: 0.25 },
  rawNose: { x: 0.5, y: 0.32 },
  rawEarLeft: { x: 0.35, y: 0.28 },
  rawEarRight: { x: 0.65, y: 0.28 },
}

/**
 * Maps a normalized point (0..1) in raw video coordinates to display coordinates
 * accounting for object-cover cropping (e.g. 16:9 webcam in 4:3 container).
 */
export function mapNormalizedToDisplay(
  pt: Point2D,
  videoWidth: number,
  videoHeight: number,
  targetAspect = 4 / 3
): Point2D {
  if (!videoWidth || !videoHeight || videoWidth <= 0 || videoHeight <= 0) {
    return { ...pt }
  }
  const videoAspect = videoWidth / videoHeight
  if (videoAspect > targetAspect) {
    // Video is wider than target -> cropped horizontally on left and right
    const visibleRatio = targetAspect / videoAspect
    const cropX = (1 - visibleRatio) / 2
    return {
      x: (pt.x - cropX) / visibleRatio,
      y: pt.y,
    }
  } else {
    // Video is taller than target -> cropped vertically top and bottom
    const visibleRatio = videoAspect / targetAspect
    const cropY = (1 - visibleRatio) / 2
    return {
      x: pt.x,
      y: (pt.y - cropY) / visibleRatio,
    }
  }
}

/**
 * 1-Euro Filter implementation for adaptive, low-latency and jitter-free signal smoothing.
 * Casiez et al. (CHI 2012)
 */
export class OneEuroFilter {
  private minCutoff: number
  private beta: number
  private dCutoff: number
  private xPrev: number | null = null
  private dxPrev: number = 0
  private tPrev: number | null = null

  constructor(minCutoff = 1.2, beta = 0.008, dCutoff = 1.0) {
    this.minCutoff = minCutoff
    this.beta = beta
    this.dCutoff = dCutoff
  }

  private alpha(dt: number, cutoff: number): number {
    const tau = 1.0 / (2 * Math.PI * cutoff)
    return 1.0 / (1.0 + tau / dt)
  }

  filter(x: number, timestamp: number): number {
    if (this.tPrev === null || this.xPrev === null) {
      this.xPrev = x
      this.tPrev = timestamp
      this.dxPrev = 0
      return x
    }

    const dt = Math.max(0.001, (timestamp - this.tPrev) / 1000)
    this.tPrev = timestamp

    // Filter the derivative
    const dx = (x - this.xPrev) / dt
    const alphaD = this.alpha(dt, this.dCutoff)
    const dxHat = alphaD * dx + (1 - alphaD) * this.dxPrev
    this.dxPrev = dxHat

    // Filter the value with adaptive cutoff
    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat)
    const alphaV = this.alpha(dt, cutoff)
    const xHat = alphaV * x + (1 - alphaV) * this.xPrev
    this.xPrev = xHat

    return xHat
  }

  reset() {
    this.xPrev = null
    this.dxPrev = 0
    this.tPrev = null
  }
}

/**
 * Filter manager for full FaceMetrics structure using OneEuroFilter on each dynamic dimension.
 */
export class FaceMetricsFilter {
  private filters = {
    x: new OneEuroFilter(1.5, 0.01),
    y: new OneEuroFilter(1.5, 0.01),
    scale: new OneEuroFilter(1.0, 0.005),
    rotation: new OneEuroFilter(1.2, 0.008),
    pitch: new OneEuroFilter(1.0, 0.005),
    yaw: new OneEuroFilter(1.0, 0.005),
    faceWidth: new OneEuroFilter(1.0, 0.005),
    foreheadX: new OneEuroFilter(1.5, 0.01),
    foreheadY: new OneEuroFilter(1.5, 0.01),
    eyeCenterX: new OneEuroFilter(1.5, 0.01),
    eyeCenterY: new OneEuroFilter(1.5, 0.01),
    noseX: new OneEuroFilter(1.5, 0.01),
    noseY: new OneEuroFilter(1.5, 0.01),
    earLeftX: new OneEuroFilter(1.5, 0.01),
    earLeftY: new OneEuroFilter(1.5, 0.01),
    earRightX: new OneEuroFilter(1.5, 0.01),
    earRightY: new OneEuroFilter(1.5, 0.01),
  }

  filter(target: FaceMetrics, timestamp: number): FaceMetrics {
    if (!target.hasFace) {
      return { ...DEFAULT_FACE_METRICS, hasFace: false }
    }

    return {
      hasFace: true,
      x: this.filters.x.filter(target.x, timestamp),
      y: this.filters.y.filter(target.y, timestamp),
      scale: this.filters.scale.filter(target.scale, timestamp),
      rotation: this.filters.rotation.filter(target.rotation, timestamp),
      pitch: this.filters.pitch.filter(target.pitch, timestamp),
      yaw: this.filters.yaw.filter(target.yaw, timestamp),
      faceWidth: this.filters.faceWidth.filter(target.faceWidth, timestamp),
      expression: target.expression,
      smileScore: target.smileScore,
      forehead: {
        x: this.filters.foreheadX.filter(target.forehead.x, timestamp),
        y: this.filters.foreheadY.filter(target.forehead.y, timestamp),
      },
      eyeCenter: {
        x: this.filters.eyeCenterX.filter(target.eyeCenter.x, timestamp),
        y: this.filters.eyeCenterY.filter(target.eyeCenter.y, timestamp),
      },
      nose: {
        x: this.filters.noseX.filter(target.nose.x, timestamp),
        y: this.filters.noseY.filter(target.nose.y, timestamp),
      },
      earLeft: {
        x: this.filters.earLeftX.filter(target.earLeft.x, timestamp),
        y: this.filters.earLeftY.filter(target.earLeft.y, timestamp),
      },
      earRight: {
        x: this.filters.earRightX.filter(target.earRight.x, timestamp),
        y: this.filters.earRightY.filter(target.earRight.y, timestamp),
      },
      rawForehead: target.rawForehead,
      rawEyeCenter: target.rawEyeCenter,
      rawNose: target.rawNose,
      rawEarLeft: target.rawEarLeft,
      rawEarRight: target.rawEarRight,
    }
  }

  reset() {
    Object.values(this.filters).forEach((f) => f.reset())
  }
}

/**
 * Computes comprehensive face metrics from MediaPipe FaceLandmarker points,
 * mapped to 4:3 target viewport.
 */
export function computeFaceMetrics(
  landmarks: Array<{ x: number; y: number; z?: number }>,
  videoWidth = 1280,
  videoHeight = 720,
  targetAspect = 4 / 3
): FaceMetrics {
  if (!landmarks || landmarks.length < 357) {
    return DEFAULT_FACE_METRICS
  }

  // Canonical MediaPipe Face Mesh Landmark indices:
  // 10: Forehead top / trichion hairline
  // 151: Upper forehead center
  // 9: Mid forehead
  // 168: Glabella / bridge between eyes
  // 1: Nose tip
  // 33: Right eye outer corner (subject's right, viewer's left in un-mirrored)
  // 263: Left eye outer corner (subject's left, viewer's right in un-mirrored)
  // 133: Right eye inner corner
  // 362: Left eye inner corner
  // 127: Right temple (subject's right)
  // 356: Left temple (subject's left)
  // 234: Right ear/cheek edge
  // 454: Left ear/cheek edge
  // 152: Chin bottom
  // 61: Mouth right corner
  // 291: Mouth left corner
  // 13: Upper lip
  // 14: Lower lip

  const rawForehead = landmarks[10] || landmarks[151] || landmarks[9] || { x: 0.5, y: 0.2 }
  const rawRightTemple = landmarks[127] || landmarks[234] || { x: 0.35, y: 0.3 }
  const rawLeftTemple = landmarks[356] || landmarks[454] || { x: 0.65, y: 0.3 }
  const rawNose = landmarks[1] || { x: 0.5, y: 0.35 }
  const rawRightEye = landmarks[33] || { x: 0.4, y: 0.25 }
  const rawLeftEye = landmarks[263] || { x: 0.6, y: 0.25 }
  const rawChin = landmarks[152] || { x: 0.5, y: 0.6 }
  const rawLeftMouth = landmarks[61] || { x: 0.42, y: 0.45 }
  const rawRightMouth = landmarks[291] || { x: 0.58, y: 0.45 }
  const rawUpperLip = landmarks[13] || { x: 0.5, y: 0.43 }
  const rawLowerLip = landmarks[14] || { x: 0.5, y: 0.47 }

  const rawEyeCenter = {
    x: (rawRightEye.x + rawLeftEye.x) / 2,
    y: (rawRightEye.y + rawLeftEye.y) / 2,
  }

  // 1. Roll angle (head tilt) derived from eye line and temple line
  const eyeDx = rawLeftEye.x - rawRightEye.x
  const eyeDy = rawLeftEye.y - rawRightEye.y
  const templeDx = rawLeftTemple.x - rawRightTemple.x
  const templeDy = rawLeftTemple.y - rawRightTemple.y
  const avgDx = eyeDx * 0.7 + templeDx * 0.3
  const avgDy = eyeDy * 0.7 + templeDy * 0.3
  const rotation = Math.atan2(avgDy, avgDx) * (180 / Math.PI)

  // 2. Face scale: Multi-metric scale (inter-ocular + vertical face height)
  // Prevents prop from shrinking/distorting when user turns their head sideways
  const interOcular = Math.hypot(eyeDx, eyeDy)
  const faceHeight = Math.hypot(rawChin.x - rawForehead.x, rawChin.y - rawForehead.y)
  const effectiveFaceSize = interOcular * 1.55 * 0.6 + faceHeight * 0.7 * 0.4
  const baseWidth = 0.28
  const scale = Math.min(2.5, Math.max(0.4, effectiveFaceSize / baseWidth))

  // 3. True Ear / Tragus landmarks
  // MediaPipe: 234 is subject's right cheek/ear tragus, 454 is subject's left cheek/ear tragus
  const earRightTragus = landmarks[234] || landmarks[127] || { x: 0.30, y: 0.33 }
  const earLeftTragus = landmarks[454] || landmarks[356] || { x: 0.70, y: 0.33 }

  // Subject's right ear (uncropped coords)
  const rawRightEar = {
    x: earRightTragus.x,
    y: earRightTragus.y,
  }
  // Subject's left ear (uncropped coords)
  const rawLeftEar = {
    x: earLeftTragus.x,
    y: earLeftTragus.y,
  }

  // 4. 3D Head Orientation (Yaw & Pitch)
  const yaw = Math.min(1, Math.max(-1, (rawNose.x - rawEyeCenter.x) / (interOcular * 0.8 || 0.1)))
  const expectedNoseDist = faceHeight * 0.28
  const actualNoseDist = rawNose.y - rawEyeCenter.y
  const pitch = Math.min(30, Math.max(-30, ((actualNoseDist - expectedNoseDist) / (faceHeight || 0.1)) * 90))

  // 5. Expression detection (Smile / Surprised / Neutral)
  const mouthWidth = Math.hypot(rawRightMouth.x - rawLeftMouth.x, rawRightMouth.y - rawLeftMouth.y)
  const mouthHeight = Math.hypot(rawLowerLip.y - rawUpperLip.y, rawLowerLip.x - rawUpperLip.x)
  const mouthRatio = interOcular > 0 ? mouthWidth / (interOcular * 1.3) : 0.4
  const openRatio = faceHeight > 0 ? mouthHeight / faceHeight : 0.05
  const smileScore = Math.min(1, Math.max(0, (mouthRatio - 0.40) / 0.16))

  let expression: ExpressionType = 'neutral'
  if (smileScore > 0.45) {
    expression = 'smile'
  } else if (openRatio > 0.14) {
    expression = 'surprised'
  }

  // 6. Map all anchors to 4:3 cropped target viewport coordinates
  const forehead = mapNormalizedToDisplay(rawForehead, videoWidth, videoHeight, targetAspect)
  const eyeCenter = mapNormalizedToDisplay(rawEyeCenter, videoWidth, videoHeight, targetAspect)
  const nose = mapNormalizedToDisplay(rawNose, videoWidth, videoHeight, targetAspect)
  const earLeft = mapNormalizedToDisplay(rawRightEar, videoWidth, videoHeight, targetAspect)
  const earRight = mapNormalizedToDisplay(rawLeftEar, videoWidth, videoHeight, targetAspect)

  const mappedTemples = Math.hypot(earRight.x - earLeft.x, earRight.y - earLeft.y)

  return {
    hasFace: true,
    x: forehead.x,
    y: forehead.y,
    scale,
    rotation,
    pitch,
    yaw,
    faceWidth: mappedTemples || baseWidth,
    expression,
    smileScore,
    forehead,
    eyeCenter,
    nose,
    earLeft,
    earRight,
    rawForehead,
    rawEyeCenter,
    rawNose,
    rawEarLeft: rawRightEar,
    rawEarRight: rawLeftEar,
  }
}

/**
 * Fallback static linear interpolation
 */
export function lerpFaceMetrics(current: FaceMetrics, target: FaceMetrics, alpha = 0.5): FaceMetrics {
  if (!target.hasFace) return { ...current, hasFace: false }
  if (!current.hasFace) return target

  return {
    hasFace: true,
    x: current.x + (target.x - current.x) * alpha,
    y: current.y + (target.y - current.y) * alpha,
    scale: current.scale + (target.scale - current.scale) * alpha,
    rotation: current.rotation + (target.rotation - current.rotation) * alpha,
    pitch: current.pitch + (target.pitch - current.pitch) * alpha,
    yaw: current.yaw + (target.yaw - current.yaw) * alpha,
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
    rawForehead: target.rawForehead,
    rawEyeCenter: target.rawEyeCenter,
    rawNose: target.rawNose,
    rawEarLeft: target.rawEarLeft,
    rawEarRight: target.rawEarRight,
  }
}
