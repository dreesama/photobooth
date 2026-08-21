import { useState, useEffect, useRef } from 'react'
import { Plus, Eye, EyeOff, Trash2, Frame } from 'lucide-react'
import {
  getCustomBackgrounds,
  saveCustomBackground,
  deleteCustomBackground,
  getHiddenAssets,
  toggleHideAsset,
  type CustomBackground,
} from '../../lib/db'
import { BUILTIN_BACKGROUNDS, preloadBackgrounds } from '../../lib/strip'
import ImageCropperModal from './ImageCropperModal'

export default function BackgroundsTab({ onBackgroundsChange }: { onBackgroundsChange?: () => void }) {
  const [customBgs, setCustomBgs] = useState<CustomBackground[]>([])
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())
  const [rawImageForCrop, setRawImageForCrop] = useState<string | null>(null)
  const [croppedUrl, setCroppedUrl] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const loadData = async () => {
    const [data, hiddenAssets] = await Promise.all([
      getCustomBackgrounds(),
      getHiddenAssets(),
    ])
    setCustomBgs(data)
    setHiddenIds(new Set(hiddenAssets.backgrounds || []))
    await preloadBackgrounds()
    onBackgroundsChange?.()
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleToggleHide = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    await toggleHideAsset('backgrounds', id)
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

  // After crop is confirmed in the modal
  const handleCropConfirmed = (croppedDataUrl: string) => {
    setCroppedUrl(croppedDataUrl)
    setRawImageForCrop(null)
    setShowSaveDialog(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!croppedUrl || !label.trim()) return

    const id = `custom_bg_${Date.now()}`
    await saveCustomBackground({
      id,
      label: label.trim(),
      url: croppedUrl,
    })

    setShowSaveDialog(false)
    setLabel('')
    setCroppedUrl(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    await loadData()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this custom event frame background?')) return
    await deleteCustomBackground(id)
    await loadData()
  }

  return (
    <div className="space-y-6">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Interactive Cropper & Alignment Modal */}
      {rawImageForCrop && (
        <ImageCropperModal
          imageUrl={rawImageForCrop}
          aspectRatio={1 / 3}
          showFrameOverlay="2x6"
          title="Align & Crop Event Frame Background"
          onConfirm={handleCropConfirmed}
          onCancel={() => {
            setRawImageForCrop(null)
            if (fileInputRef.current) fileInputRef.current.value = ''
          }}
        />
      )}

      {/* Top Header & Upload Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl shadow-xs border border-slate-200">
        <div>
          <h2 className="font-pixel text-xs sm:text-sm text-[#5b7fcb]">
            Event Backgrounds & Frame Overlays
          </h2>
          <p className="font-pixel text-[9px] text-[#8792c4] mt-0.5">
            Upload custom branded border graphics. Click the visibility toggle to hide or show in photobooth editor.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="btn95 is-primary !px-4 !py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Upload & Align Frame</span>
        </button>
      </div>

      {/* Built-in Presets */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-pixel text-[10px] text-[#8198ed]">
            Built-in Aesthetic Frames ({BUILTIN_BACKGROUNDS.length - 1})
          </h3>
          <span className="font-pixel text-[8px] text-slate-400">
            Standard Polaroid / Photobooth Layouts
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {BUILTIN_BACKGROUNDS.filter((b) => b.url).map((b) => {
            const isHidden = hiddenIds.has(b.id)
            return (
              <div
                key={b.id}
                className={`p-2 rounded-xl border border-slate-200 shadow-xs flex flex-col items-center justify-between text-center relative group transition-all ${
                  isHidden ? 'bg-slate-100 opacity-60' : 'bg-white hover:border-[#8198ed]'
                }`}
              >
                {/* Hide / Show Status Badge */}
                <button
                  type="button"
                  onClick={(e) => handleToggleHide(b.id, e)}
                  title={isHidden ? 'Click to show in photobooth' : 'Click to hide from photobooth'}
                  className={`absolute top-1.5 right-1.5 text-[8px] px-1.5 py-0.5 rounded flex items-center gap-0.5 font-pixel transition-all z-10 ${
                    isHidden
                      ? 'bg-rose-100 text-rose-600 hover:bg-rose-200'
                      : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                  }`}
                >
                  {isHidden ? (
                    <EyeOff className="w-2.5 h-2.5" />
                  ) : (
                    <Eye className="w-2.5 h-2.5" />
                  )}
                </button>

                <div className="w-full aspect-[2/3] flex items-center justify-center bg-[#f8fafc] rounded-lg p-1 mb-2 overflow-hidden shadow-inner mt-4">
                  <img
                    src={b.url!}
                    alt={b.label || b.id}
                    className="h-full w-full object-cover rounded"
                  />
                </div>
                <p className="font-pixel text-[8px] sm:text-[9px] text-[#5b7fcb] truncate w-full">
                  {b.label || b.id}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Custom Admin Event Frames */}
      <div>
        <h3 className="font-pixel text-[10px] text-[#8198ed] mb-3">
          Custom Event Frames ({customBgs.length})
        </h3>

        {customBgs.length === 0 ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-[#cdd6f0] hover:border-[#8198ed] rounded-2xl p-10 text-center cursor-pointer transition-all bg-white/50 hover:bg-white flex flex-col items-center justify-center"
          >
            <Frame className="w-8 h-8 text-[#8198ed] mb-2" />
            <p className="font-pixel text-xs text-[#5b7fcb] mb-1">No custom event frames yet</p>
            <p className="font-pixel text-[9px] text-[#8792c4] max-w-sm">
              Click to upload a custom frame. You can zoom, pan, and align it with live photo cutouts!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {customBgs.map((b) => {
              const isHidden = hiddenIds.has(b.id)
              return (
                <div
                  key={b.id}
                  className={`p-2 rounded-xl border border-slate-200 shadow-xs flex flex-col items-center justify-between text-center relative group transition-all ${
                    isHidden ? 'bg-slate-100 opacity-60' : 'bg-white hover:border-[#8198ed]'
                  }`}
                >
                  <div className="absolute top-1.5 right-1.5 flex items-center gap-1 z-10">
                    <button
                      type="button"
                      onClick={(e) => handleToggleHide(b.id, e)}
                      title={isHidden ? 'Click to show in photobooth' : 'Click to hide from photobooth'}
                      className={`text-[8px] px-1.5 py-0.5 rounded flex items-center gap-0.5 font-pixel transition-all ${
                        isHidden
                          ? 'bg-rose-100 text-rose-600 hover:bg-rose-200'
                          : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                      }`}
                    >
                      {isHidden ? (
                        <EyeOff className="w-2.5 h-2.5" />
                      ) : (
                        <Eye className="w-2.5 h-2.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(b.id)}
                      title="Delete frame"
                      className="p-1 bg-red-100 hover:bg-red-200 text-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  </div>

                  <div className="w-full aspect-[2/3] flex items-center justify-center bg-[#f8fafc] rounded-lg p-1 mb-2 overflow-hidden shadow-inner mt-4">
                    <img
                      src={b.url}
                      alt={b.label}
                      className="h-full w-full object-cover rounded"
                    />
                  </div>
                  <p className="font-pixel text-[8px] sm:text-[9px] text-[#5b7fcb] truncate w-full">
                    {b.label}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Save Title Modal */}
      {showSaveDialog && croppedUrl && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
            <h3 className="font-pixel text-xs sm:text-sm text-[#5b7fcb] mb-4">
              Name Your Event Frame
            </h3>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="w-32 aspect-[2/3] mx-auto bg-slate-100 rounded-xl p-1 overflow-hidden border border-slate-200 shadow-sm">
                <img src={croppedUrl} alt="Cropped preview" className="w-full h-full object-cover rounded-lg" />
              </div>

              <div>
                <label className="block font-pixel text-[10px] text-[#5b7fcb] mb-1.5">
                  Frame Title / Event Name:
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sarah & Alex Wedding, Neon 2026"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="w-full bg-[#f8fafc] border border-[#cdd6f0] focus:border-[#8198ed] focus:ring-2 focus:ring-[#8198ed]/30 px-3 py-2.5 text-xs font-mono outline-none rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSaveDialog(false)}
                  className="btn95 !px-4 !py-2 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!label.trim()}
                  className="btn95 is-primary !px-5 !py-2 text-xs font-bold"
                >
                  Save to Photobooth
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
