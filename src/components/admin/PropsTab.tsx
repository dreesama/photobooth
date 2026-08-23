import { useState, useEffect, useRef } from 'react'
import {
  Plus,
  Eye,
  EyeOff,
  Trash2,
  Sparkles,
  Image as ImageIcon,
  Wand2,
  Info,
  Check,
  RotateCcw,
  Sliders,
  Camera,
  User,
  CheckCircle2,
} from 'lucide-react'
import {
  getCustomProps,
  saveCustomProp,
  deleteCustomProp,
  getHiddenAssets,
  toggleHideAsset,
  savePropConfig,
  resetPropConfig,
  type CustomProp,
} from '../../lib/db'
import { BUILTIN_PROPS, loadProps, propImage, type PropAnchor, type PropDef } from '../../lib/props'
import { removeBackground } from '../../lib/bgRemover'
import { useCamera } from '../../hooks/useCamera'
import { useFaceLandmarker } from '../../hooks/useFaceLandmarker'
import { drawPropOnCanvas } from '../booth/CameraStage'

export default function PropsTab({ onPropsChange }: { onPropsChange?: () => void }) {
  const [propsList, setPropsList] = useState<PropDef[]>([])
  const [customProps, setCustomProps] = useState<CustomProp[]>([])
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Modal State
  const [showModal, setShowModal] = useState(false)
  const [viewMode, setViewMode] = useState<'camera' | 'mannequin'>('camera')
  const [editingPropId, setEditingPropId] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const [anchor, setAnchor] = useState<PropAnchor>('forehead')
  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(-0.18)
  const [scaleFactor, setScaleFactor] = useState(1.4)
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  const [originalSrc, setOriginalSrc] = useState<string | null>(null)
  const [isRemovingBg, setIsRemovingBg] = useState(false)
  const [bgRemoved, setBgRemoved] = useState(false)
  const [showLandmarks, setShowLandmarks] = useState(true)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Live Camera AR Calibration inside Admin
  const { videoRef, status: cameraStatus, start: startCamera, stop: stopCamera } = useCamera()
  const { metrics, metricsRef } = useFaceLandmarker(
    videoRef,
    showModal && viewMode === 'camera'
  )
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  const loadData = async () => {
    const [data, hiddenAssets, loadedAllProps] = await Promise.all([
      getCustomProps(),
      getHiddenAssets(),
      loadProps(true),
    ])
    setCustomProps(data)
    setHiddenIds(new Set(hiddenAssets.props || []))
    setPropsList(loadedAllProps)
    onPropsChange?.()
  }

  useEffect(() => {
    loadData()
  }, [])

  // Start / stop camera when modal opens in camera mode
  useEffect(() => {
    if (showModal && viewMode === 'camera') {
      startCamera()
    } else {
      stopCamera()
    }
  }, [showModal, viewMode, startCamera, stopCamera])

  // Live Camera 60FPS AR Overlay in Admin Modal
  useEffect(() => {
    if (!showModal || viewMode !== 'camera') return
    let animId: number

    const renderLoop = () => {
      const canvas = overlayCanvasRef.current
      if (canvas && previewSrc) {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          const mockProp: PropDef = {
            id: editingPropId || 'preview',
            label,
            src: previewSrc,
            anchor,
            offsetX,
            offsetY,
            scaleFactor,
          }
          drawPropOnCanvas(
            ctx,
            canvas.width,
            canvas.height,
            mockProp,
            metricsRef.current,
            true
          )
        }
      }
      animId = requestAnimationFrame(renderLoop)
    }

    animId = requestAnimationFrame(renderLoop)
    return () => cancelAnimationFrame(animId)
  }, [showModal, viewMode, previewSrc, label, anchor, offsetX, offsetY, scaleFactor, editingPropId, metricsRef])

  const handleToggleHide = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    await toggleHideAsset('props', id)
    await loadData()
    showToast('Visibility updated')
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const src = reader.result as string
      setOriginalSrc(src)
      setPreviewSrc(src)
      setBgRemoved(false)
      if (!label.trim()) {
        setLabel(file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '))
      }
    }
    reader.readAsDataURL(file)
  }

  const handleMagicRemoveBg = async () => {
    if (!previewSrc || isRemovingBg) return
    setIsRemovingBg(true)
    try {
      const transparentDataUrl = await removeBackground(previewSrc, {
        tolerance: 35,
        targetColor: 'auto',
        feather: true,
      })
      setPreviewSrc(transparentDataUrl)
      setBgRemoved(true)
      showToast('✨ Background removed!')
    } catch (err) {
      console.warn('BG removal failed:', err)
    } finally {
      setIsRemovingBg(false)
    }
  }

  const handleRestoreOriginal = () => {
    if (originalSrc) {
      setPreviewSrc(originalSrc)
      setBgRemoved(false)
    }
  }

  const handleOpenUpload = () => {
    setEditingPropId(null)
    setLabel('')
    setPreviewSrc(null)
    setOriginalSrc(null)
    setAnchor('forehead')
    setOffsetX(0)
    setOffsetY(-0.18)
    setScaleFactor(1.4)
    setBgRemoved(false)
    setViewMode('camera')
    setShowModal(true)
  }

  const handleOpenEdit = (p: PropDef) => {
    setEditingPropId(p.id)
    setLabel(p.label)
    setPreviewSrc(p.src)
    setOriginalSrc(p.src)
    setAnchor(p.anchor || 'forehead')
    setOffsetX(p.offsetX ?? 0)
    setOffsetY(p.offsetY ?? (p.anchor === 'ear' || p.anchor === 'ear-left' ? -0.02 : -0.18))
    setScaleFactor(p.scaleFactor ?? (p.anchor === 'ear' || p.anchor === 'ear-left' ? 0.85 : 1.4))
    setBgRemoved(false)
    setViewMode('camera')
    setShowModal(true)
  }

  const [justSaved, setJustSaved] = useState(false)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!previewSrc || !label.trim()) return

    const isBuiltin = editingPropId && BUILTIN_PROPS.some((b) => b.id === editingPropId)

    if (isBuiltin && editingPropId) {
      // Save placement configuration override for built-in prop
      await savePropConfig(editingPropId, {
        anchor,
        offsetX,
        offsetY,
        scaleFactor,
      })
    } else if (editingPropId) {
      // Update custom prop
      const updatedProp: CustomProp = {
        id: editingPropId,
        label: label.trim(),
        src: previewSrc,
        anchor,
        offsetX,
        offsetY,
        scaleFactor,
        isCustom: true,
      }
      await saveCustomProp(updatedProp)
      await savePropConfig(editingPropId, { anchor, offsetX, offsetY, scaleFactor })
    } else {
      // Create brand new custom prop
      const id = `custom_prop_${Date.now()}`
      const newProp: CustomProp = {
        id,
        label: label.trim(),
        src: previewSrc,
        anchor,
        offsetX,
        offsetY,
        scaleFactor,
        isCustom: true,
      }
      await saveCustomProp(newProp)
      await savePropConfig(id, { anchor, offsetX, offsetY, scaleFactor })
      setEditingPropId(id)
    }

    await loadProps()
    await loadData()
    setJustSaved(true)
    setTimeout(() => setJustSaved(false), 2500)
    showToast('✅ Placement saved successfully! Changes are live in booth.')
  }

  const handleResetToDefault = async () => {
    if (!editingPropId) return
    const orig = BUILTIN_PROPS.find((b) => b.id === editingPropId)
    if (orig) {
      setAnchor(orig.anchor || 'forehead')
      setOffsetX(orig.offsetX ?? 0)
      setOffsetY(orig.offsetY ?? -0.18)
      setScaleFactor(orig.scaleFactor ?? 1.4)
      await resetPropConfig(editingPropId)
      await loadProps()
      await loadData()
      showToast('Reverted to default placement')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this custom prop?')) return
    await deleteCustomProp(id)
    await resetPropConfig(id)
    await loadData()
    showToast('Prop deleted')
  }

  // 2D Interactive Drag on Live Stage or Mannequin
  const stageRef = useRef<HTMLDivElement | null>(null)
  const isDraggingProp = useRef(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const initialOffset = useRef({ x: 0, y: 0 })

  const handleStagePointerDown = (e: React.PointerEvent) => {
    isDraggingProp.current = true
    dragStart.current = { x: e.clientX, y: e.clientY }
    initialOffset.current = { x: offsetX, y: offsetY }
    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    } catch {}
  }

  const handleStagePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingProp.current || !stageRef.current) return
    const stageRect = stageRef.current.getBoundingClientRect()
    if (!stageRect.width || !stageRect.height) return

    const dx = e.clientX - dragStart.current.x
    const dy = e.clientY - dragStart.current.y
    const deltaOffsetX = dx / stageRect.width
    const deltaOffsetY = dy / stageRect.height

    const nextOffsetX = Math.min(
      0.45,
      Math.max(-0.45, Number((initialOffset.current.x + deltaOffsetX).toFixed(2)))
    )
    const nextOffsetY = Math.min(
      0.45,
      Math.max(-0.45, Number((initialOffset.current.y + deltaOffsetY).toFixed(2)))
    )
    setOffsetX(nextOffsetX)
    setOffsetY(nextOffsetY)
  }

  const handleStagePointerUp = () => {
    isDraggingProp.current = false
  }

  const handlePropWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const delta = -e.deltaY * 0.0015
    setScaleFactor((s) => Math.min(2.5, Math.max(0.4, Number((s + delta).toFixed(2)))))
  }

  // Calculate live AR simulation position on the mannequin face
  const getSimulatedMannequinPropStyle = () => {
    let topPct = 50
    let leftPct = 50

    if (anchor === 'forehead') {
      topPct = 28 + offsetY * 100
      leftPct = 50 + offsetX * 100
    } else if (anchor === 'eyes') {
      topPct = 45 + offsetY * 100
      leftPct = 50 + offsetX * 100
    } else if (anchor === 'nose') {
      topPct = 58 + offsetY * 100
      leftPct = 50 + offsetX * 100
    } else if (anchor === 'ear') {
      topPct = 42 + offsetY * 100
      leftPct = 74 + offsetX * 100 // right ear
    } else if (anchor === 'ear-left') {
      topPct = 42 + offsetY * 100
      leftPct = 26 + offsetX * 100 // left ear
    }

    const isEar = anchor === 'ear' || anchor === 'ear-left'
    const baseWidth = isEar ? 24 : 36
    return {
      top: `${topPct}%`,
      left: `${leftPct}%`,
      width: `${scaleFactor * baseWidth}%`,
      transform: 'translate(-50%, -50%)',
    }
  }

  const builtinPropsList = propsList.filter((p) => !p.isCustom && p.src)
  const isEditingBuiltin = editingPropId && BUILTIN_PROPS.some((b) => b.id === editingPropId)

  return (
    <div className="space-y-6 relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-[#8198ed] text-white font-pixel text-xs px-4 py-2.5 rounded-xl shadow-2xl border-2 border-white animate-in slide-in-from-top duration-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-300" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl bevel-in">
        <div>
          <h2 className="font-pixel text-xs text-[#5b7fcb]">AR Wearables & Face Tracking Props</h2>
          <p className="font-pixel text-[9px] text-[#8792c4] mt-0.5">
            Wearable props stick dynamically to faces using MediaPipe AI Face Tracking. Click &quot;Adjust Placement&quot; to calibrate on live camera!
          </p>
        </div>

        <button
          onClick={handleOpenUpload}
          className="btn95 is-primary !px-4 !py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Upload Prop</span>
        </button>
      </div>

      {/* Built-in Presets */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="font-pixel text-[10px] text-[#8198ed]">
            Built-in Props ({builtinPropsList.length})
          </h3>
          <span className="text-[9px] font-mono text-slate-400">
            Click &quot;Adjust Placement&quot; to calibrate on live camera
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {builtinPropsList.map((p) => {
            const isHidden = hiddenIds.has(p.id)
            const isCustomized = p.offsetX !== 0 || (p.offsetY !== (p.anchor === 'ear' ? -0.02 : -0.18))

            return (
              <div
                key={p.id}
                className={`p-2.5 rounded-lg bevel-in flex flex-col items-center justify-between text-center relative group transition-all ${
                  isHidden ? 'bg-slate-100 opacity-60' : 'bg-white'
                }`}
              >
                {/* Hide / Show Status Badge */}
                <div className="absolute top-1.5 right-1.5 z-10">
                  <button
                    type="button"
                    onClick={(e) => handleToggleHide(p.id, e)}
                    title={isHidden ? 'Click to show in photobooth' : 'Click to hide from photobooth'}
                    className={`text-xs px-1.5 py-0.5 rounded flex items-center gap-1 font-pixel text-[8px] transition-all cursor-pointer ${
                      isHidden
                        ? 'bg-rose-100 text-rose-600 hover:bg-rose-200'
                        : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                    }`}
                  >
                    {isHidden ? (
                      <>
                        <EyeOff className="w-2.5 h-2.5" />
                        <span>Hidden</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-2.5 h-2.5" />
                        <span>Active</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="h-20 w-full flex items-center justify-center bg-[#f8fafc] rounded p-1 mb-2 mt-4">
                  <img src={p.src!} alt={p.label} className="max-h-full max-w-full object-contain" />
                </div>

                <div className="w-full">
                  <p className="font-pixel text-[9px] text-[#5b7fcb] font-bold">{p.label}</p>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <span className="font-mono text-[8px] text-[#8198ed] bg-[#eef2ff] px-1.5 py-0.5 rounded">
                      {p.anchor}
                    </span>
                    {isCustomized && (
                      <span className="font-mono text-[8px] text-amber-600 bg-amber-50 px-1 py-0.5 rounded font-bold">
                        Calibrated
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenEdit(p)}
                    className="w-full mt-2 bg-[#eef2ff] hover:bg-[#8198ed] text-[#5b7fcb] hover:text-white rounded py-1 px-1.5 font-pixel text-[8px] flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  >
                    <Sliders className="w-2.5 h-2.5" />
                    <span>Adjust Placement</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Custom Uploaded Props */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="font-pixel text-[10px] text-[#8198ed]">Custom Props ({customProps.length})</h3>
        </div>

        {customProps.length === 0 ? (
          <div
            onClick={handleOpenUpload}
            className="border-2 border-dashed border-[#cdd6f0] hover:border-[#8198ed] rounded-xl p-8 text-center cursor-pointer transition-colors bg-white/40 flex flex-col items-center justify-center"
          >
            <Sparkles className="w-8 h-8 text-[#8198ed] mb-2" />
            <p className="font-pixel text-xs text-[#5b7fcb] mb-1">No custom props added</p>
            <p className="font-pixel text-[9px] text-[#8792c4]">
              Click here to upload PNG hats, glasses, bunny ears, crowns, or ribbons!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {customProps.map((p) => {
              const isHidden = hiddenIds.has(p.id)
              return (
                <div
                  key={p.id}
                  className={`p-2.5 rounded-lg bevel-in flex flex-col items-center justify-between text-center relative group transition-all ${
                    isHidden ? 'bg-slate-100 opacity-60' : 'bg-white'
                  }`}
                >
                  {/* Hide Toggle & Delete Actions */}
                  <div className="absolute top-1.5 right-1.5 flex items-center gap-1 z-10">
                    <button
                      type="button"
                      onClick={(e) => handleToggleHide(p.id, e)}
                      title={isHidden ? 'Click to show in photobooth' : 'Click to hide from photobooth'}
                      className={`text-xs px-1.5 py-0.5 rounded flex items-center gap-1 font-pixel text-[8px] transition-all cursor-pointer ${
                        isHidden
                          ? 'bg-rose-100 text-rose-600 hover:bg-rose-200'
                          : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                      }`}
                    >
                      {isHidden ? (
                        <>
                          <EyeOff className="w-2.5 h-2.5" />
                          <span>Hidden</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-2.5 h-2.5" />
                          <span>Active</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      title="Delete prop"
                      className="p-1 bg-red-100 hover:bg-red-200 text-red-600 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="h-20 w-full flex items-center justify-center bg-[#f8fafc] rounded p-1 mb-2 mt-4">
                    <img src={p.src} alt={p.label} className="max-h-full max-w-full object-contain" />
                  </div>

                  <div className="w-full">
                    <p className="font-pixel text-[9px] text-[#5b7fcb] font-bold">{p.label}</p>
                    <span className="font-mono text-[8px] text-[#8198ed] bg-[#eef2ff] px-1.5 py-0.5 rounded mt-1 inline-block">
                      {p.anchor}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleOpenEdit(p)}
                      className="w-full mt-2 bg-[#eef2ff] hover:bg-[#8198ed] text-[#5b7fcb] hover:text-white rounded py-1 px-1.5 font-pixel text-[8px] flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      <Sliders className="w-2.5 h-2.5" />
                      <span>Adjust Placement</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* AR Calibration Modal with Live Camera & Mannequin Mode */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200 overflow-y-auto"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-[#efefff] border-3 border-[#8198ed] rounded-2xl shadow-2xl max-w-4xl w-full p-4 sm:p-6 max-h-[94vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b-2 border-[#8198ed] mb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-[#5b7fcb]" />
                <h3 className="font-pixel text-xs sm:text-sm text-[#5b7fcb]">
                  {editingPropId ? `Calibrate Placement: ${label}` : 'Upload & Calibrate AR Wearable Prop'}
                </h3>
              </div>

              {/* Live Camera vs Mannequin Mode Toggle */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-xs">
                <button
                  type="button"
                  onClick={() => setViewMode('camera')}
                  className={`px-2.5 py-1 rounded-lg font-pixel text-[9px] flex items-center gap-1 transition-all cursor-pointer ${
                    viewMode === 'camera'
                      ? 'bg-[#8198ed] text-white font-bold shadow-xs'
                      : 'text-slate-600 hover:bg-[#eef2ff]'
                  }`}
                >
                  <Camera className="w-3 h-3" />
                  <span>Live Camera</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('mannequin')}
                  className={`px-2.5 py-1 rounded-lg font-pixel text-[9px] flex items-center gap-1 transition-all cursor-pointer ${
                    viewMode === 'mannequin'
                      ? 'bg-[#8198ed] text-white font-bold shadow-xs'
                      : 'text-slate-600 hover:bg-[#eef2ff]'
                  }`}
                >
                  <User className="w-3 h-3" />
                  <span>Mannequin</span>
                </button>
              </div>
            </div>

            {/* Main 2-Column Layout: Left Controls + Right Live MediaPipe AR Simulator */}
            <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-5 items-start">
              {/* LEFT COLUMN: Placement Controls */}
              <form onSubmit={handleSave} className="space-y-3.5">
                {/* Upload Image (Only for custom props) */}
                {!isEditingBuiltin && (
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/webp,image/jpeg,image/svg+xml"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    {!previewSrc ? (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-[#8198ed] bg-white rounded-xl p-5 text-center cursor-pointer hover:bg-[#f8fafc] transition-all flex flex-col items-center justify-center shadow-xs"
                      >
                        <ImageIcon className="w-8 h-8 text-[#8198ed] mb-1.5" />
                        <p className="font-pixel text-xs text-[#5b7fcb]">Click to Choose Prop Image</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">PNG, WebP, SVG (Transparent or White BG)</p>
                      </div>
                    ) : (
                      <div className="bg-white rounded-xl border border-slate-200 p-2.5 flex flex-col items-center gap-2 shadow-xs">
                        <div
                          className="relative w-full h-28 rounded-lg flex items-center justify-center overflow-hidden border border-slate-200"
                          style={{
                            backgroundImage:
                              'linear-gradient(45deg, #f1f5f9 25%, transparent 25%), linear-gradient(-45deg, #f1f5f9 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f1f5f9 75%), linear-gradient(-45deg, transparent 75%, #f1f5f9 75%)',
                            backgroundSize: '16px 16px',
                            backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                          }}
                        >
                          <img
                            src={previewSrc}
                            alt="Prop Preview"
                            className="max-h-full max-w-full object-contain drop-shadow-sm"
                          />
                        </div>

                        <div className="flex items-center justify-between w-full gap-2 pt-0.5">
                          <button
                            type="button"
                            onClick={handleMagicRemoveBg}
                            disabled={isRemovingBg}
                            className="flex-1 bg-gradient-to-r from-[#8198ed] to-[#5b7fcb] hover:from-[#6e88e8] hover:to-[#4a6bb8] text-white text-[10px] font-bold py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                          >
                            <Wand2 className={`w-3 h-3 ${isRemovingBg ? 'animate-spin' : ''}`} />
                            <span>{isRemovingBg ? 'Removing BG...' : '✨ Auto Remove BG'}</span>
                          </button>

                          {bgRemoved && (
                            <button
                              type="button"
                              onClick={handleRestoreOriginal}
                              title="Restore original image"
                              className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] py-1 px-2 rounded-lg flex items-center gap-1 font-mono transition-colors cursor-pointer"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Undo</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[10px] py-1 px-2 rounded-lg font-mono transition-colors cursor-pointer"
                          >
                            Change File
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Prop Label */}
                <div>
                  <label className="block font-pixel text-[10px] text-[#5b7fcb] mb-1">Prop Name</label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(isEditingBuiltin)}
                    placeholder="e.g. Angel Halo, Cyber Visor, Cat Ears"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    className="w-full bg-white bevel-in px-3 py-1.5 text-xs font-mono outline-none rounded-lg disabled:opacity-75"
                  />
                </div>

                {/* Anchor Point Selection */}
                <div>
                  <label className="block font-pixel text-[10px] text-[#5b7fcb] mb-1">Face Anchor Point</label>
                  <div className="grid grid-cols-5 gap-1">
                    {(
                      [
                        ['forehead', '🧢 Forehead', -0.18, 1.4],
                        ['eyes', '👓 Eyes', -0.06, 1.3],
                        ['nose', '👃 Nose', 0.05, 1.2],
                        ['ear', '🎀 R-Ear', -0.02, 0.85],
                        ['ear-left', '🎀 L-Ear', -0.02, 0.85],
                      ] as const
                    ).map(([a, title, defY, defScale]) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => {
                          setAnchor(a)
                          setOffsetY(defY)
                          setOffsetX(0)
                          setScaleFactor(defScale)
                        }}
                        className={`p-1.5 rounded-xl border text-center font-pixel text-[8px] leading-tight transition-all cursor-pointer ${
                          anchor === a
                            ? 'border-[#5b7fcb] bg-[#8198ed] text-white shadow-md'
                            : 'border-[#cdd6f0] bg-white text-slate-700 hover:border-[#8198ed]'
                        }`}
                      >
                        {title}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Fine-Tuning Sliders: X, Y, Scale */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs space-y-2.5">
                  {/* Horizontal Offset */}
                  <div>
                    <div className="flex justify-between font-pixel text-[9px] text-[#5b7fcb] mb-0.5">
                      <span>Horizontal Offset (X):</span>
                      <span className="font-mono font-bold text-slate-700">{offsetX.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min="-0.45"
                      max="0.45"
                      step="0.01"
                      value={offsetX}
                      onChange={(e) => setOffsetX(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#8198ed]"
                    />
                    <div className="flex justify-between text-[7px] text-slate-400 font-mono mt-0.5">
                      <span>Left (←)</span>
                      <span>Center</span>
                      <span>Right (→)</span>
                    </div>
                  </div>

                  {/* Vertical Offset */}
                  <div>
                    <div className="flex justify-between font-pixel text-[9px] text-[#5b7fcb] mb-0.5">
                      <span>Vertical Offset (Y):</span>
                      <span className="font-mono font-bold text-slate-700">{offsetY.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min="-0.45"
                      max="0.45"
                      step="0.01"
                      value={offsetY}
                      onChange={(e) => setOffsetY(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#8198ed]"
                    />
                    <div className="flex justify-between text-[7px] text-slate-400 font-mono mt-0.5">
                      <span>Higher (↑)</span>
                      <span>Lower (↓)</span>
                    </div>
                  </div>

                  {/* Scale Factor */}
                  <div>
                    <div className="flex justify-between font-pixel text-[9px] text-[#5b7fcb] mb-0.5">
                      <span>Scale Factor:</span>
                      <span className="font-mono font-bold text-slate-700">{scaleFactor.toFixed(2)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.4"
                      max="2.5"
                      step="0.05"
                      value={scaleFactor}
                      onChange={(e) => setScaleFactor(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#8198ed]"
                    />
                    <div className="flex justify-between text-[7px] text-slate-400 font-mono mt-0.5">
                      <span>Smaller</span>
                      <span>Bigger</span>
                    </div>
                  </div>
                </div>

                {/* Submit & Cancel Actions */}
                <div className="flex items-center justify-between pt-1">
                  {isEditingBuiltin ? (
                    <button
                      type="button"
                      onClick={handleResetToDefault}
                      className="text-slate-600 hover:text-slate-800 text-[10px] font-mono flex items-center gap-1 cursor-pointer bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset to Default</span>
                    </button>
                  ) : <div />}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowModal(false)
                        setEditingPropId(null)
                      }}
                      className="btn95 !px-4 !py-2 text-xs cursor-pointer"
                    >
                      Done
                    </button>
                    <button
                      type="submit"
                      disabled={!previewSrc || !label.trim()}
                      className={`btn95 !px-5 !py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all ${
                        justSaved ? 'bg-emerald-600 !text-white' : 'is-primary'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{justSaved ? 'Saved!' : 'Save Placement'}</span>
                    </button>
                  </div>
                </div>
              </form>

              {/* RIGHT COLUMN: Live MediaPipe Face Tracking Video / Mannequin Simulator */}
              <div className="bg-white rounded-2xl p-3 border border-[#8198ed]/30 shadow-md flex flex-col items-center">
                <div className="flex items-center justify-between w-full mb-2">
                  <span className="font-pixel text-[10px] text-[#5b7fcb] font-bold">
                    {viewMode === 'camera' ? '📷 Real-Time MediaPipe Live Face Tracking' : '👤 Mannequin Preview'}
                  </span>
                  {viewMode === 'mannequin' && (
                    <button
                      type="button"
                      onClick={() => setShowLandmarks((s) => !s)}
                      className="text-[9px] font-mono text-slate-500 hover:text-[#5b7fcb] bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded cursor-pointer transition-colors"
                    >
                      {showLandmarks ? 'Hide Landmarks' : 'Show Landmarks'}
                    </button>
                  )}
                </div>

                {/* Stage Box with 2D Drag */}
                <div
                  ref={stageRef}
                  onPointerDown={handleStagePointerDown}
                  onPointerMove={handleStagePointerMove}
                  onPointerUp={handleStagePointerUp}
                  onPointerLeave={handleStagePointerUp}
                  onWheel={handlePropWheel}
                  className="relative w-full aspect-[4/3] max-h-[360px] bg-black rounded-xl overflow-hidden flex items-center justify-center border-2 border-slate-300 shadow-inner select-none cursor-grab active:cursor-grabbing"
                  title="Drag on stage to adjust position • Scroll wheel to resize"
                >
                  {viewMode === 'camera' ? (
                    <>
                      {/* Live Camera Video */}
                      <video
                        ref={videoRef}
                        playsInline
                        muted
                        className="w-full h-full object-cover -scale-x-100 block"
                      />

                      {/* 60FPS MediaPipe AI AR Overlay Canvas */}
                      <canvas
                        ref={overlayCanvasRef}
                        width={1040}
                        height={780}
                        className="absolute inset-0 w-full h-full pointer-events-none z-10"
                      />

                      {cameraStatus !== 'live' && (
                        <div className="absolute inset-0 grid place-items-center text-center p-4 bg-black/85 z-20">
                          <p className="font-pixel text-xs text-white">Connecting Camera for Calibration…</p>
                        </div>
                      )}

                      {/* Status indicator */}
                      <div className="absolute top-2 right-2 z-20">
                        <span className="font-pixel text-[8px] text-white bg-black/60 px-2 py-0.5 rounded-md border border-white/30 backdrop-blur-xs">
                          {metrics.hasFace ? 'Face Locked' : 'Looking for Face…'}
                        </span>
                      </div>
                    </>
                  ) : (
                    /* Stylized Mannequin Face Stage */
                    <div className="relative w-full h-full bg-gradient-to-b from-[#eef2ff] to-[#dbe4ff] flex items-center justify-center">
                      <div className="relative w-[180px] h-[230px] flex items-center justify-center pointer-events-none">
                        <div className="absolute inset-0 bg-[#fce7d2] rounded-[50%_50%_46%_46%] border-3 border-[#e2b992] shadow-md flex flex-col items-center">
                          <div className="absolute -top-3 left-3 right-3 h-14 bg-[#3d2f28] rounded-[50%_50%_20%_20%]" />
                          <div className="absolute top-[38%] left-8 w-7 h-1 bg-[#3d2f28] rounded-full rotate-[-4deg]" />
                          <div className="absolute top-[38%] right-8 w-7 h-1 bg-[#3d2f28] rounded-full rotate-[4deg]" />
                          <div className="absolute top-[44%] left-8 size-5 bg-[#2d3748] rounded-full border-2 border-white" />
                          <div className="absolute top-[44%] right-8 size-5 bg-[#2d3748] rounded-full border-2 border-white" />
                          <div className="absolute top-[56%] w-2.5 h-3 bg-[#e2b992] rounded-full" />
                          <div className="absolute top-[68%] w-8 h-4 border-b-3 border-[#c27b68] rounded-full" />
                        </div>

                        <div className="absolute top-[42%] -left-3 size-6 bg-[#fce7d2] border-2 border-[#e2b992] rounded-full" />
                        <div className="absolute top-[42%] -right-3 size-6 bg-[#fce7d2] border-2 border-[#e2b992] rounded-full" />

                        {showLandmarks && (
                          <div className="absolute inset-0 pointer-events-none">
                            <div className={`absolute top-[28%] left-1/2 -translate-x-1/2 -translate-y-1/2 size-3 rounded-full border border-dashed ${anchor === 'forehead' ? 'border-indigo-600 bg-indigo-500/30' : 'border-slate-400/40'}`} />
                            <div className={`absolute top-[45%] left-1/2 -translate-x-1/2 -translate-y-1/2 size-3 rounded-full border border-dashed ${anchor === 'eyes' ? 'border-indigo-600 bg-indigo-500/30' : 'border-slate-400/40'}`} />
                            <div className={`absolute top-[58%] left-1/2 -translate-x-1/2 -translate-y-1/2 size-3 rounded-full border border-dashed ${anchor === 'nose' ? 'border-indigo-600 bg-indigo-500/30' : 'border-slate-400/40'}`} />
                            <div className={`absolute top-[42%] right-0 -translate-y-1/2 size-3 rounded-full border border-dashed ${anchor === 'ear' ? 'border-indigo-600 bg-indigo-500/30' : 'border-slate-400/40'}`} />
                            <div className={`absolute top-[42%] left-0 -translate-y-1/2 size-3 rounded-full border border-dashed ${anchor === 'ear-left' ? 'border-indigo-600 bg-indigo-500/30' : 'border-slate-400/40'}`} />
                          </div>
                        )}
                      </div>

                      {previewSrc && (
                        <div
                          className="absolute z-20 flex items-center justify-center pointer-events-none"
                          style={getSimulatedMannequinPropStyle()}
                        >
                          <img
                            src={previewSrc}
                            alt="Prop Fit Preview"
                            className="w-full h-auto object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.4)]"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <p className="text-[10px] text-slate-500 font-mono mt-2 text-center">
                  💡 {viewMode === 'camera' ? 'Look into your camera! Drag on video to position • Scroll wheel or sliders to resize' : 'Drag anywhere on face to adjust position • Scroll wheel or sliders to resize'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
