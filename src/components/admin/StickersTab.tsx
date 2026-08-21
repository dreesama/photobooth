import { useState, useEffect, useRef } from 'react'
import { Plus, Eye, EyeOff, Trash2, Palette, Wand2, RotateCcw } from 'lucide-react'
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
import { removeBackground } from '../../lib/bgRemover'

export default function StickersTab({ onStickersChange }: { onStickersChange?: () => void }) {
  const [customStickers, setCustomStickers] = useState<CustomSticker[]>([])
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())
  const [rawImageForCrop, setRawImageForCrop] = useState<string | null>(null)
  const [croppedSrc, setCroppedSrc] = useState<string | null>(null)
  const [originalCroppedSrc, setOriginalCroppedSrc] = useState<string | null>(null)
  const [isRemovingBg, setIsRemovingBg] = useState(false)
  const [bgRemoved, setBgRemoved] = useState(false)
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
    setOriginalCroppedSrc(croppedDataUrl)
    setCroppedSrc(croppedDataUrl)
    setBgRemoved(false)
    setRawImageForCrop(null)
    setShowSaveDialog(true)
  }

  const handleMagicRemoveBg = async () => {
    if (!croppedSrc || isRemovingBg) return
    setIsRemovingBg(true)
    try {
      const transparentDataUrl = await removeBackground(croppedSrc, {
        tolerance: 35,
        targetColor: 'auto',
        feather: true,
      })
      setCroppedSrc(transparentDataUrl)
      setBgRemoved(true)
    } catch (err) {
      console.warn('Sticker BG removal failed:', err)
    } finally {
      setIsRemovingBg(false)
    }
  }

  const handleRestoreOriginal = () => {
    if (originalCroppedSrc) {
      setCroppedSrc(originalCroppedSrc)
      setBgRemoved(false)
    }
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
    setOriginalCroppedSrc(null)
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
        accept="image/png,image/webp,image/jpeg,image/svg+xml"
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
          className="btn95 is-primary !px-4 !py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shrink-0 cursor-pointer"
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
                  className={`absolute top-1 right-1 text-[8px] p-0.5 rounded flex items-center gap-0.5 font-pixel transition-all cursor-pointer ${
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
            className="border-2 border-dashed border-[#cdd6f0] hover:border-[#8198ed] rounded-xl p-8 text-center cursor-pointer transition-colors bg-white/40 flex flex-col items-center justify-center"
          >
            <Palette className="w-8 h-8 text-[#8198ed] mb-2" />
            <p className="font-pixel text-xs text-[#5b7fcb] mb-1">No custom stickers uploaded yet</p>
            <p className="font-pixel text-[9px] text-[#8792c4]">
              Click here to upload transparent PNG stickers or event badges!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-9 gap-3">
            {customStickers.map((s) => {
              const isHidden = hiddenIds.has(s.id)
              return (
                <div
                  key={s.id}
                  className={`p-2 rounded-xl border border-slate-200 shadow-xs flex flex-col items-center justify-between text-center relative group transition-all ${
                    isHidden ? 'bg-slate-100 opacity-60' : 'bg-white hover:border-[#8198ed]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={(e) => handleToggleHide(s.id, e)}
                    title={isHidden ? 'Click to show in photobooth' : 'Click to hide from photobooth'}
                    className={`absolute top-1 right-1 text-[8px] p-0.5 rounded flex items-center gap-0.5 font-pixel transition-all cursor-pointer ${
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

                  <button
                    onClick={() => handleDelete(s.id)}
                    title="Delete sticker"
                    className="absolute top-1 left-1 p-1 bg-red-100 hover:bg-red-200 text-red-600 rounded-md opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Save Modal with Auto Remove BG & Transparency Checkerboard */}
      {showSaveDialog && croppedSrc && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
            <h3 className="font-pixel text-xs sm:text-sm text-[#5b7fcb] mb-4">
              Name & Categorize Sticker
            </h3>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Checkerboard Preview */}
              <div className="flex flex-col items-center gap-2">
                <div
                  className="size-32 rounded-2xl p-2 flex items-center justify-center border border-slate-200 shadow-inner overflow-hidden"
                  style={{
                    backgroundImage:
                      'linear-gradient(45deg, #f1f5f9 25%, transparent 25%), linear-gradient(-45deg, #f1f5f9 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f1f5f9 75%), linear-gradient(-45deg, transparent 75%, #f1f5f9 75%)',
                    backgroundSize: '16px 16px',
                    backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                  }}
                >
                  <img src={croppedSrc} alt="Cropped sticker" className="max-h-full max-w-full object-contain drop-shadow-sm" />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleMagicRemoveBg}
                    disabled={isRemovingBg}
                    className="bg-gradient-to-r from-[#8198ed] to-[#5b7fcb] hover:from-[#6e88e8] hover:to-[#4a6bb8] text-white text-[11px] font-bold py-1 px-3 rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    <Wand2 className={`w-3.5 h-3.5 ${isRemovingBg ? 'animate-spin' : ''}`} />
                    <span>{isRemovingBg ? 'Removing BG...' : '✨ Auto Remove BG'}</span>
                  </button>

                  {bgRemoved && (
                    <button
                      type="button"
                      onClick={handleRestoreOriginal}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] py-1 px-2 rounded-lg flex items-center gap-1 font-mono cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Undo</span>
                    </button>
                  )}
                </div>
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
                  className="btn95 !px-4 !py-2 text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!label.trim()}
                  className="btn95 is-primary !px-5 !py-2 text-xs font-bold cursor-pointer"
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
