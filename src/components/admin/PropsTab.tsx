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
} from 'lucide-react'
import {
  getCustomProps,
  saveCustomProp,
  deleteCustomProp,
  getHiddenAssets,
  toggleHideAsset,
  type CustomProp,
} from '../../lib/db'
import { BUILTIN_PROPS, loadProps, type PropAnchor } from '../../lib/props'
import { removeBackground } from '../../lib/bgRemover'

export default function PropsTab({ onPropsChange }: { onPropsChange?: () => void }) {
  const [customProps, setCustomProps] = useState<CustomProp[]>([])
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [label, setLabel] = useState('')
  const [anchor, setAnchor] = useState<PropAnchor>('forehead')
  const [offsetY, setOffsetY] = useState(-0.18)
  const [scaleFactor, setScaleFactor] = useState(1.4)
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  const [originalSrc, setOriginalSrc] = useState<string | null>(null)
  const [isRemovingBg, setIsRemovingBg] = useState(false)
  const [bgRemoved, setBgRemoved] = useState(false)
  const [showLandmarks, setShowLandmarks] = useState(true)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const loadData = async () => {
    const [data, hiddenAssets] = await Promise.all([
      getCustomProps(),
      getHiddenAssets(),
    ])
    setCustomProps(data)
    setHiddenIds(new Set(hiddenAssets.props || []))
    await loadProps()
    onPropsChange?.()
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleToggleHide = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    await toggleHideAsset('props', id)
    await loadData()
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
    setLabel('')
    setPreviewSrc(null)
    setOriginalSrc(null)
    setAnchor('forehead')
    setOffsetY(-0.18)
    setScaleFactor(1.4)
    setBgRemoved(false)
    setShowUploadModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!previewSrc || !label.trim()) return

    const newProp: CustomProp = {
      id: `custom_prop_${Date.now()}`,
      label: label.trim(),
      src: previewSrc,
      anchor,
      offsetY,
      scaleFactor,
      isCustom: true,
    }

    await saveCustomProp(newProp)
    await loadData()

    setShowUploadModal(false)
    setLabel('')
    setPreviewSrc(null)
    setOriginalSrc(null)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this custom prop?')) return
    await deleteCustomProp(id)
    await loadData()
  }

  // Calculate live AR simulation position on the mannequin face
  const getSimulatedPropStyle = () => {
    // Mannequin center is at (50%, 50%)
    let topPct = 50
    let leftPct = 50

    if (anchor === 'forehead') {
      topPct = 28 + offsetY * 100
    } else if (anchor === 'eyes') {
      topPct = 45 + offsetY * 100
    } else if (anchor === 'nose') {
      topPct = 58 + offsetY * 100
    } else if (anchor === 'ear') {
      topPct = 42 + offsetY * 100
      leftPct = 78 // right ear
    }

    return {
      top: `${topPct}%`,
      left: `${leftPct}%`,
      width: `${scaleFactor * 36}%`,
      transform: 'translate(-50%, -50%)',
    }
  }

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl bevel-in">
        <div>
          <h2 className="font-pixel text-xs text-[#5b7fcb]">AR Wearables & Face Tracking Props</h2>
          <p className="font-pixel text-[9px] text-[#8792c4] mt-0.5">
            Wearable props stick dynamically to faces using real-time landmark tracking
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
        <h3 className="font-pixel text-[10px] text-[#8198ed] mb-2.5">
          Built-in Props ({BUILTIN_PROPS.length - 1})
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {BUILTIN_PROPS.filter((p) => p.src).map((p) => {
            const isHidden = hiddenIds.has(p.id)
            return (
              <div
                key={p.id}
                className={`p-2.5 rounded-lg bevel-in flex flex-col items-center justify-between text-center relative group transition-all ${
                  isHidden ? 'bg-slate-100 opacity-60' : 'bg-white'
                }`}
              >
                {/* Hide / Show Status Badge */}
                <div className="absolute top-1.5 right-1.5">
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
                <div>
                  <p className="font-pixel text-[9px] text-[#5b7fcb] font-bold">{p.label}</p>
                  <span className="font-mono text-[9px] text-[#8198ed] bg-[#eef2ff] px-1.5 py-0.5 rounded mt-1 inline-block">
                    {p.anchor}
                  </span>
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
                  <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
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
                  <div>
                    <p className="font-pixel text-[9px] text-[#5b7fcb] font-bold">{p.label}</p>
                    <span className="font-mono text-[9px] text-[#8198ed] bg-[#eef2ff] px-1.5 py-0.5 rounded mt-1 inline-block">
                      {p.anchor}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Upload & Configure Prop Modal with Live AR Face Fitting Simulator */}
      {showUploadModal && (
        <div
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200 overflow-y-auto"
          onClick={() => setShowUploadModal(false)}
        >
          <div
            className="bg-[#efefff] border-3 border-[#8198ed] rounded-2xl shadow-2xl max-w-4xl w-full p-5 sm:p-7 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b-2 border-[#8198ed] mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#5b7fcb]" />
                <h3 className="font-pixel text-xs sm:text-sm text-[#5b7fcb]">
                  Upload & Fit AR Wearable Prop
                </h3>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="size-7 rounded-lg bg-white hover:bg-rose-100 text-slate-500 hover:text-rose-600 font-bold flex items-center justify-center cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Format Requirements Guidelines Banner */}
            <div className="bg-[#e0e7ff] border border-[#8198ed]/50 rounded-xl p-3 mb-5 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-[#5b7fcb] shrink-0 mt-0.5" />
              <div className="text-[11px] text-[#334155] leading-relaxed">
                <span className="font-bold text-[#5b7fcb]">Format Guidelines:</span> Use transparent{' '}
                <span className="font-mono bg-white px-1.5 py-0.5 rounded text-[#5b7fcb] font-bold">.PNG</span> or{' '}
                <span className="font-mono bg-white px-1.5 py-0.5 rounded text-[#5b7fcb] font-bold">.WEBP</span> (square{' '}
                <span className="font-bold">512×512px</span> recommended with centered artwork). If your image has a solid background, click{' '}
                <span className="font-bold text-[#5b7fcb]">✨ Auto Remove Background</span> below!
              </div>
            </div>

            {/* Main 2-Column Layout: Left Controls + Right Live AR Simulator */}
            <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6 items-start">
              {/* LEFT COLUMN: Upload & Fit Settings */}
              <form onSubmit={handleSave} className="space-y-4">
                {/* File Dropzone */}
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
                      className="border-2 border-dashed border-[#8198ed] bg-white rounded-xl p-6 text-center cursor-pointer hover:bg-[#f8fafc] transition-all flex flex-col items-center justify-center shadow-xs"
                    >
                      <ImageIcon className="w-10 h-10 text-[#8198ed] mb-2" />
                      <p className="font-pixel text-xs text-[#5b7fcb]">Click to Choose Prop Image</p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        PNG, WebP, SVG (Transparent or White BG)
                      </p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-xl border border-slate-200 p-3 flex flex-col items-center gap-2 shadow-xs">
                      {/* Checkerboard transparent container */}
                      <div
                        className="relative w-full h-36 rounded-lg flex items-center justify-center overflow-hidden border border-slate-200"
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

                      {/* BG Removal & Change Actions Bar */}
                      <div className="flex items-center justify-between w-full gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleMagicRemoveBg}
                          disabled={isRemovingBg}
                          className="flex-1 bg-gradient-to-r from-[#8198ed] to-[#5b7fcb] hover:from-[#6e88e8] hover:to-[#4a6bb8] text-white text-[11px] font-bold py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                        >
                          <Wand2 className={`w-3.5 h-3.5 ${isRemovingBg ? 'animate-spin' : ''}`} />
                          <span>{isRemovingBg ? 'Removing BG...' : '✨ Auto Remove BG'}</span>
                        </button>

                        {bgRemoved && (
                          <button
                            type="button"
                            onClick={handleRestoreOriginal}
                            title="Restore original image"
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] py-1.5 px-2.5 rounded-lg flex items-center gap-1 font-mono transition-colors cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Undo</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[10px] py-1.5 px-2.5 rounded-lg font-mono transition-colors cursor-pointer"
                        >
                          Change File
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Prop Label */}
                <div>
                  <label className="block font-pixel text-[10px] text-[#5b7fcb] mb-1">Prop Name / Label</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Angel Halo, Cyber Visor, Cat Ears"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    className="w-full bg-white bevel-in px-3 py-2 text-xs font-mono outline-none rounded-lg"
                  />
                </div>

                {/* Anchor Point Selection */}
                <div>
                  <label className="block font-pixel text-[10px] text-[#5b7fcb] mb-1">Face Anchor Point</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(
                      [
                        ['forehead', '🧢 Forehead / Hat', -0.18, 1.4],
                        ['eyes', '👓 Eyes / Glasses', -0.06, 1.3],
                        ['nose', '👃 Nose / Mask', 0.05, 1.2],
                        ['ear', '🎀 Ear / Hairpin', -0.02, 0.85],
                      ] as const
                    ).map(([a, title, defY, defScale]) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => {
                          setAnchor(a)
                          setOffsetY(defY)
                          setScaleFactor(defScale)
                        }}
                        className={`p-2 rounded-xl border text-center font-pixel text-[8px] leading-tight transition-all cursor-pointer ${
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

                {/* Sliders: Offset & Scale */}
                <div className="grid grid-cols-2 gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                  <div>
                    <div className="flex justify-between font-pixel text-[9px] text-[#5b7fcb] mb-1.5">
                      <span>Vertical Offset:</span>
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
                    <div className="flex justify-between text-[8px] text-slate-400 font-mono mt-0.5">
                      <span>Higher (↑)</span>
                      <span>Lower (↓)</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between font-pixel text-[9px] text-[#5b7fcb] mb-1.5">
                      <span>Scale Factor:</span>
                      <span className="font-mono font-bold text-slate-700">{scaleFactor.toFixed(2)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="2.5"
                      step="0.05"
                      value={scaleFactor}
                      onChange={(e) => setScaleFactor(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#8198ed]"
                    />
                    <div className="flex justify-between text-[8px] text-slate-400 font-mono mt-0.5">
                      <span>Smaller</span>
                      <span>Bigger</span>
                    </div>
                  </div>
                </div>

                {/* Submit & Cancel Actions */}
                <div className="flex justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowUploadModal(false)}
                    className="btn95 !px-4 !py-2 text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!previewSrc || !label.trim()}
                    className="btn95 is-primary !px-5 !py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Wearable Prop</span>
                  </button>
                </div>
              </form>

              {/* RIGHT COLUMN: Live Face AR Fitting Simulator */}
              <div className="bg-white rounded-2xl p-4 border border-[#8198ed]/30 shadow-md flex flex-col items-center">
                <div className="flex items-center justify-between w-full mb-3">
                  <span className="font-pixel text-[10px] text-[#5b7fcb] font-bold">
                    Live AR Face Simulator
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowLandmarks((s) => !s)}
                    className="text-[9px] font-mono text-slate-500 hover:text-[#5b7fcb] bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded cursor-pointer transition-colors"
                  >
                    {showLandmarks ? 'Hide Landmarks' : 'Show Landmarks'}
                  </button>
                </div>

                {/* Stylized Face Stage Box */}
                <div className="relative w-full aspect-[4/5] max-h-[380px] bg-gradient-to-b from-[#eef2ff] to-[#dbe4ff] rounded-xl overflow-hidden flex items-center justify-center border-2 border-slate-200 shadow-inner select-none">
                  {/* Stylized Mannequin Head Silhouette */}
                  <div className="relative w-[210px] h-[270px] flex items-center justify-center">
                    {/* Head / Face Oval */}
                    <div className="absolute inset-0 bg-[#fce7d2] rounded-[50%_50%_46%_46%] border-3 border-[#e2b992] shadow-md flex flex-col items-center">
                      {/* Hair Silhouette Top */}
                      <div className="absolute -top-3 left-3 right-3 h-16 bg-[#3d2f28] rounded-[50%_50%_20%_20%]" />

                      {/* Eyebrows */}
                      <div className="absolute top-[38%] left-10 w-8 h-1 bg-[#3d2f28] rounded-full rotate-[-4deg]" />
                      <div className="absolute top-[38%] right-10 w-8 h-1 bg-[#3d2f28] rounded-full rotate-[4deg]" />

                      {/* Eyes */}
                      <div className="absolute top-[44%] left-10 size-6 bg-[#2d3748] rounded-full border-2 border-white flex items-center justify-center">
                        <div className="size-2 bg-white rounded-full translate-x-0.5 -translate-y-0.5" />
                      </div>
                      <div className="absolute top-[44%] right-10 size-6 bg-[#2d3748] rounded-full border-2 border-white flex items-center justify-center">
                        <div className="size-2 bg-white rounded-full translate-x-0.5 -translate-y-0.5" />
                      </div>

                      {/* Cheeks */}
                      <div className="absolute top-[54%] left-7 w-6 h-3 bg-rose-300/60 rounded-full blur-[1px]" />
                      <div className="absolute top-[54%] right-7 w-6 h-3 bg-rose-300/60 rounded-full blur-[1px]" />

                      {/* Nose */}
                      <div className="absolute top-[56%] w-2.5 h-3 bg-[#e2b992] rounded-full" />

                      {/* Smile */}
                      <div className="absolute top-[68%] w-10 h-5 border-b-3 border-[#c27b68] rounded-full" />
                    </div>

                    {/* Ears */}
                    <div className="absolute top-[42%] -left-3 size-7 bg-[#fce7d2] border-2 border-[#e2b992] rounded-full" />
                    <div className="absolute top-[42%] -right-3 size-7 bg-[#fce7d2] border-2 border-[#e2b992] rounded-full" />

                    {/* AR Tracking Landmark Reference Target Crosshairs */}
                    {showLandmarks && (
                      <div className="absolute inset-0 pointer-events-none">
                        {/* Forehead landmark */}
                        <div
                          className={`absolute top-[28%] left-1/2 -translate-x-1/2 -translate-y-1/2 size-3.5 rounded-full border-2 border-dashed flex items-center justify-center ${
                            anchor === 'forehead'
                              ? 'border-indigo-600 bg-indigo-500/30 ring-2 ring-indigo-400'
                              : 'border-slate-400/50 bg-slate-400/20'
                          }`}
                        >
                          <span className="text-[7px] font-mono font-bold text-indigo-700">F</span>
                        </div>

                        {/* Eyes landmark */}
                        <div
                          className={`absolute top-[45%] left-1/2 -translate-x-1/2 -translate-y-1/2 size-3.5 rounded-full border-2 border-dashed flex items-center justify-center ${
                            anchor === 'eyes'
                              ? 'border-indigo-600 bg-indigo-500/30 ring-2 ring-indigo-400'
                              : 'border-slate-400/50 bg-slate-400/20'
                          }`}
                        >
                          <span className="text-[7px] font-mono font-bold text-indigo-700">E</span>
                        </div>

                        {/* Nose landmark */}
                        <div
                          className={`absolute top-[58%] left-1/2 -translate-x-1/2 -translate-y-1/2 size-3.5 rounded-full border-2 border-dashed flex items-center justify-center ${
                            anchor === 'nose'
                              ? 'border-indigo-600 bg-indigo-500/30 ring-2 ring-indigo-400'
                              : 'border-slate-400/50 bg-slate-400/20'
                          }`}
                        >
                          <span className="text-[7px] font-mono font-bold text-indigo-700">N</span>
                        </div>

                        {/* Ear landmark */}
                        <div
                          className={`absolute top-[42%] right-1 -translate-y-1/2 size-3.5 rounded-full border-2 border-dashed flex items-center justify-center ${
                            anchor === 'ear'
                              ? 'border-indigo-600 bg-indigo-500/30 ring-2 ring-indigo-400'
                              : 'border-slate-400/50 bg-slate-400/20'
                          }`}
                        >
                          <span className="text-[7px] font-mono font-bold text-indigo-700">R</span>
                        </div>
                      </div>
                    )}

                    {/* Live AR Overlay of the Uploaded Prop */}
                    {previewSrc && (
                      <div
                        className="absolute pointer-events-none transition-all duration-75 flex items-center justify-center"
                        style={getSimulatedPropStyle()}
                      >
                        <img
                          src={previewSrc}
                          alt="Prop Fit Preview"
                          className="w-full h-auto object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.35)]"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <p className="text-[10px] text-slate-500 font-mono mt-3 text-center">
                  {previewSrc
                    ? 'Adjust Vertical Offset & Scale sliders to fit prop onto the face model'
                    : 'Upload a PNG sprite to preview real-time face tracking positioning'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
