import { useState, useEffect, useRef } from 'react'
import {
  getCustomProps,
  saveCustomProp,
  deleteCustomProp,
  getHiddenAssets,
  toggleHideAsset,
  type CustomProp,
} from '../../lib/db'
import { BUILTIN_PROPS, loadProps, type PropAnchor, type PropDef } from '../../lib/props'
import ImageCropperModal from './ImageCropperModal'

export default function PropsTab({ onPropsChange }: { onPropsChange?: () => void }) {
  const [customProps, setCustomProps] = useState<CustomProp[]>([])
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [rawImageForCrop, setRawImageForCrop] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const [anchor, setAnchor] = useState<PropAnchor>('forehead')
  const [offsetY, setOffsetY] = useState(-0.15)
  const [scaleFactor, setScaleFactor] = useState(1.4)
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
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
      setRawImageForCrop(reader.result as string)
      setLabel(file.name.replace(/\.[^/.]+$/, ''))
    }
    reader.readAsDataURL(file)
  }

  const handleCropConfirmed = (croppedDataUrl: string) => {
    setPreviewSrc(croppedDataUrl)
    setRawImageForCrop(null)
    setShowUploadModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!previewSrc || !label.trim()) return

    const id = `custom_prop_${Date.now()}`
    await saveCustomProp({
      id,
      label: label.trim(),
      src: previewSrc,
      anchor,
      offsetY,
      scaleFactor,
    })

    setShowUploadModal(false)
    setLabel('')
    setPreviewSrc(null)
    setOffsetY(-0.15)
    setScaleFactor(1.4)
    await loadData()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this custom wearable prop?')) return
    await deleteCustomProp(id)
    await loadData()
  }

  return (
    <div className="space-y-6">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/webp,image/svg+xml"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Interactive Cropper Modal */}
      {rawImageForCrop && (
        <ImageCropperModal
          imageUrl={rawImageForCrop}
          aspectRatio={1}
          showFrameOverlay="none"
          title="Crop & Align Prop Sprite"
          onConfirm={handleCropConfirmed}
          onCancel={() => {
            setRawImageForCrop(null)
            if (fileInputRef.current) fileInputRef.current.value = ''
          }}
        />
      )}

      {/* Top Header & Upload Button */}
      <div className="flex items-center justify-between bg-white p-3.5 rounded-xl bevel-in">
        <div>
          <h2 className="font-pixel text-xs sm:text-sm text-[#5b7fcb]">
            AR Wearable Props & Filters
          </h2>
          <p className="font-pixel text-[9px] text-[#8792c4] mt-0.5">
            Wearable props dynamically anchor and track faces in the live camera booth. Click 👁️/🙈 to hide or show in photobooth.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="btn95 is-primary !px-4 !py-2 text-xs font-bold flex items-center gap-1.5"
        >
          <span>➕</span>
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
                <button
                  type="button"
                  onClick={(e) => handleToggleHide(p.id, e)}
                  title={isHidden ? 'Click to show in photobooth' : 'Click to hide from photobooth'}
                  className={`absolute top-1.5 right-1.5 text-xs px-1.5 py-0.5 rounded flex items-center gap-1 font-pixel text-[8px] transition-all ${
                    isHidden
                      ? 'bg-rose-100 text-rose-600 hover:bg-rose-200'
                      : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                  }`}
                >
                  <span>{isHidden ? '🙈 Hidden' : '👁️ Active'}</span>
                </button>

                <div className="h-20 w-full flex items-center justify-center bg-[#f8fafc] rounded p-1 mb-2 mt-4">
                  <img src={p.src!} alt={p.label} className="max-h-full max-w-full object-contain" />
                </div>
                <div>
                  <p className="font-pixel text-[9px] text-[#5b7fcb] font-bold">{p.label}</p>
                  <span className="font-mono text-[9px] text-slate-400 uppercase bg-slate-100 px-1.5 py-0.5 rounded mt-1 inline-block">
                    {p.anchor || 'forehead'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Custom Admin Props */}
      <div>
        <h3 className="font-pixel text-[10px] text-[#8198ed] mb-2.5 flex items-center gap-2">
          <span>Custom Uploaded Props ({customProps.length})</span>
          {customProps.length === 0 && (
            <span className="text-[9px] text-slate-400 font-sans">(None uploaded yet)</span>
          )}
        </h3>

        {customProps.length === 0 ? (
          <div
            onClick={() => setShowUploadModal(true)}
            className="border-2 border-dashed border-[#cdd6f0] hover:border-[#8198ed] rounded-xl p-8 text-center cursor-pointer transition-colors bg-white/40"
          >
            <p className="text-2xl mb-1">🎭</p>
            <p className="font-pixel text-xs text-[#5b7fcb] mb-1">No custom props added</p>
            <p className="font-pixel text-[9px] text-[#8792c4]">
              Click here to upload PNG hats, glasses, bunny ears, or crowns!
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
                      className={`text-xs px-1.5 py-0.5 rounded flex items-center gap-0.5 font-pixel text-[8px] transition-all ${
                        isHidden
                          ? 'bg-rose-100 text-rose-600 hover:bg-rose-200'
                          : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                      }`}
                    >
                      <span>{isHidden ? '🙈 Hidden' : '👁️ Active'}</span>
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      title="Delete prop"
                      className="text-xs p-1 bg-red-100 hover:bg-red-200 text-red-600 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ✕
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

      {/* Upload & Configure Prop Modal */}
      {showUploadModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3"
          onClick={() => setShowUploadModal(false)}
        >
          <div
            className="bg-[#efefff] border-3 border-[#8198ed] rounded-xl shadow-2xl max-w-lg w-full p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b-2 border-[#8198ed] mb-4">
              <h3 className="font-pixel text-xs text-[#5b7fcb]">Add New Wearable Prop</h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="font-pixel text-xs text-[#8792c4] hover:text-red-500"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {/* File Upload Box */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/webp,image/svg+xml"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {!previewSrc ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-[#8198ed] bg-white rounded-lg p-6 text-center cursor-pointer hover:bg-[#f8fafc] transition-colors"
                  >
                    <p className="text-3xl mb-1">🖼️</p>
                    <p className="font-pixel text-xs text-[#5b7fcb]">Choose Transparent PNG Sprite</p>
                    <p className="text-[10px] text-slate-400 mt-1 font-sans">
                      (Hats, glasses, masks, cat ears, ribbons, etc.)
                    </p>
                  </div>
                ) : (
                  <div className="relative bg-slate-900 rounded-lg p-3 flex items-center justify-center h-40 overflow-hidden">
                    <img
                      src={previewSrc}
                      alt="Preview"
                      className="max-h-full max-w-full object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewSrc(null)
                        if (fileInputRef.current) fileInputRef.current.value = ''
                      }}
                      className="absolute top-2 right-2 bg-white/80 hover:bg-white text-xs px-2 py-1 rounded font-pixel"
                    >
                      Change
                    </button>
                  </div>
                )}
              </div>

              {/* Prop Label */}
              <div>
                <label className="block font-pixel text-[10px] text-[#5b7fcb] mb-1">Prop Name / Label</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Angel Halo, Pixel Glasses"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="w-full bg-white bevel-in px-3 py-2 text-xs font-mono outline-none rounded"
                />
              </div>

              {/* Anchor Point Selection */}
              <div>
                <label className="block font-pixel text-[10px] text-[#5b7fcb] mb-1">Face Anchor Point</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(
                    [
                      ['forehead', 'Forehead / Hat'],
                      ['eyes', 'Eyes / Glasses'],
                      ['nose', 'Nose / Mouth'],
                      ['ear', 'Ear / Earring'],
                    ] as const
                  ).map(([a, title]) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => {
                        setAnchor(a)
                        if (a === 'forehead') setOffsetY(-0.18)
                        else if (a === 'eyes') setOffsetY(-0.06)
                        else if (a === 'nose') setOffsetY(0.05)
                        else if (a === 'ear') setOffsetY(-0.02)
                      }}
                      className={`p-2 rounded border text-center font-pixel text-[8px] leading-tight ${
                        anchor === a
                          ? 'border-[#8198ed] bg-[#8198ed] text-white'
                          : 'border-slate-300 bg-white text-slate-700 hover:border-[#8198ed]'
                      }`}
                    >
                      {title}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sliders: Offset & Scale */}
              <div className="grid grid-cols-2 gap-3 bg-white p-2.5 rounded bevel-in">
                <div>
                  <div className="flex justify-between font-pixel text-[8px] text-slate-600 mb-1">
                    <span>Vertical Offset:</span>
                    <span>{offsetY.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="-0.5"
                    max="0.5"
                    step="0.02"
                    value={offsetY}
                    onChange={(e) => setOffsetY(parseFloat(e.target.value))}
                    className="w-full accent-[#8198ed]"
                  />
                </div>

                <div>
                  <div className="flex justify-between font-pixel text-[8px] text-slate-600 mb-1">
                    <span>Scale Factor:</span>
                    <span>{scaleFactor.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="3.0"
                    step="0.1"
                    value={scaleFactor}
                    onChange={(e) => setScaleFactor(parseFloat(e.target.value))}
                    className="w-full accent-[#8198ed]"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="btn95 !px-4 !py-2 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!previewSrc || !label.trim()}
                  className="btn95 is-primary !px-5 !py-2 text-xs font-bold"
                >
                  Save & Enable Prop
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
