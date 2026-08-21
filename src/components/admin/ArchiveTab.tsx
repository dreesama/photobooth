import { useState, useEffect, useRef } from 'react'
import {
  getArchive,
  deleteArchiveItem,
  toggleArchiveFavorite,
  incrementPrintCount,
  clearArchive,
  type ArchiveItem,
} from '../../lib/db'

export default function ArchiveTab({ onStatsChange }: { onStatsChange?: () => void }) {
  const [items, setItems] = useState<ArchiveItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterFav, setFilterFav] = useState(false)
  const [selectedItem, setSelectedItem] = useState<ArchiveItem | null>(null)
  const [activeModal, setActiveModal] = useState<'detail' | 'print' | 'social' | null>(null)
  const [printLayout, setPrintLayout] = useState<'double_4x6' | 'single' | 'sheet_4x6'>('double_4x6')
  const [socialFormat, setSocialFormat] = useState<'story' | 'square'>('square')
  const [socialDataUrl, setSocialDataUrl] = useState<string>('')
  const [copying, setCopying] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const data = await getArchive()
      setItems(data)
      onStatsChange?.()
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (!confirm('Are you sure you want to delete this photo session from the archive?')) return
    await deleteArchiveItem(id)
    if (selectedItem?.id === id) {
      setSelectedItem(null)
      setActiveModal(null)
    }
    await loadData()
  }

  const handleFavorite = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    await toggleArchiveFavorite(id)
    await loadData()
    if (selectedItem && selectedItem.id === id) {
      setSelectedItem((prev) => (prev ? { ...prev, favorite: !prev.favorite } : null))
    }
  }

  const handleClearAll = async () => {
    if (!confirm('WARNING: This will permanently delete ALL archived photos. Are you sure?')) return
    await clearArchive()
    setSelectedItem(null)
    setActiveModal(null)
    await loadData()
  }

  const handlePrint = async (item: ArchiveItem) => {
    await incrementPrintCount(item.id)
    await loadData()

    // Open print window with dedicated photobooth print stylesheet
    const printWin = window.open('', '_blank')
    if (!printWin) return

    const isDouble = printLayout === 'double_4x6'

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print - ${new Date(item.timestamp).toLocaleString()}</title>
          <style>
            @page {
              size: 4in 6in;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
              background: #fff;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              width: 100vw;
              box-sizing: border-box;
            }
            .print-container {
              display: flex;
              gap: 0.15in;
              align-items: center;
              justify-content: center;
              max-width: 3.85in;
              max-height: 5.85in;
            }
            .strip-img {
              max-height: 5.8in;
              width: auto;
              object-fit: contain;
            }
          </style>
        </head>
        <body>
          <div class="print-container">
            <img src="${item.stripDataUrl}" class="strip-img" />
            ${isDouble ? `<img src="${item.stripDataUrl}" class="strip-img" />` : ''}
          </div>
          <script>
            window.onload = () => {
              window.print();
              setTimeout(() => window.close(), 500);
            };
          </script>
        </body>
      </html>
    `)
    printWin.document.close()
  }

  // Generate 1:1 square or 9:16 story social graphic
  useEffect(() => {
    if (!selectedItem || activeModal !== 'social') return
    const img = new Image()
    img.src = selectedItem.stripDataUrl
    img.onload = () => {
      const isStory = socialFormat === 'story'
      const w = isStory ? 1080 : 1080
      const h = isStory ? 1920 : 1080

      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')!

      // Gradient background
      const grad = ctx.createLinearGradient(0, 0, 0, h)
      grad.addColorStop(0, '#eaf4ff')
      grad.addColorStop(1, '#91b5ff')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, w, h)

      // Decorative stars
      ctx.fillStyle = '#ffffff'
      ctx.font = '28px "Press Start 2P", monospace'
      ctx.textAlign = 'center'
      ctx.fillText('✦', 120, 180)
      ctx.fillText('✧', 960, 240)
      ctx.fillText('✦', 880, h - 200)
      ctx.fillText('✧', 160, h - 260)

      // Header watermark for story
      if (isStory) {
        ctx.fillStyle = '#5b7fcb'
        ctx.font = '36px "Press Start 2P", monospace'
        ctx.fillText('OmoideCam', w / 2, 160)
        ctx.fillStyle = '#8198ed'
        ctx.font = '18px "Press Start 2P", monospace'
        ctx.fillText('PHOTOBOOTH MOMENT', w / 2, 210)
      }

      // Draw centered strip with drop shadow
      const stripRatio = img.width / img.height
      const maxStripH = isStory ? h * 0.72 : h * 0.85
      const drawH = maxStripH
      const drawW = drawH * stripRatio
      const drawX = (w - drawW) / 2
      const drawY = isStory ? 260 : (h - drawH) / 2

      ctx.shadowColor = 'rgba(70, 95, 160, 0.35)'
      ctx.shadowBlur = 32
      ctx.shadowOffsetY = 16
      ctx.drawImage(img, drawX, drawY, drawW, drawH)
      ctx.shadowColor = 'transparent'

      setSocialDataUrl(canvas.toDataURL('image/png'))
    }
  }, [selectedItem, activeModal, socialFormat])

  const copyImageToClipboard = async () => {
    if (!socialDataUrl) return
    setCopying(true)
    try {
      const res = await fetch(socialDataUrl)
      const blob = await res.blob()
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
      alert('Photo copied to clipboard! Ready to paste into Instagram, Discord, or messages.')
    } catch {
      alert('Clipboard write not supported by this browser. Use "Download Image" instead.')
    } finally {
      setCopying(false)
    }
  }

  const downloadAll = () => {
    items.forEach((item, idx) => {
      setTimeout(() => {
        const a = document.createElement('a')
        a.href = item.stripDataUrl
        a.download = `photobooth-${new Date(item.timestamp).toISOString().slice(0, 10)}-${idx + 1}.png`
        a.click()
      }, idx * 250)
    })
  }

  const filtered = items.filter((item) => {
    if (filterFav && !item.favorite) return false
    if (search) {
      const dateStr = new Date(item.timestamp).toLocaleString().toLowerCase()
      const tmpl = (item.templateId || '').toLowerCase()
      const q = search.toLowerCase()
      return dateStr.includes(q) || tmpl.includes(q)
    }
    return true
  })

  return (
    <div className="space-y-6">
      {/* Top Filter & Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl bevel-in">
        <div className="flex items-center gap-2.5 flex-1 min-w-[240px]">
          <input
            type="text"
            placeholder="Search by date or layout..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-[#f8fafc] bevel-in px-3 py-1.5 text-xs font-mono outline-none rounded"
          />
          <button
            onClick={() => setFilterFav((v) => !v)}
            className={`btn95 !px-3 !py-1.5 text-xs flex items-center gap-1 ${
              filterFav ? '!bg-[#fbbf24] !text-black !border-[#d97706]' : ''
            }`}
          >
            <span>★</span>
            <span>Favorites</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={downloadAll}
            disabled={items.length === 0}
            className="btn95 !px-3 !py-1.5 text-xs font-bold"
          >
            📥 Download All ({items.length})
          </button>
          <button
            onClick={handleClearAll}
            disabled={items.length === 0}
            className="btn95 !px-3 !py-1.5 text-xs text-red-600 hover:!bg-red-50"
          >
            🗑️ Clear
          </button>
        </div>
      </div>

      {/* Grid of Archived Photos */}
      {loading ? (
        <div className="py-16 text-center text-[#8792c4] font-pixel text-sm">
          Loading archive...
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center bg-white/60 rounded-xl bevel-in p-8">
          <p className="font-pixel text-sm text-[#8198ed] mb-2">No photos in archive yet</p>
          <p className="font-pixel text-[10px] text-[#8792c4]">
            Take photos in the photobooth and they will automatically appear here for printing and posting!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filtered.map((item) => {
            const date = new Date(item.timestamp)
            return (
              <div
                key={item.id}
                onClick={() => {
                  setSelectedItem(item)
                  setActiveModal('detail')
                }}
                className="group bg-white p-2 rounded-lg shadow-sm hover:shadow-md hover:scale-[1.02] transition-all cursor-pointer flex flex-col justify-between bevel-in"
              >
                {/* Photo Strip Thumbnail */}
                <div className="relative aspect-[1/2] bg-[#f8fafc] rounded overflow-hidden flex items-center justify-center">
                  <img
                    src={item.stripDataUrl}
                    alt=""
                    className="w-full h-full object-contain pointer-events-none"
                  />
                  {/* Favorite star */}
                  <button
                    onClick={(e) => handleFavorite(item.id, e)}
                    className="absolute top-1.5 right-1.5 text-sm p-1 rounded bg-black/40 hover:bg-black/70 text-white leading-none transition-all"
                  >
                    {item.favorite ? '⭐' : '☆'}
                  </button>
                  {/* Printed count badge */}
                  {(item.printedCount ?? 0) > 0 && (
                    <span className="absolute bottom-1.5 left-1.5 bg-[#8198ed] text-white text-[8px] font-pixel px-1.5 py-0.5 rounded shadow">
                      🖨️ {item.printedCount}
                    </span>
                  )}
                </div>

                {/* Metadata & Quick Actions */}
                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="font-pixel text-[8px] text-[#5b7fcb] font-bold truncate">
                      {item.templateId || 'Strip'}
                    </p>
                    <p className="font-mono text-[9px] text-slate-400">
                      {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedItem(item)
                        setActiveModal('print')
                      }}
                      title="Quick Print"
                      className="text-xs p-1 hover:bg-slate-100 rounded"
                    >
                      🖨️
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedItem(item)
                        setActiveModal('social')
                      }}
                      title="Post / Social Export"
                      className="text-xs p-1 hover:bg-slate-100 rounded"
                    >
                      ✨
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Detail / Action Modal */}
      {selectedItem && activeModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="bg-[#efefff] border-3 border-[#8198ed] rounded-xl shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto p-4 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b-2 border-[#8198ed] mb-4">
              <div className="flex items-center gap-2">
                <span className="font-pixel text-sm text-[#5b7fcb]">
                  {activeModal === 'detail' && '📸 Photo Session Detail'}
                  {activeModal === 'print' && '🖨️ Print Photo Strip'}
                  {activeModal === 'social' && '✨ Export for Social / Posting'}
                </span>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="font-pixel text-xs text-[#8792c4] hover:text-red-500 font-bold px-2 py-1"
              >
                ✕ Close
              </button>
            </div>

            {/* Modal Tabs / Mode Switcher */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setActiveModal('detail')}
                className={`btn95 !px-3 !py-1 text-xs ${activeModal === 'detail' ? 'is-primary' : ''}`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveModal('print')}
                className={`btn95 !px-3 !py-1 text-xs ${activeModal === 'print' ? 'is-primary' : ''}`}
              >
                Print Studio
              </button>
              <button
                onClick={() => setActiveModal('social')}
                className={`btn95 !px-3 !py-1 text-xs ${activeModal === 'social' ? 'is-primary' : ''}`}
              >
                Social / Post Export
              </button>
            </div>

            {/* Content: Overview */}
            {activeModal === 'detail' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4 items-start">
                  <div className="bg-white p-2 rounded bevel-in shadow-sm flex items-center justify-center">
                    <img
                      src={selectedItem.stripDataUrl}
                      alt="Strip preview"
                      className="max-h-[380px] w-auto object-contain"
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="bg-white p-3 rounded bevel-in space-y-1.5">
                      <p className="font-pixel text-[10px] text-[#5b7fcb]">
                        Date & Time: {new Date(selectedItem.timestamp).toLocaleString()}
                      </p>
                      <p className="font-pixel text-[10px] text-[#8792c4]">
                        Layout: {selectedItem.templateId}
                      </p>
                      <p className="font-pixel text-[10px] text-[#8792c4]">
                        Filter: {selectedItem.filter || 'original'}
                      </p>
                      <p className="font-pixel text-[10px] text-[#8792c4]">
                        Times Printed: {selectedItem.printedCount || 0}
                      </p>
                    </div>

                    {/* Raw Captured Frames */}
                    {selectedItem.rawFrames && selectedItem.rawFrames.length > 0 && (
                      <div>
                        <p className="font-pixel text-[9px] text-[#8198ed] mb-1.5">
                          Individual Camera Captures ({selectedItem.rawFrames.length}):
                        </p>
                        <div className="grid grid-cols-4 gap-1.5">
                          {selectedItem.rawFrames.map((f, i) => (
                            <a
                              key={i}
                              href={f}
                              download={`shot-${i + 1}.png`}
                              className="relative aspect-[4/3] rounded overflow-hidden border border-[#cdd6f0] hover:scale-105 transition-transform"
                            >
                              <img src={f} alt="" className="w-full h-full object-cover" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 pt-2">
                      <a
                        href={selectedItem.stripDataUrl}
                        download={`photobooth-${selectedItem.id}.png`}
                        className="btn95 is-primary !px-4 !py-2 text-xs font-bold"
                      >
                        💾 Download High-Res PNG
                      </a>
                      <button
                        onClick={() => setActiveModal('print')}
                        className="btn95 !px-4 !py-2 text-xs font-bold"
                      >
                        🖨️ Print
                      </button>
                      <button
                        onClick={() => handleDelete(selectedItem.id)}
                        className="btn95 !px-3 !py-2 text-xs text-red-600 hover:!bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Content: Print Studio */}
            {activeModal === 'print' && (
              <div className="space-y-4">
                <div className="bg-white p-3 rounded bevel-in space-y-2">
                  <p className="font-pixel text-xs text-[#5b7fcb] font-bold">Print Layout Option:</p>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setPrintLayout('double_4x6')}
                      className={`p-2 rounded border-2 text-center text-xs font-pixel ${
                        printLayout === 'double_4x6'
                          ? 'border-[#8198ed] bg-[#eef2ff] text-[#5b7fcb]'
                          : 'border-slate-200 hover:border-[#8198ed]'
                      }`}
                    >
                      <p className="font-bold">Dual 2x6</p>
                      <p className="text-[8px] text-slate-500 mt-1">2 strips on 4x6 paper (Classic)</p>
                    </button>
                    <button
                      onClick={() => setPrintLayout('single')}
                      className={`p-2 rounded border-2 text-center text-xs font-pixel ${
                        printLayout === 'single'
                          ? 'border-[#8198ed] bg-[#eef2ff] text-[#5b7fcb]'
                          : 'border-slate-200 hover:border-[#8198ed]'
                      }`}
                    >
                      <p className="font-bold">Single Strip</p>
                      <p className="text-[8px] text-slate-500 mt-1">1 centered strip</p>
                    </button>
                    <button
                      onClick={() => setPrintLayout('sheet_4x6')}
                      className={`p-2 rounded border-2 text-center text-xs font-pixel ${
                        printLayout === 'sheet_4x6'
                          ? 'border-[#8198ed] bg-[#eef2ff] text-[#5b7fcb]'
                          : 'border-slate-200 hover:border-[#8198ed]'
                      }`}
                    >
                      <p className="font-bold">Full 4x6 Sheet</p>
                      <p className="text-[8px] text-slate-500 mt-1">Single grid layout</p>
                    </button>
                  </div>
                </div>

                {/* Print Sheet Visual Preview */}
                <div className="bg-[#cbd5e1] p-4 rounded-lg flex items-center justify-center">
                  <div className="bg-white shadow-xl aspect-[4/6] w-[220px] p-2 flex items-center justify-center gap-2 border border-slate-300">
                    <img
                      src={selectedItem.stripDataUrl}
                      alt=""
                      className="max-h-full w-auto object-contain"
                    />
                    {printLayout === 'double_4x6' && (
                      <img
                        src={selectedItem.stripDataUrl}
                        alt=""
                        className="max-h-full w-auto object-contain border-l border-dashed border-slate-300 pl-1"
                      />
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => handlePrint(selectedItem)}
                    className="btn95 is-primary !px-6 !py-2.5 text-xs font-bold flex items-center gap-1.5"
                  >
                    <span>🖨️</span>
                    <span>Send to Printer (4x6 Photopaper)</span>
                  </button>
                </div>
              </div>
            )}

            {/* Content: Social / Posting */}
            {activeModal === 'social' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-white p-2.5 rounded bevel-in">
                  <span className="font-pixel text-[10px] text-[#5b7fcb]">Select Format:</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSocialFormat('square')}
                      className={`btn95 !px-3 !py-1 text-[10px] ${
                        socialFormat === 'square' ? 'is-primary' : ''
                      }`}
                    >
                      1:1 Square (Feed)
                    </button>
                    <button
                      onClick={() => setSocialFormat('story')}
                      className={`btn95 !px-3 !py-1 text-[10px] ${
                        socialFormat === 'story' ? 'is-primary' : ''
                      }`}
                    >
                      9:16 Vertical (Story / Reel)
                    </button>
                  </div>
                </div>

                {/* Social Graphic Preview */}
                <div className="bg-slate-800 p-4 rounded-lg flex items-center justify-center">
                  {socialDataUrl && (
                    <img
                      src={socialDataUrl}
                      alt="Social export"
                      className="max-h-[340px] w-auto rounded shadow-lg object-contain"
                    />
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    onClick={copyImageToClipboard}
                    disabled={copying}
                    className="btn95 !px-4 !py-2 text-xs font-bold"
                  >
                    {copying ? 'Copying...' : '📋 Copy Image to Clipboard'}
                  </button>

                  <a
                    href={socialDataUrl}
                    download={`omoide-post-${socialFormat}-${Date.now()}.png`}
                    className="btn95 is-primary !px-5 !py-2 text-xs font-bold"
                  >
                    💾 Download Social Post
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
