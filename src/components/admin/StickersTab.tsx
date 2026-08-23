import { useState, useEffect, useRef, useMemo } from 'react'
import {
  Plus,
  Eye,
  EyeOff,
  Trash2,
  Palette,
  Wand2,
  RotateCcw,
  Folder,
  FolderPlus,
  FolderMinus,
  CheckCircle2,
  Sparkles,
} from 'lucide-react'
import {
  getCustomStickers,
  saveCustomSticker,
  deleteCustomSticker,
  getHiddenAssets,
  toggleHideAsset,
  getStickerFolders,
  saveStickerFolder,
  deleteStickerFolder,
  type CustomSticker,
} from '../../lib/db'
import { BUILTIN_STICKERS, loadStickers, type StickerDef } from '../../lib/stickers'
import ImageCropperModal from './ImageCropperModal'
import { removeBackground } from '../../lib/bgRemover'

export default function StickersTab({ onStickersChange }: { onStickersChange?: () => void }) {
  const [allStickers, setAllStickers] = useState<StickerDef[]>([])
  const [customStickers, setCustomStickers] = useState<CustomSticker[]>([])
  const [folders, setFolders] = useState<string[]>([])
  const [activeFolder, setActiveFolder] = useState<string>('All')
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // New Folder Modal
  const [showNewFolderModal, setShowNewFolderModal] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  // Crop & Save Modal
  const [rawImageForCrop, setRawImageForCrop] = useState<string | null>(null)
  const [croppedSrc, setCroppedSrc] = useState<string | null>(null)
  const [originalCroppedSrc, setOriginalCroppedSrc] = useState<string | null>(null)
  const [isRemovingBg, setIsRemovingBg] = useState(false)
  const [bgRemoved, setBgRemoved] = useState(false)
  const [label, setLabel] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('Cute & Doodles')
  const [customCategoryInput, setCustomCategoryInput] = useState('')
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  const loadData = async () => {
    const [customData, hiddenAssets, loadedFolders, loadedAll] = await Promise.all([
      getCustomStickers(),
      getHiddenAssets(),
      getStickerFolders(),
      loadStickers(true),
    ])
    setCustomStickers(customData)
    setHiddenIds(new Set(hiddenAssets.stickers || []))
    setFolders(loadedFolders)
    setAllStickers(loadedAll)
    onStickersChange?.()
  }

  useEffect(() => {
    loadData()
  }, [])

  // Dynamic list of unique folders
  const allFolderTabs = useMemo(() => {
    const fromStickers = allStickers.map((s) => s.category || 'Cute & Doodles')
    const combined = Array.from(new Set(['All', ...folders, ...fromStickers]))
    return combined
  }, [folders, allStickers])

  // Filter stickers by active folder
  const displayedStickers = useMemo(() => {
    if (activeFolder === 'All') return allStickers
    return allStickers.filter(
      (s) => (s.category || 'Cute & Doodles').toLowerCase() === activeFolder.toLowerCase()
    )
  }, [allStickers, activeFolder])

  const handleToggleHide = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    await toggleHideAsset('stickers', id)
    await loadData()
    showToast('Visibility updated')
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setRawImageForCrop(reader.result as string)
      setLabel(file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '))
      // Default to active folder tab if not 'All'
      if (activeFolder !== 'All') {
        setSelectedCategory(activeFolder)
      }
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
      showToast('✨ Background removed!')
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

  const handleCreateNewFolder = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = newFolderName.trim()
    if (!trimmed) return
    const updated = await saveStickerFolder(trimmed)
    setFolders(updated)
    setActiveFolder(trimmed)
    setNewFolderName('')
    setShowNewFolderModal(false)
    showToast(`📁 Folder "${trimmed}" created!`)
  }

  const handleDeleteFolder = async (folderName: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`Delete folder "${folderName}"? Stickers inside will move to Cute & Doodles.`)) return
    const updated = await deleteStickerFolder(folderName)
    setFolders(updated)
    if (activeFolder === folderName) {
      setActiveFolder('All')
    }
    await loadData()
    showToast(`Folder "${folderName}" deleted`)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!croppedSrc || !label.trim()) return

    const finalCategory =
      selectedCategory === '__new__'
        ? customCategoryInput.trim() || 'Cute & Doodles'
        : selectedCategory

    // If new category was entered, save to folders list as well
    if (finalCategory && !folders.includes(finalCategory)) {
      await saveStickerFolder(finalCategory)
    }

    const id = `custom_sticker_${Date.now()}`
    await saveCustomSticker({
      id,
      label: label.trim(),
      src: croppedSrc,
      category: finalCategory,
    })

    setShowSaveDialog(false)
    setLabel('')
    setCroppedSrc(null)
    setOriginalCroppedSrc(null)
    setCustomCategoryInput('')
    if (fileInputRef.current) fileInputRef.current.value = ''
    await loadData()
    showToast(`✅ Sticker saved to folder "${finalCategory}"!`)
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Delete this custom sticker?')) return
    await deleteCustomSticker(id)
    await loadData()
    showToast('Sticker deleted')
  }

  return (
    <div className="space-y-6 relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-[#8198ed] text-white font-pixel text-xs px-4 py-2.5 rounded-xl shadow-2xl border-2 border-white animate-in slide-in-from-top duration-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-300" />
          <span>{toastMessage}</span>
        </div>
      )}

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

      {/* Top Header & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl shadow-xs border border-slate-200">
        <div>
          <h2 className="font-pixel text-xs sm:text-sm text-[#5b7fcb]">
            Sticker Folders & Packs Studio
          </h2>
          <p className="font-pixel text-[9px] text-[#8792c4] mt-0.5">
            Organize stickers into packs (MLBB, Valorant, Cute Doodles, etc.). Guests can browse folders in the photo booth!
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowNewFolderModal(true)}
            className="btn95 !px-3.5 !py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <FolderPlus className="w-3.5 h-3.5 text-[#5b7fcb]" />
            <span>+ New Folder</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn95 is-primary !px-4 !py-2 text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Upload Sticker</span>
          </button>
        </div>
      </div>

      {/* Folder / Category Tabs Bar */}
      <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-1.5 overflow-x-auto scrollbar-none">
        {allFolderTabs.map((folderName) => {
          const isSelected = activeFolder.toLowerCase() === folderName.toLowerCase()
          const count =
            folderName === 'All'
              ? allStickers.length
              : allStickers.filter(
                  (s) => (s.category || 'Cute & Doodles').toLowerCase() === folderName.toLowerCase()
                ).length
          const isCustomFolder = folderName !== 'All' && folderName !== 'Cute & Doodles'

          return (
            <div
              key={folderName}
              onClick={() => setActiveFolder(folderName)}
              className={`px-3 py-1.5 rounded-xl font-pixel text-[9px] whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer select-none group ${
                isSelected
                  ? 'bg-[#8198ed] text-white font-bold shadow-sm'
                  : 'bg-slate-50 text-slate-700 hover:bg-[#eef2ff] border border-slate-200'
              }`}
            >
              <Folder className="w-3 h-3 opacity-80" />
              <span>{folderName}</span>
              <span
                className={`text-[8px] font-mono px-1 py-0.2 rounded-full ${
                  isSelected ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {count}
              </span>

              {isCustomFolder && (
                <button
                  type="button"
                  onClick={(e) => handleDeleteFolder(folderName, e)}
                  title={`Delete folder "${folderName}"`}
                  className={`size-3.5 rounded-full flex items-center justify-center text-[8px] opacity-0 group-hover:opacity-100 transition-opacity ${
                    isSelected ? 'hover:bg-rose-400 text-white' : 'hover:bg-rose-100 text-rose-500'
                  }`}
                >
                  ✕
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Stickers Cards Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-pixel text-[10px] text-[#8198ed]">
            {activeFolder === 'All' ? 'All Stickers' : `Folder: ${activeFolder}`} ({displayedStickers.length})
          </h3>
          <span className="text-[9px] font-mono text-slate-400">
            Click sticker to toggle visibility or delete
          </span>
        </div>

        {displayedStickers.length === 0 ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-[#cdd6f0] hover:border-[#8198ed] rounded-xl p-8 text-center cursor-pointer transition-colors bg-white/40 flex flex-col items-center justify-center"
          >
            <Palette className="w-8 h-8 text-[#8198ed] mb-2" />
            <p className="font-pixel text-xs text-[#5b7fcb] mb-1">
              No stickers in &quot;{activeFolder}&quot; folder
            </p>
            <p className="font-pixel text-[9px] text-[#8792c4]">
              Click here to upload transparent PNG stickers directly into this folder!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {displayedStickers.map((s) => {
              const isHidden = hiddenIds.has(s.id)
              return (
                <div
                  key={s.id}
                  className={`p-2.5 rounded-xl border shadow-xs flex flex-col items-center justify-between text-center relative group transition-all ${
                    isHidden
                      ? 'bg-slate-100 opacity-60 border-slate-200'
                      : 'bg-white border-slate-200 hover:border-[#8198ed]'
                  }`}
                >
                  {/* Hide / Show Status Badge */}
                  <div className="absolute top-1 right-1 z-10 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => handleToggleHide(s.id, e)}
                      title={isHidden ? 'Click to show in photobooth' : 'Click to hide from photobooth'}
                      className={`text-[8px] px-1 py-0.5 rounded flex items-center gap-0.5 font-pixel transition-all cursor-pointer ${
                        isHidden
                          ? 'bg-rose-100 text-rose-600 hover:bg-rose-200'
                          : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                      }`}
                    >
                      {isHidden ? <EyeOff className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
                    </button>

                    {s.isCustom && (
                      <button
                        onClick={(e) => handleDelete(s.id, e)}
                        title="Delete sticker"
                        className="p-1 bg-red-100 hover:bg-red-200 text-red-600 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>

                  <div className="h-16 w-full flex items-center justify-center bg-[#f8fafc] rounded-lg p-1.5 mb-1.5 mt-3">
                    <img src={s.src} alt={s.label} className="max-h-full max-w-full object-contain" />
                  </div>

                  <p className="font-pixel text-[8px] text-[#5b7fcb] truncate w-full font-bold">
                    {s.label}
                  </p>

                  <span className="font-mono text-[7px] text-[#8198ed] bg-[#eef2ff] px-1.5 py-0.5 rounded mt-1 truncate max-w-full">
                    {s.category || 'Cute & Doodles'}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* New Folder Modal */}
      {showNewFolderModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setShowNewFolderModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-5 border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-3">
              <FolderPlus className="w-5 h-5 text-[#5b7fcb]" />
              <h3 className="font-pixel text-xs sm:text-sm text-[#5b7fcb]">
                Create Sticker Folder / Pack
              </h3>
            </div>

            <form onSubmit={handleCreateNewFolder} className="space-y-3">
              <div>
                <label className="block font-pixel text-[9px] text-[#5b7fcb] mb-1">
                  Folder Name (e.g. MLBB, Valorant, K-Pop, Genshin):
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Enter folder name..."
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="w-full bg-[#f8fafc] border border-[#cdd6f0] focus:border-[#8198ed] px-3 py-2 text-xs font-mono outline-none rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewFolderModal(false)}
                  className="btn95 !px-3.5 !py-1.5 text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newFolderName.trim()}
                  className="btn95 is-primary !px-4 !py-1.5 text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  Create Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Save Modal with Auto Remove BG & Transparency Checkerboard */}
      {showSaveDialog && croppedSrc && (
        <div
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setShowSaveDialog(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
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
                  <img
                    src={croppedSrc}
                    alt="Cropped sticker"
                    className="max-h-full max-w-full object-contain drop-shadow-sm"
                  />
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
                  placeholder="e.g. Layla Chibi, Jett Blade, Cute Star"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="w-full bg-[#f8fafc] border border-[#cdd6f0] focus:border-[#8198ed] focus:ring-2 focus:ring-[#8198ed]/30 px-3 py-2 text-xs font-mono outline-none rounded-xl"
                />
              </div>

              <div>
                <label className="block font-pixel text-[10px] text-[#5b7fcb] mb-1.5">
                  Folder / Pack:
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full bg-[#f8fafc] border border-[#cdd6f0] focus:border-[#8198ed] px-3 py-2 text-xs font-mono outline-none rounded-xl"
                >
                  {allFolderTabs.filter((f) => f !== 'All').map((folderName) => (
                    <option key={folderName} value={folderName}>
                      📁 {folderName}
                    </option>
                  ))}
                  <option value="__new__">➕ Type New Folder Name...</option>
                </select>

                {selectedCategory === '__new__' && (
                  <input
                    type="text"
                    required
                    placeholder="Enter new folder name..."
                    value={customCategoryInput}
                    onChange={(e) => setCustomCategoryInput(e.target.value)}
                    className="w-full mt-2 bg-[#f8fafc] border border-[#8198ed] px-3 py-1.5 text-xs font-mono outline-none rounded-xl"
                  />
                )}
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
                  className="btn95 is-primary !px-5 !py-2 text-xs font-bold cursor-pointer disabled:opacity-50"
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
