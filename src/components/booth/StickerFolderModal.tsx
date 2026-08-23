import { useState, useMemo } from 'react'
import { Folder, Search, X, Sparkles, Trash2, Check } from 'lucide-react'
import { type StickerDef } from '../../lib/stickers'
import { recordStickerUsage } from '../../lib/db'

type Props = {
  isOpen: boolean
  onClose: () => void
  stickers: StickerDef[]
  folders: string[]
  onSelectSticker: (src: string, id: string) => void
  placedStickers: { src: string }[]
}

export default function StickerFolderModal({
  isOpen,
  onClose,
  stickers,
  folders,
  onSelectSticker,
  placedStickers,
}: Props) {
  const [selectedFolder, setSelectedFolder] = useState<string>('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [justAddedId, setJustAddedId] = useState<string | null>(null)

  // Compute folder list including 'All' and any dynamically present categories in stickers
  const allFolderNames = useMemo(() => {
    const fromStickers = stickers.map((s) => s.category || 'Cute & Doodles')
    const unique = Array.from(new Set(['All', ...folders, ...fromStickers]))
    return unique
  }, [folders, stickers])

  // Filter stickers based on active folder and search query
  const filteredStickers = useMemo(() => {
    return stickers.filter((s) => {
      const matchFolder =
        selectedFolder === 'All' ||
        (s.category || 'Cute & Doodles').toLowerCase() === selectedFolder.toLowerCase()

      const matchSearch =
        !searchQuery.trim() ||
        s.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.category || '').toLowerCase().includes(searchQuery.toLowerCase())

      return matchFolder && matchSearch
    })
  }, [stickers, selectedFolder, searchQuery])

  if (!isOpen) return null

  const handlePickSticker = (s: StickerDef) => {
    recordStickerUsage(s.id)
    onSelectSticker(s.src, s.id)
    setJustAddedId(s.id)
    setTimeout(() => setJustAddedId(null), 1200)
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-[#efefff] border-3 border-[#8198ed] rounded-2xl shadow-2xl max-w-3xl w-full p-4 sm:p-6 max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b-2 border-[#8198ed] shrink-0">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-[#8198ed] text-white flex items-center justify-center shadow-xs">
              <Folder className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-pixel text-xs sm:text-sm text-[#5b7fcb]">
                Sticker Packs & Folders
              </h3>
              <p className="font-pixel text-[8px] sm:text-[9px] text-[#8792c4]">
                Choose from MLBB, Valorant, Anime, or Cute Doodles to stamp on your photo!
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="size-7 rounded-lg bg-white hover:bg-rose-100 text-slate-500 hover:text-rose-600 font-bold flex items-center justify-center cursor-pointer transition-colors shadow-xs"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search & Stats Bar */}
        <div className="pt-3 pb-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 shrink-0">
          {/* Search bar */}
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-[#8198ed] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search sticker name or pack..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-[#cdd6f0] focus:border-[#8198ed] pl-8 pr-3 py-1.5 rounded-xl font-mono text-xs text-[#334155] outline-none shadow-xs"
            />
          </div>

          <span className="font-pixel text-[9px] text-[#8792c4] self-end sm:self-center">
            {filteredStickers.length} {filteredStickers.length === 1 ? 'sticker' : 'stickers'} available
          </span>
        </div>

        {/* Folder / Category Horizontal Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-2 mb-2 scrollbar-none shrink-0 border-b border-[#cdd6f0]/60">
          {allFolderNames.map((folderName) => {
            const isSelected = selectedFolder.toLowerCase() === folderName.toLowerCase()
            const count =
              folderName === 'All'
                ? stickers.length
                : stickers.filter(
                    (s) => (s.category || 'Cute & Doodles').toLowerCase() === folderName.toLowerCase()
                  ).length

            return (
              <button
                key={folderName}
                type="button"
                onClick={() => {
                  setSelectedFolder(folderName)
                  setSearchQuery('')
                }}
                className={`px-3 py-1.5 rounded-xl font-pixel text-[9px] whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                  isSelected
                    ? 'bg-[#8198ed] text-white font-bold shadow-md scale-[1.02]'
                    : 'bg-white text-slate-700 hover:bg-[#eef2ff] border border-slate-200'
                }`}
              >
                <Folder className="w-3 h-3 opacity-80" />
                <span>{folderName}</span>
                <span
                  className={`text-[8px] font-mono px-1 py-0.2 rounded-full ${
                    isSelected ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Sticker Cards Grid (Scrollable) */}
        <div className="flex-1 overflow-y-auto pr-1 py-2 scrollbar-thin min-h-[220px]">
          {filteredStickers.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-white/50 rounded-xl border border-dashed border-[#cdd6f0]">
              <Sparkles className="w-8 h-8 text-[#8198ed] mb-2" />
              <p className="font-pixel text-xs text-[#5b7fcb]">No stickers found in this folder</p>
              <p className="font-pixel text-[9px] text-[#8792c4] mt-1">
                Try selecting another folder or searching with different keywords.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-7 gap-2.5 sm:gap-3">
              {filteredStickers.map((s) => {
                const placedCount = placedStickers.filter((st) => st.src === s.src).length
                const wasJustAdded = justAddedId === s.id

                return (
                  <div
                    key={s.id}
                    onClick={() => handlePickSticker(s)}
                    className={`group relative p-2 rounded-xl bg-white border-2 hover:border-[#8198ed] flex flex-col items-center justify-between text-center transition-all cursor-pointer shadow-xs hover:shadow-md hover:scale-105 active:scale-95 ${
                      wasJustAdded ? 'border-emerald-400 bg-emerald-50' : 'border-transparent'
                    }`}
                  >
                    {/* Active Placed Count Badge */}
                    {placedCount > 0 && (
                      <span className="absolute top-1 right-1 bg-[#8198ed] text-white text-[9px] font-bold rounded-full size-4 flex items-center justify-center shadow-xs z-10">
                        {placedCount}
                      </span>
                    )}

                    {/* Just Added Confirmation Indicator */}
                    {wasJustAdded && (
                      <span className="absolute top-1 left-1 bg-emerald-500 text-white text-[8px] font-pixel px-1 py-0.5 rounded shadow-xs z-10 animate-bounce">
                        +1
                      </span>
                    )}

                    {/* Sticker Image Container */}
                    <div className="h-16 sm:h-18 w-full flex items-center justify-center bg-[#f8fafc] group-hover:bg-[#eef2ff]/50 rounded-lg p-1.5 transition-colors">
                      <img
                        src={s.src}
                        alt={s.label}
                        className="max-h-full max-w-full object-contain pointer-events-none drop-shadow-sm group-hover:scale-110 transition-transform duration-200"
                      />
                    </div>

                    <p className="font-pixel text-[8px] text-[#5b7fcb] truncate w-full mt-1.5">
                      {s.label}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-[#8198ed]/40 flex items-center justify-between shrink-0">
          <p className="text-[10px] text-[#8792c4] font-mono">
            💡 Click any sticker to add it to your photo strip!
          </p>
          <button
            type="button"
            onClick={onClose}
            className="btn95 is-primary !px-5 !py-1.5 text-xs font-bold cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
