import { useState, useEffect, useRef } from 'react'
import {
  getCustomBackgrounds,
  saveCustomBackground,
  deleteCustomBackground,
  type CustomBackground,
} from '../../lib/db'
import { BUILTIN_BACKGROUNDS, preloadBackgrounds } from '../../lib/strip'
import ImageCropperModal from './ImageCropperModal'

export default function BackgroundsTab({ onBackgroundsChange }: { onBackgroundsChange?: () => void }) {
  const [customBgs, setCustomBgs] = useState<CustomBackground[]>([])
  const [rawImageForCrop, setRawImageForCrop] = useState<string | null>(null)
  const [croppedUrl, setCroppedUrl] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const loadData = async () => {
    const data = await getCustomBackgrounds()
    setCustomBgs(data)
    await preloadBackgrounds()
    onBackgroundsChange?.()
  }

  useEffect(() => {
    loadData()
  }, [])

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
            Upload custom branded border graphics with interactive zoom, pan & photo cutout alignment.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="btn95 is-primary !px-4 !py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shrink-0"
        >
          <span>➕</span>
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
          {BUILTIN_BACKGROUNDS.filter((b) => b.url).map((b) => (
            <div
              key={b.id}
              className="bg-white p-2 rounded-xl border border-slate-200 shadow-xs flex flex-col items-center justify-between text-center group hover:border-[#8198ed] transition-all"
            >
              <div className="w-full aspect-[2/3] flex items-center justify-center bg-[#f8fafc] rounded-lg p-1 mb-2 overflow-hidden shadow-inner">
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
          ))}
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
            <span className="text-3xl mb-2">🖼️</span>
            <p className="font-pixel text-xs text-[#5b7fcb] mb-1">No custom event frames yet</p>
            <p className="font-pixel text-[9px] text-[#8792c4] max-w-sm">
              Click to upload a custom frame. You can zoom, pan, and align it with live photo cutouts!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {customBgs.map((b) => (
              <div
                key={b.id}
                className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs flex flex-col items-center justify-between text-center relative group hover:border-[#8198ed] transition-all"
              >
                <div className="w-full aspect-[2/3] flex items-center justify-center bg-[#f8fafc] rounded-lg p-1 mb-2 overflow-hidden shadow-inner">
                  <img src={b.url} alt={b.label} className="h-full w-full object-cover rounded" />
                </div>
                <p className="font-pixel text-[9px] text-[#5b7fcb] truncate w-full">{b.label}</p>
                <button
                  type="button"
                  onClick={() => handleDelete(b.id)}
                  title="Delete frame"
                  className="absolute top-2 right-2 size-6 bg-red-100 hover:bg-red-200 text-red-600 rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                >
                  ✕
                </button>
              </div>
            ))}
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
