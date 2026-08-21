import { useState, useEffect, useRef } from 'react'
import { Plus, Eye, EyeOff, Trash2, Palette } from 'lucide-react'
import {
  getCustomStickers,
  saveCustomSticker,
  deleteCustomSticker,
  getHiddenAssets,
  toggleHideAsset,
  type CustomSticker,
} from '../../lib/db'
import { BUILTIN_STICKERS, loadStickers } from '../../lib/stickers'
import ImageCropperModal from './ImageCropperModal'

export default function StickersTab({ onStickersChange }: { onStickersChange?: () => void }) {
  const [customStickers, setCustomStickers] = useState<CustomSticker[]>([])
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())
  const [rawImageForCrop, setRawImageForCrop] = useState<string | null>(null)
  const [croppedSrc, setCroppedSrc] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const [category, setCategory] = useState('Cute')
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const loadData = async () => {
    const [data, hiddenAssets] = await Promise.all([
      getCustomStickers(),
      getHiddenAssets(),
    ])
    setCustomStickers(data)
    setHiddenIds(new Set(hiddenAssets.stickers || []))
    await loadStickers()
    onStickersChange?.()
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleToggleHide = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    await toggleHideAsset('stickers', id)
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
    setCroppedSrc(croppedDataUrl)
    setRawImageForCrop(null)
    setShowSaveDialog(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!croppedSrc || !label.trim()) return

    const id = `custom_sticker_${Date.now()}`
    await saveCustomSticker({
      id,
      label: label.trim(),
      src: croppedSrc,
      category,
    })

    setShowSaveDialog(false)
    setLabel('')
    setCroppedSrc(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    await loadData()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this custom sticker?')) return
    await deleteCustomSticker(id)
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

      {/* Interactive Cropper & Alignment Modal */}
      {rawImageForCrop && (
        <ImageCropperModal
          imageUrl={rawImageForCrop}
          aspectRatio={1}
          showFrameOverlay="none"
          title="Crop & Align Sticker Graphic"
          onConfirm={handleCropConfirmed}
          onCancel={() => {
            setRawImageForCrop(null)
            if (fileInputRef.current) fileInputRef.current.value = ''
          }}
        />
      )}

      {/* Top Header & Upload Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl shadow-xs border border-slate-200">
        <div>
          <h2 className="font-pixel text-xs sm:text-sm text-[#5b7fcb]">
            Stickers & Stamp Doodles
          </h2>
          <p className="font-pixel text-[9px] text-[#8792c4] mt-0.5">
            Stickers can be placed, dragged, rotated, and scaled on photo strips in the editor.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="btn95 is-primary !px-4 !py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Upload Sticker</span>
        </button>
      </div>

      {/* Built-in Presets */}
      <div>
        <h3 className="font-pixel text-[10px] text-[#8198ed] mb-3">
          Built-in Purikura Stickers ({BUILTIN_STICKERS.length})
        </h3>
        <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-9 gap-3">
          {BUILTIN_STICKERS.map((s) => {
            const isHidden = hiddenIds.has(s.id)
            return (
              <div
                key={s.id}
                className={`p-2 rounded-xl border border-slate-200 shadow-xs flex flex-col items-center justify-between text-center relative group transition-all ${
                  isHidden ? 'bg-slate-100 opacity-60' : 'bg-white hover:border-[#8198ed]'
                }`}
              >
                {/* Hide / Show Status Badge */}
                <button
                  type="button"
                  onClick={(e) => handleToggleHide(s.id, e)}
                  title={isHidden ? 'Click to show in photobooth' : 'Click to hide from photobooth'}
                  className={`absolute top-1 right-1 text-[8px] p-0.5 rounded flex items-center gap-0.5 font-pixel transition-all ${
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

                <div className="h-16 w-full flex items-center justify-center bg-[#f8fafc] rounded-lg p-1.5 mb-1.5 mt-2">
                  <img src={s.src} alt={s.label} className="max-h-full max-w-full object-contain" />
                </div>
                <p className="font-pixel text-[8px] text-[#5b7fcb] truncate w-full">{s.label}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Custom Admin Stickers */}
      <div>
        <h3 className="font-pixel text-[10px] text-[#8198ed] mb-3">
          Custom Uploaded Stickers ({customStickers.length})
        </h3>

        {customStickers.length === 0 ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-[#cdd6f0] hover:border-[#8198ed] rounded-2xl p-10 text-center cursor-pointer transition-all bg-white/50 hover:bg-white flex flex-col items-center justify-center"
          >
            <Palette className="w-8 h-8 text-[#8198ed] mb-2" />
            <p className="font-pixel text-xs text-[#5b7fcb] mb-1">No custom stickers uploaded yet</p>
            <p className="font-pixel text-[9px] text-[#8792c4] max-w-sm">
              Click here to upload PNG doodles, sparkles, hearts, event logos, or emojis!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-9 gap-3">
            {customStickers.map((s) => {
              const isHidden = hiddenIds.has(s.id)
              return (
                <div
                  key={s.id}
                  className={`p-2.5 rounded-xl border border-slate-200 shadow-xs flex flex-col items-center justify-between text-center relative group transition-all ${
                    isHidden ? 'bg-slate-100 opacity-60' : 'bg-white hover:border-[#8198ed]'
                  }`}
                >
                  <div className="absolute top-1 right-1 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => handleToggleHide(s.id, e)}
                      title={isHidden ? 'Click to show in photobooth' : 'Click to hide from photobooth'}
                      className={`text-[8px] p-0.5 rounded flex items-center gap-0.5 font-pixel transition-all ${
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
                      onClick={() => handleDelete(s.id)}
                      title="Delete sticker"
                      className="p-1 bg-red-100 hover:bg-red-200 text-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  </div>

                  <div className="h-16 w-full flex items-center justify-center bg-[#f8fafc] rounded-lg p-1.5 mb-1.5 mt-2">
                    <img src={s.src} alt={s.label} className="max-h-full max-w-full object-contain" />
                  </div>
                  <p className="font-pixel text-[8px] text-[#5b7fcb] truncate w-full">{s.label}</p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Save Modal */}
      {showSaveDialog && croppedSrc && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
            <h3 className="font-pixel text-xs sm:text-sm text-[#5b7fcb] mb-4">
              Name & Categorize Sticker
            </h3>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="size-24 mx-auto bg-slate-100 rounded-2xl p-2 flex items-center justify-center border border-slate-200 shadow-inner">
                <img src={croppedSrc} alt="Cropped sticker" className="max-h-full max-w-full object-contain" />
              </div>

              <div>
                <label className="block font-pixel text-[10px] text-[#5b7fcb] mb-1.5">
                  Sticker Name:
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sparkle Star, Event Mascot"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="w-full bg-[#f8fafc] border border-[#cdd6f0] focus:border-[#8198ed] focus:ring-2 focus:ring-[#8198ed]/30 px-3 py-2 text-xs font-mono outline-none rounded-xl"
                />
              </div>

              <div>
                <label className="block font-pixel text-[10px] text-[#5b7fcb] mb-1.5">
                  Category:
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-[#f8fafc] border border-[#cdd6f0] focus:border-[#8198ed] px-3 py-2 text-xs font-mono outline-none rounded-xl"
                >
                  <option value="Cute">Cute & Doodles</option>
                  <option value="Event">Event Branding & Logos</option>
                  <option value="Frames">Mini Badges & Frames</option>
                  <option value="Text">Words & Speech Bubbles</option>
                </select>
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
                  Save Sticker
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
