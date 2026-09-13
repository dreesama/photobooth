import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import QRCode from 'qrcode'
import JSZip from 'jszip'
import {
  Download,
  QrCode,
  Ban,
  Trash2,
  Check,
  Copy,
  X,
  ExternalLink,
  RotateCcw,
  Palette,
  FileArchive,
  Image as ImageIcon,
  Folder,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react'
import {
  BACKGROUNDS,
  FILTERS,
  LOGOS,
  TEXT_COLORS,
  preloadBackgrounds,
  reloadBackgrounds,
  composeStrip,
  composeStripAsync,
  renderStripToCanvas,
  getBgImage,
  stripSize,
  FONT_OPTIONS,
  type Background,
  type FilterId,
  type LogoLang,
  type Template,
  type FontOption,
} from '../../lib/strip'
import {
  STICKERS,
  loadStickers,
  getRecentOrPopularStickers,
  type PlacedSticker,
  type StickerDef,
} from '../../lib/stickers'
import {
  saveToArchive,
  saveActiveSessionState,
  getActiveSessionState,
  getStickerFolders,
  recordStickerUsage,
} from '../../lib/db'
import { uploadPhotoStrip } from '../../lib/upload'
import StickerFolderModal from './StickerFolderModal'

type Props = {
  frames: HTMLCanvasElement[]
  template: Template
  onRetake: () => void
  onDone: () => void
}

export default function Editor({ frames, template, onRetake, onDone }: Props) {
  const [filter, setFilter] = useState<FilterId>('original')
  const [bg, setBg] = useState<Background>(BACKGROUNDS[0])
  const [frameColor] = useState('#ffffff')
  const [logo, setLogo] = useState<LogoLang>('en')
  const [customText, setCustomText] = useState<string>('IT GUILD')
  const [textColor, setTextColor] = useState<string>('#5b7fcb')
  const [fontStyle, setFontStyle] = useState<string>('pixel')
  const [fontSizeScale, setFontSizeScale] = useState<number>(1.0)
  const [isBold, setIsBold] = useState<boolean>(true)
  const [isItalic, setIsItalic] = useState<boolean>(false)
  const [stickers, setStickers] = useState<PlacedSticker[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [ready, setReady] = useState(0)

  // Unique session ID for persistent archive entry
  const archiveSessionIdRef = useRef<string>(
    `session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  )

  // QR Modal State
  const [showShare, setShowShare] = useState(false)
  const [qrLoading, setQrLoading] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [hostedUrl, setHostedUrl] = useState<string>('')
  const [qrError, setQrError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [showQrOnFrame, setShowQrOnFrame] = useState(true)
  const [sessionQrUrl, setSessionQrUrl] = useState<string>('')

  const [bgsList, setBgsList] = useState<Background[]>(BACKGROUNDS)
  const [stickersList, setStickersList] = useState<StickerDef[]>(STICKERS)
  const [showFolderModal, setShowFolderModal] = useState(false)
  const [stickerFolders, setStickerFolders] = useState<string[]>([])

  const quickStickers = useMemo(() => {
    return getRecentOrPopularStickers(stickersList, 10)
  }, [stickersList, stickers])

  const stageRef = useRef<HTMLDivElement | null>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const drag = useRef<{ uid: string } | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const archiveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cached first frame thumbnail for instant filter previews (zero lag)
  const firstFrameThumb = useMemo(() => {
    return frames[0] ? frames[0].toDataURL('image/jpeg', 0.75) : ''
  }, [frames])

  // Raw frames base64 computed once per capture session, never during sticker drag
  const rawFramesDataUrls = useMemo(() => {
    return frames.map((f) => f.toDataURL('image/jpeg', 0.85))
  }, [frames])

  // Pre-generate high-contrast QR code for frame footer
  useEffect(() => {
    const targetUrl = `${window.location.origin}/?photo=${archiveSessionIdRef.current}`
    QRCode.toDataURL(targetUrl, {
      margin: 1,
      width: 280,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((url) => {
        setSessionQrUrl(url)
      })
      .catch((e) => console.warn('Session QR generation warning:', e))
  }, [])

  useEffect(() => {
    reloadBackgrounds(false).then((loadedBgs) => {
      setBgsList(loadedBgs)
      loadedBgs.forEach((b) => {
        if (b.url) {
          const img = getBgImage(b.url)
          if (img && !img.complete) {
            img.onload = () => setReady((r) => r + 1)
          }
        }
      })
    })

    loadStickers(false).then((loadedStickers) => {
      setStickersList(loadedStickers)
    })

    getStickerFolders().then((f) => {
      setStickerFolders(f)
    })

    // Restore customization states if session exists
    async function restoreActiveCustomizations() {
      const saved = await getActiveSessionState()
      if (saved) {
        if (saved.filter) setFilter(saved.filter as FilterId)
        if (saved.customText !== undefined) setCustomText(saved.customText)
        if (saved.textColor) setTextColor(saved.textColor)
        if (saved.stickers && Array.isArray(saved.stickers)) setStickers(saved.stickers)
        if (saved.backgroundId) {
          const matchingBg = BACKGROUNDS.find((b) => b.id === saved.backgroundId)
          if (matchingBg) handleSelectBg(matchingBg)
        }
      }
    }
    restoreActiveCustomizations()
  }, [])

  // Fast direct GPU canvas render on the preview stage
  useEffect(() => {
    if (!previewCanvasRef.current || frames.length === 0 || !template) return
    renderStripToCanvas(previewCanvasRef.current, {
      frames,
      template,
      filter,
      background: bg,
      frameColor,
      stickers: [],
      logo,
      customText,
      textColor,
      fontStyle,
      fontSizeScale,
      isBold,
      isItalic,
      qrDataUrl: sessionQrUrl,
      showQrOnFrame,
    })
  }, [frames, template, filter, bg, frameColor, logo, customText, textColor, fontStyle, fontSizeScale, isBold, isItalic, sessionQrUrl, showQrOnFrame, ready])

  // Debounced persistence: saves customization state without blocking UI during dragging
  useEffect(() => {
    if (frames.length > 0 && template) {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        saveActiveSessionState({
          step: 'edit',
          templateId: template.id,
          rawFrames: rawFramesDataUrls,
          filter,
          backgroundId: bg.id,
          customText,
          textColor,
          stickers,
          updatedAt: Date.now(),
        }).catch(() => {})
      }, 500)
    }
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [frames, template, rawFramesDataUrls, filter, bg.id, customText, textColor, stickers])

  // Continuous background auto-sync to Archive: ensures latest background, filter, text, and stickers are saved
  useEffect(() => {
    if (frames.length === 0 || !template) return

    if (archiveTimerRef.current) clearTimeout(archiveTimerRef.current)
    archiveTimerRef.current = setTimeout(async () => {
      try {
        const c = await composeStripAsync({
          frames,
          template,
          filter,
          background: bg,
          frameColor,
          stickers,
          logo,
          customText,
          textColor,
          fontStyle,
          fontSizeScale,
          isBold,
          isItalic,
          qrDataUrl: sessionQrUrl,
          showQrOnFrame,
        })
        const stripDataUrl = c.toDataURL('image/png')
        await saveToArchive({
          id: archiveSessionIdRef.current,
          stripDataUrl,
          rawFrames: rawFramesDataUrls,
          templateId: template.id,
          filter,
          backgroundId: bg.id,
          stickers,
          customText,
          textColor,
        })
      } catch (e) {
        console.warn('Archive auto-sync error:', e)
      }
    }, 600)

    return () => {
      if (archiveTimerRef.current) clearTimeout(archiveTimerRef.current)
    }
  }, [frames, template, rawFramesDataUrls, filter, bg, frameColor, stickers, logo, customText, textColor, fontStyle, fontSizeScale, isBold, isItalic, sessionQrUrl, showQrOnFrame, ready])

  const { width, height } = stripSize(template)

  const handleSelectBg = (selectedBg: Background) => {
    setBg(selectedBg)
    if (selectedBg.url) {
      const img = getBgImage(selectedBg.url)
      if (img && !img.complete) {
        img.onload = () => setReady((r) => r + 1)
      } else {
        setReady((r) => r + 1)
      }
    } else {
      setReady((r) => r + 1)
    }
  }

  const addSticker = (src: string) => {
    const uid = `st_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const count = stickers.length
    const offsetX = 0.5 + ((count % 5) - 2) * 0.04
    const offsetY = 0.5 + ((Math.floor(count / 5) % 5) - 2) * 0.04
    const next: PlacedSticker = {
      uid,
      src,
      x: Math.min(0.85, Math.max(0.15, offsetX)),
      y: Math.min(0.85, Math.max(0.15, offsetY)),
      scale: 1,
      rotation: 0,
    }
    setStickers((list) => [...list, next])
    setSelected(uid)
  }

  const deleteSticker = (uid: string, e?: React.MouseEvent | React.PointerEvent) => {
    if (e) {
      e.stopPropagation()
      e.preventDefault()
    }
    setStickers((list) => list.filter((s) => s.uid !== uid))
    if (selected === uid) setSelected(null)
  }

  const onStickerDown = (uid: string) => (e: PointerEvent) => {
    e.stopPropagation()
    setSelected(uid)
    drag.current = { uid }
    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    } catch {}
  }

  const onStageMove = (e: PointerEvent) => {
    const dragging = drag.current
    if (!dragging || !stageRef.current) return
    const currentUid = dragging.uid
    const r = stageRef.current.getBoundingClientRect()
    if (!r.width || !r.height) return
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    animFrameRef.current = requestAnimationFrame(() => {
      setStickers((l) => l.map((s) => (s.uid === currentUid ? { ...s, x, y } : s)))
    })
  }

  // Handle Delete/Backspace to delete selected sticker
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
        if (
          document.activeElement?.tagName === 'INPUT' ||
          document.activeElement?.tagName === 'TEXTAREA'
        ) {
          return
        }
        setStickers((l) => l.filter((s) => s.uid !== selected))
        setSelected(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selected])

  const download = () => {
    try {
      const c = composeStrip({
        frames,
        template,
        filter,
        background: bg,
        frameColor,
        stickers,
        logo: null,
        customText,
        textColor,
        fontStyle,
        fontSizeScale,
        isBold,
        isItalic,
        qrDataUrl: sessionQrUrl,
        showQrOnFrame,
      })

      const dataUrl = c.toDataURL('image/png')
      const fileName = `itguild-${Date.now()}.png`

      // Convert base64 dataUrl to native Blob for 100% reliable desktop downloading
      try {
        const byteString = atob(dataUrl.split(',')[1])
        const mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0]
        const ab = new ArrayBuffer(byteString.length)
        const ia = new Uint8Array(ab)
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i)
        }
        const blob = new Blob([ab], { type: mimeString })
        const blobUrl = URL.createObjectURL(blob)

        const link = document.createElement('a')
        link.href = blobUrl
        link.download = fileName
        document.body.appendChild(link)
        link.click()
        setTimeout(() => {
          document.body.removeChild(link)
          URL.revokeObjectURL(blobUrl)
        }, 1000)
      } catch (blobErr) {
        // Fallback for restricted webview environments
        const link = document.createElement('a')
        link.href = dataUrl
        link.download = fileName
        document.body.appendChild(link)
        link.click()
        setTimeout(() => document.body.removeChild(link), 300)
      }

      // Save to local archive in background
      saveToArchive({
        id: archiveSessionIdRef.current,
        stripDataUrl: dataUrl,
        rawFrames: rawFramesDataUrls,
        templateId: template.id,
        filter,
        backgroundId: bg.id,
        stickers,
        customText,
        textColor,
      }).catch((e) => console.warn('Archive save error:', e))
    } catch (e) {
      console.warn('Download error:', e)
    }
  }

  const [showDownloadMenu, setShowDownloadMenu] = useState(false)

  const downloadAllZip = async () => {
    setShowDownloadMenu(false)
    try {
      const c = composeStrip({
        frames,
        template,
        filter,
        background: bg,
        frameColor,
        stickers,
        logo: null,
        customText,
        textColor,
        fontStyle,
        fontSizeScale,
        isBold,
        isItalic,
        qrDataUrl: sessionQrUrl,
        showQrOnFrame,
      })
      const stripDataUrl = c.toDataURL('image/png')
      const zip = new JSZip()
      zip.file(`itguild-${Date.now()}-framed-strip.png`, stripDataUrl.split(',')[1], { base64: true })

      frames.forEach((f, i) => {
        const frameData = f.toDataURL('image/jpeg', 0.92).split(',')[1]
        zip.file(`photo-${i + 1}.jpg`, frameData, { base64: true })
      })

      const blob = await zip.generateAsync({ type: 'blob' })
      const blobUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = `itguild-all-photos-${Date.now()}.zip`
      document.body.appendChild(link)
      link.click()
      setTimeout(() => {
        document.body.removeChild(link)
        URL.revokeObjectURL(blobUrl)
      }, 1000)
    } catch (e) {
      console.warn('ZIP download error:', e)
    }
  }

  // Handle QR Modal Open & Instant Fast Upload
  const handleOpenQR = async () => {
    setShowShare(true)
    setQrLoading(true)
    setQrDataUrl('')
    setHostedUrl('')
    setQrError(null)

    try {
      const c = await composeStripAsync({
        frames,
        template,
        filter,
        background: bg,
        frameColor,
        stickers,
        logo: null,
        customText,
        textColor,
        fontStyle,
        fontSizeScale,
        isBold,
        isItalic,
        qrDataUrl: sessionQrUrl,
        showQrOnFrame,
      })
      // Use high-quality JPEG (quality 0.90) for 85%+ smaller file size and 5x faster upload
      const stripDataUrl = c.toDataURL('image/jpeg', 0.90)

      // Save latest customized photo strip with all backgrounds, stickers, and filters to Archive
      saveToArchive({
        id: archiveSessionIdRef.current,
        stripDataUrl,
        rawFrames: rawFramesDataUrls,
        templateId: template.id,
        filter,
        backgroundId: bg.id,
        stickers,
        customText,
        textColor,
      }).catch(() => {})

      // Upload both framed strip and individual photo captures for complete softcopy download
      const directUrl = await uploadPhotoStrip(stripDataUrl, rawFramesDataUrls, archiveSessionIdRef.current)
      setHostedUrl(directUrl)

      // Generate QR Code strictly for the public hosted image link
      const qrCodeUrl = await QRCode.toDataURL(directUrl, {
        margin: 1,
        width: 260,
        color: { dark: '#1e293b', light: '#ffffff' },
      })
      setQrDataUrl(qrCodeUrl)
    } catch (err: any) {
      console.warn('QR generation error:', err)
      setQrError('Could not connect to image server. Please check your internet connection or save directly.')
    } finally {
      setQrLoading(false)
    }
  }

  // Handle Done Button: Save latest finalized strip to archive, trigger cloud upload, and return to layout
  const handleDone = async () => {
    try {
      const c = composeStrip({
        frames,
        template,
        filter,
        background: bg,
        frameColor,
        stickers,
        logo: null,
        customText,
        textColor,
        fontStyle,
        fontSizeScale,
        isBold,
        isItalic,
        qrDataUrl: sessionQrUrl,
        showQrOnFrame,
      })
      const stripDataUrl = c.toDataURL('image/jpeg', 0.90)

      // Save to Archive DB
      await saveToArchive({
        id: archiveSessionIdRef.current,
        stripDataUrl,
        rawFrames: rawFramesDataUrls,
        templateId: template.id,
        filter,
        backgroundId: bg.id,
        stickers,
        customText,
        textColor,
      }).catch((e) => console.warn('Archive save error:', e))

      // Also trigger cloud upload in background with raw frames and matching session ID
      uploadPhotoStrip(stripDataUrl, rawFramesDataUrls, archiveSessionIdRef.current).catch(() => {})
    } catch (e) {
      console.warn('Done save error:', e)
    } finally {
      onDone()
    }
  }

  const copyLink = () => {
    navigator.clipboard?.writeText(hostedUrl || window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="w-full h-screen max-h-screen overflow-hidden flex flex-row select-none">
      {/* ================= LEFT: Preview Title + Photo Strip + Download/QR/Done ================= */}
      <div
        className={`flex flex-col justify-between p-3 sm:p-4 lg:p-5 h-full max-h-screen overflow-hidden min-h-0 relative transition-all duration-300 ${
          isSidebarCollapsed ? 'w-full' : 'w-[46%] sm:w-[44%] lg:w-[42%] border-r-2 border-[#8198ed]/20'
        } shrink-0`}
      >
        {/* Top Header: Preview Title + Retake + Collapsible Sidebar Toggle */}
        <div className="w-full flex items-center justify-between shrink-0 mb-1 px-1">
          <div className="flex items-center gap-2 sm:gap-3">
            <h2
              className="font-pixel text-[#5b7fcb] text-xl sm:text-2xl lg:text-3xl tracking-wider select-none"
              style={{
                textShadow: '0 3px 0 #9cb6ec, 0 6px 14px rgba(91,127,203,0.3)',
              }}
            >
              Preview
            </h2>

            <button
              type="button"
              onClick={onRetake}
              className="font-pixel text-[10px] sm:text-xs text-[#5b7fcb] hover:text-[#3d5ba0] select-none cursor-pointer flex items-center gap-1.5 bg-white/90 hover:bg-white px-3 py-1.5 rounded-lg border border-[#cdd6f0] shadow-xs hover:shadow-md transition-all font-bold"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#5b7fcb]" />
              <span>Retake</span>
            </button>
          </div>

          {/* Collapsible Sidebar Toggle Button */}
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed((v) => !v)}
            className="font-pixel text-[10px] sm:text-xs text-[#5b7fcb] hover:text-[#3d5ba0] select-none cursor-pointer flex items-center gap-1.5 bg-white/90 hover:bg-white px-2.5 py-1.5 rounded-lg border border-[#cdd6f0] shadow-xs hover:shadow-md transition-all font-bold"
            title={isSidebarCollapsed ? 'Show Customization Sidebar' : 'Hide Sidebar (Larger Preview)'}
          >
            {isSidebarCollapsed ? (
              <>
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Tools & Filters</span>
              </>
            ) : (
              <>
                <span>Hide Tools</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>

        {/* Center: 100% Fit Photo Strip Canvas (Never cut or clipped horizontally/vertically) */}
        <div className="my-auto flex-1 min-h-0 min-w-0 w-full flex items-center justify-center py-1 sm:py-2 px-1 overflow-hidden">
          <div
            ref={stageRef}
            className="relative bg-white shadow-[0_20px_50px_rgba(90,110,185,0.3)] rounded-xs select-none touch-none"
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              aspectRatio: `${width} / ${height}`,
              width: 'auto',
              height: 'auto',
            }}
            onPointerMove={onStageMove}
            onPointerUp={() => (drag.current = null)}
            onPointerCancel={() => (drag.current = null)}
            onPointerDown={() => setSelected(null)}
          >
            {/* Direct GPU Rendered Canvas for 60fps instant previews */}
            <canvas
              ref={previewCanvasRef}
              className="w-full h-full block pointer-events-none rounded-xs"
            />

            {stickers.map((s) => {
              const isSel = selected === s.uid
              return (
                <div
                  key={s.uid}
                  onPointerDown={onStickerDown(s.uid)}
                  onPointerMove={onStageMove}
                  onPointerUp={() => (drag.current = null)}
                  onPointerCancel={() => (drag.current = null)}
                  className={`absolute leading-none touch-none cursor-move select-none ${
                    isSel ? 'z-30' : 'z-20'
                  }`}
                  style={{
                    left: `${s.x * 100}%`,
                    top: `${s.y * 100}%`,
                    transform: `translate(-50%,-50%) rotate(${s.rotation}deg)`,
                    width: `${s.scale * 48}px`,
                  }}
                >
                  <div
                    className={`relative w-full h-full ${
                      isSel ? 'ring-2 ring-dashed ring-[#8198ed] rounded-sm' : ''
                    }`}
                  >
                    <img
                      src={s.src}
                      alt=""
                      className="w-full h-full object-contain pointer-events-none select-none drop-shadow-sm"
                    />

                    {/* Small Delete Button attached to top-right of selected sticker */}
                    {isSel && (
                      <button
                        type="button"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => deleteSticker(s.uid, e)}
                        className="absolute -top-3 -right-3 size-6 bg-rose-500 hover:bg-rose-600 active:scale-90 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-md cursor-pointer z-40 transition-transform"
                        title="Delete sticker"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Bottom Bar: Download, QR, Done (Always visible) */}
        <div className="flex items-center gap-3 sm:gap-4 w-full max-w-[500px] mx-auto shrink-0 pt-1.5 pb-1">
          {/* Download Button with outer white container card & Dropdown */}
          <div className="flex-1 p-0.5 bg-white rounded-xl shadow-[0_4px_12px_rgba(100,120,190,0.18)] relative">
            <button
              type="button"
              onClick={() => setShowDownloadMenu((v) => !v)}
              className="w-full bg-[#8198ed] hover:bg-[#6e88e8] active:translate-y-0.5 text-white py-3 sm:py-3.5 rounded-lg font-pixel text-xs sm:text-sm tracking-wider shadow-[2px_2px_0px_#5b6fbc] transition-all cursor-pointer select-none text-center flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>Download</span>
            </button>

            {showDownloadMenu && (
              <div className="absolute bottom-full left-0 mb-2 w-60 bg-white rounded-xl shadow-2xl p-2 flex flex-col gap-1 border border-slate-200 z-50 animate-in zoom-in-95 duration-150">
                <button
                  type="button"
                  onClick={() => {
                    setShowDownloadMenu(false)
                    download()
                  }}
                  className="w-full font-pixel text-[10px] sm:text-xs text-left px-3 py-2.5 rounded-lg hover:bg-[#eef2ff] text-[#5b7fcb] flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <ImageIcon className="w-4 h-4 text-[#8198ed]" />
                  <span>Framed Strip (.PNG)</span>
                </button>
                <button
                  type="button"
                  onClick={downloadAllZip}
                  className="w-full font-pixel text-[10px] sm:text-xs text-left px-3 py-2.5 rounded-lg hover:bg-[#eef2ff] text-[#5b7fcb] flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <FileArchive className="w-4 h-4 text-[#52b788]" />
                  <span>All Photos + Strip (.ZIP)</span>
                </button>
              </div>
            )}
          </div>

          {/* QR Button with outer white container card */}
          <div className="flex-1 p-0.5 bg-white rounded-xl shadow-[0_4px_12px_rgba(100,120,190,0.18)]">
            <button
              type="button"
              onClick={handleOpenQR}
              className="w-full bg-[#8198ed] hover:bg-[#6e88e8] active:translate-y-0.5 text-white py-3 sm:py-3.5 rounded-lg font-pixel text-xs sm:text-sm tracking-wider shadow-[2px_2px_0px_#5b6fbc] transition-all cursor-pointer select-none flex items-center justify-center gap-2"
            >
              <QrCode className="w-4 h-4" />
              <span>QR</span>
            </button>
          </div>

          {/* Done Button: saves finalized photo to archive and returns to layout picker for next guest */}
          <div className="flex-1 p-0.5 bg-white rounded-xl shadow-[0_4px_12px_rgba(100,120,190,0.18)]">
            <button
              type="button"
              onClick={handleDone}
              className="w-full bg-[#52b788] hover:bg-[#40916c] active:translate-y-0.5 text-white py-3 sm:py-3.5 rounded-lg font-pixel text-xs sm:text-sm tracking-wider shadow-[2px_2px_0px_#2d6a4f] transition-all cursor-pointer select-none flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>Done</span>
            </button>
          </div>
        </div>
      </div>

      {/* ================= RIGHT: Full Height Customization Panel ================= */}
      <div
        className={`bg-[#efefff] h-full max-h-screen transition-all duration-300 overflow-y-auto shadow-2xl flex flex-col justify-start scrollbar-thin ${
          isSidebarCollapsed ? 'hidden w-0 p-0' : 'flex-1 px-4 sm:px-6 lg:px-8 py-4 sm:py-5 space-y-6'
        }`}
      >
        {/* Top Panel Header */}
        <div className="flex items-center justify-between pb-2.5 border-b-2 border-[#8198ed]/20 shrink-0">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-[#5b7fcb]" />
            <h3 className="font-pixel text-[#5b7fcb] text-base sm:text-lg font-bold tracking-wider">
              Tools & Filters
            </h3>
          </div>
        </div>

          {/* ---- 1. Filters ---- */}
          <section>
            <h3 className="font-pixel text-[#5b7fcb] text-lg sm:text-xl tracking-wider mb-3 select-none">
              Filters
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 sm:gap-4">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className="flex flex-col items-center group cursor-pointer text-left"
                >
                  <div
                    className={`relative w-full aspect-square overflow-hidden bg-[#1e2337] rounded-2xl transition-all ${
                      filter === f.id
                        ? 'ring-4 ring-[#8198ed] shadow-lg scale-105'
                        : 'hover:scale-105 opacity-90 hover:opacity-100 border-2 border-white/60'
                    }`}
                  >
                    {firstFrameThumb && (
                      <img
                        src={firstFrameThumb}
                        alt=""
                        className="w-full h-full object-cover pointer-events-none"
                        style={{ filter: f.id === 'pixelate' ? 'contrast(1.05)' : f.css }}
                      />
                    )}
                    {filter === f.id && (
                      <span className="absolute top-1.5 right-1.5 size-6 rounded-full bg-[#5b7fcb] text-white grid place-items-center text-xs font-bold shadow-md">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                  <p className="font-pixel text-[9px] sm:text-[10px] text-[#5b7fcb] text-center mt-2 truncate w-full font-bold group-hover:text-[#4162b8]">
                    {f.label}
                  </p>
                </button>
              ))}
            </div>
          </section>

          {/* ---- 2. Background ---- */}
          <section>
            <h3 className="font-pixel text-[#5b7fcb] text-lg sm:text-xl tracking-wider mb-2.5 select-none">
              Background
            </h3>
            <div className="flex gap-4 overflow-x-auto pt-1 pb-3 px-1 scrollbar-thin items-center">
              {/* None Option */}
              <button
                onClick={() => handleSelectBg(BACKGROUNDS[0])}
                className={`shrink-0 size-24 sm:size-28 rounded-2xl bg-[#ffe5ec] border-2 border-[#ffb3c6] flex flex-col items-center justify-center transition-all cursor-pointer ${
                  bg.id === 'none' ? 'ring-4 ring-[#ff80a0] shadow-xl scale-105' : 'hover:scale-105'
                }`}
                title="No background (plain white)"
              >
                <Ban className="w-8 h-8 text-rose-400 mb-1" />
                <span className="font-pixel text-[9px] text-rose-400 font-bold">Plain</span>
              </button>

              {/* Pattern/Frame image backgrounds */}
              {bgsList.filter((b) => b.kind === 'image' && b.url).map((b) => (
                <button
                  key={b.id}
                  onClick={() => handleSelectBg(b)}
                  className={`shrink-0 size-24 sm:size-28 rounded-2xl overflow-hidden border-2 bg-white transition-all cursor-pointer ${
                    bg.id === b.id
                      ? 'border-[#8198ed] ring-4 ring-[#8198ed]/50 shadow-xl scale-105'
                      : 'border-[#cdd6f0] hover:scale-105'
                  }`}
                >
                  <img src={b.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </section>

          {/* ---- 3. Stickers ---- */}
          <section>
            <h3 className="font-pixel text-[#5b7fcb] text-lg sm:text-xl tracking-wider mb-3 select-none">
              Stickers
            </h3>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-4 gap-3 sm:gap-4 max-w-[680px]">
              {/* Clear All Stickers Button */}
              <button
                type="button"
                onClick={() => setStickers([])}
                className="size-24 sm:size-28 rounded-2xl bg-[#ffe5ec] border-2 border-[#ffb3c6] flex flex-col items-center justify-center transition-all cursor-pointer hover:scale-105 shadow-sm"
                title="Clear all stickers"
              >
                <Trash2 className="w-7 h-7 text-rose-400 mb-1" />
                <span className="font-pixel text-[10px] text-rose-400 font-bold">Clear</span>
              </button>

              {/* Browse Packs / Folders Button */}
              <button
                type="button"
                onClick={() => setShowFolderModal(true)}
                className="relative size-24 sm:size-28 rounded-2xl bg-gradient-to-tr from-[#5b6fbc] to-[#8198ed] text-white border-2 border-white/60 hover:border-white hover:scale-105 active:scale-95 flex flex-col items-center justify-center transition-all cursor-pointer shadow-md group"
                title="Browse sticker folders (MLBB, Valorant, etc.)"
              >
                <Folder className="w-8 h-8 sm:w-9 sm:h-9 text-white group-hover:scale-110 transition-transform drop-shadow-sm mb-1" />
                <span className="font-pixel text-[9px] sm:text-[10px] text-white font-bold">Packs</span>
              </button>

              {/* Top 10 Most / Recently Used Stickers */}
              {quickStickers.map((s) => {
                const placedCount = stickers.filter((st) => st.src === s.src).length
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      recordStickerUsage(s.id)
                      addSticker(s.src)
                    }}
                    className="relative size-24 sm:size-28 rounded-2xl bg-[#e8eeff] hover:bg-white border-2 border-transparent hover:border-[#8198ed] hover:scale-105 active:scale-95 flex flex-col items-center justify-center p-2.5 transition-all cursor-pointer shadow-sm group"
                    title={`${s.label} (${s.category || 'General'})`}
                  >
                    <img
                      src={s.src}
                      alt={s.label}
                      className="max-h-13 sm:max-h-15 max-w-full object-contain pointer-events-none group-hover:scale-105 transition-transform"
                    />
                    <span className="font-pixel text-[9px] sm:text-[10px] text-[#5b7fcb] truncate w-full mt-1.5 text-center font-bold">
                      {s.label}
                    </span>
                    {placedCount > 0 && (
                      <span className="absolute top-1.5 right-1.5 bg-[#8198ed] text-white text-xs font-bold rounded-full size-6 flex items-center justify-center shadow-md">
                        {placedCount}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </section>

          {/* ---- 4. Custom Text ---- */}
          <section>
            <h3 className="font-pixel text-[#5b7fcb] text-lg sm:text-xl tracking-wider mb-3 select-none">
              Text
            </h3>
            <div className="flex flex-col gap-3.5 max-w-[620px]">
              {/* Custom Text Input Bar */}
              <div className="flex gap-2.5 w-full">
                <input
                  type="text"
                  placeholder="Write custom text (or leave blank)..."
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  className="flex-1 bg-white border-2 border-[#cdd6f0] focus:border-[#8198ed] focus:ring-2 focus:ring-[#8198ed]/30 px-4 py-3 rounded-xl font-mono text-sm text-[#334155] outline-none shadow-xs"
                />
                <button
                  type="button"
                  onClick={() => setCustomText('')}
                  className="btn95 !px-5 !py-2.5 text-xs sm:text-sm font-bold text-[#ff5c8a] shrink-0"
                  title="Clear text (Blank Polaroid)"
                >
                  ✕ Blank
                </button>
              </div>

              {/* Font Style Picker */}
              <div className="flex flex-col gap-2 pt-1">
                <span className="font-pixel text-[11px] sm:text-xs text-[#5b7fcb] font-bold tracking-wider">Font Style:</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {FONT_OPTIONS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFontStyle(f.id)}
                      className={`py-3 px-3.5 min-h-[64px] rounded-xl border-2 text-center transition-all cursor-pointer shadow-xs truncate flex flex-col items-center justify-center gap-1 ${
                        fontStyle === f.id
                          ? 'bg-[#8198ed] text-white border-[#5b6fbc] ring-2 ring-[#8198ed]/50 shadow-md scale-[1.02]'
                          : 'bg-white text-[#334155] border-[#cdd6f0] hover:border-[#8198ed] hover:bg-[#f8faff]'
                      }`}
                    >
                      <span
                        className="text-base sm:text-lg leading-tight"
                        style={{ fontFamily: f.family.replace(/"/g, '') }}
                      >
                        {f.sample}
                      </span>
                      <span
                        className={`text-[9px] font-pixel truncate opacity-85 ${
                          fontStyle === f.id ? 'text-white' : 'text-[#8792c4]'
                        }`}
                      >
                        {f.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Font Size & Formatting Toolbar (Bold / Italic / Size Slider & Stepper) */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                {/* Bold & Italic Toggles */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-pixel text-[11px] text-[#5b7fcb] font-bold tracking-wider mr-0.5">Style:</span>
                  <button
                    type="button"
                    onClick={() => setIsBold((b) => !b)}
                    title="Toggle Bold"
                    className={`size-10 rounded-xl border-2 font-bold text-base flex items-center justify-center transition-all cursor-pointer shadow-xs ${
                      isBold
                        ? 'bg-[#8198ed] text-white border-[#5b6fbc] shadow-md ring-2 ring-[#8198ed]/50'
                        : 'bg-white text-slate-600 border-[#cdd6f0] hover:bg-[#f8faff]'
                    }`}
                  >
                    <span className="font-serif font-black">B</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsItalic((i) => !i)}
                    title="Toggle Italic"
                    className={`size-10 rounded-xl border-2 text-base flex items-center justify-center transition-all cursor-pointer shadow-xs ${
                      isItalic
                        ? 'bg-[#8198ed] text-white border-[#5b6fbc] shadow-md ring-2 ring-[#8198ed]/50'
                        : 'bg-white text-slate-600 border-[#cdd6f0] hover:bg-[#f8faff]'
                    }`}
                  >
                    <span className="font-serif italic font-bold">I</span>
                  </button>
                </div>

                {/* Font Size Slider & Stepper */}
                <div className="flex-1 flex items-center gap-2.5 bg-white px-4 py-2.5 rounded-xl border-2 border-[#cdd6f0] shadow-xs">
                  <span className="font-pixel text-[11px] text-[#5b7fcb] font-bold tracking-wider shrink-0">Size:</span>
                  <button
                    type="button"
                    onClick={() => setFontSizeScale((s) => Math.max(0.6, Number((s - 0.1).toFixed(1))))}
                    className="size-7 rounded-lg bg-[#e8eeff] hover:bg-[#d8e4ff] text-[#5b7fcb] font-bold text-base flex items-center justify-center cursor-pointer select-none"
                    title="Decrease Size"
                  >
                    -
                  </button>
                  <input
                    type="range"
                    min="0.6"
                    max="1.5"
                    step="0.05"
                    value={fontSizeScale}
                    onChange={(e) => setFontSizeScale(parseFloat(e.target.value))}
                    className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#8198ed]"
                  />
                  <button
                    type="button"
                    onClick={() => setFontSizeScale((s) => Math.min(1.5, Number((s + 0.1).toFixed(1))))}
                    className="size-7 rounded-lg bg-[#e8eeff] hover:bg-[#d8e4ff] text-[#5b7fcb] font-bold text-base flex items-center justify-center cursor-pointer select-none"
                    title="Increase Size"
                  >
                    +
                  </button>
                  <span className="font-mono text-xs text-slate-500 w-10 text-right shrink-0">
                    {Math.round(fontSizeScale * 100)}%
                  </span>
                </div>
              </div>

              {/* Text Color Swatches */}
              <div className="flex flex-col gap-2 pt-1">
                <span className="font-pixel text-[11px] sm:text-xs text-[#5b7fcb] font-bold tracking-wider">Text Color:</span>
                <div className="flex items-center gap-3 flex-wrap">
                  {TEXT_COLORS.map((tc) => (
                    <button
                      key={tc.id}
                      onClick={() => setTextColor(tc.color)}
                      title={tc.label}
                      className={`size-9 sm:size-10 rounded-xl border-2 transition-transform cursor-pointer shadow-xs ${
                        textColor.toLowerCase() === tc.color.toLowerCase()
                          ? 'border-[#5b7fcb] scale-110 ring-3 ring-[#8198ed]'
                          : 'border-slate-300 hover:scale-105'
                      }`}
                      style={{ backgroundColor: tc.color }}
                    />
                  ))}
                  {/* Custom Color Input */}
                  <label
                    title="Custom Color"
                    className="size-9 sm:size-10 rounded-xl border-2 border-dashed border-[#8198ed] grid place-items-center cursor-pointer hover:scale-105 bg-white shadow-xs text-xs overflow-hidden text-[#8198ed]"
                  >
                    <Palette className="w-5 h-5" />
                    <input
                      type="color"
                      value={textColor}
                      onChange={(e) => setTextColor(e.target.value)}
                      className="opacity-0 absolute size-0"
                    />
                  </label>
                </div>
              </div>

              {/* Mini QR Code on Frame Toggle (Life4Cuts / Photoism Style) */}
              <div className="flex items-center justify-between bg-white p-3.5 sm:p-4 rounded-xl border-2 border-[#cdd6f0] shadow-xs mt-1">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-lg bg-[#e8eeff] flex items-center justify-center text-[#5b7fcb] shrink-0">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-pixel text-xs text-[#5b7fcb] font-bold">
                      Mini QR Code on Frame
                    </p>
                    <p className="font-sans text-[11px] text-slate-500 mt-0.5">
                      Adds a crisp mini QR in the bottom corner for guests to scan prints at home.
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
                  <input
                    type="checkbox"
                    checked={showQrOnFrame}
                    onChange={(e) => setShowQrOnFrame(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8198ed]"></div>
                </label>
              </div>
            </div>
          </section>
        </div>

      {/* ================= Scan to Download Modal ================= */}
      {showShare && (
        <div className="fixed inset-0 z-50 bg-black/35 backdrop-blur-[2px] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 sm:p-9 shadow-2xl max-w-sm sm:max-w-md w-full flex flex-col items-center text-center relative border border-slate-100">
            {/* Close Button */}
            <button
              onClick={() => setShowShare(false)}
              className="absolute top-4 right-4 size-8 rounded-lg bg-[#e8eeff] hover:bg-[#d8e4ff] text-[#5b7fcb] font-bold text-sm flex items-center justify-center cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Title */}
            <h3 className="font-pixel text-[#5b7fcb] text-sm sm:text-base tracking-wider mb-6 mt-1 select-none">
              Scan to Download
            </h3>

            {/* QR Content / Spinner */}
            {qrLoading ? (
              <div className="flex flex-col items-center justify-center my-10 py-6">
                <div className="w-12 h-12 border-4 border-[#8198ed]/30 border-t-[#8198ed] rounded-full animate-spin mb-4"></div>
                <p className="font-pixel text-[10px] text-[#8792c4] tracking-wider animate-pulse">
                  Uploading softcopy...
                </p>
              </div>
            ) : qrDataUrl ? (
              <div className="flex flex-col items-center w-full">
                <div className="p-3 bg-white rounded-2xl shadow-inner border border-[#dce3f8] mb-4">
                  <img
                    src={qrDataUrl}
                    alt="QR Code"
                    className="size-48 sm:size-56 object-contain rounded-lg"
                  />
                </div>
                <p className="font-pixel text-[10px] sm:text-xs text-[#5b7fcb] mb-2.5 tracking-wider select-none">
                  Scan with your phone camera to save!
                </p>

                {/* 30-Day Expiry Notice */}
                <div className="w-full bg-[#f0f4ff] rounded-xl p-2.5 border border-[#d2dfff] text-center mb-3">
                  <p className="font-sans text-[11px] text-[#5b7fcb] font-medium">
                    ⏳ <strong>Note:</strong> Photos are available for softcopy download for <strong>30 days</strong>.
                  </p>
                </div>

                {/* Direct Action Buttons */}
                <div className="flex flex-col gap-2 w-full pt-1">
                  {hostedUrl ? (
                    <div className="flex gap-1.5 w-full">
                      <input
                        readOnly
                        value={hostedUrl}
                        className="flex-1 bg-[#f8fafc] border border-slate-200 px-3 py-2 font-mono text-[10px] outline-none truncate rounded-lg text-slate-600 select-all"
                      />
                      <button
                        className="btn95 is-primary !px-3 !py-2 text-[10px] font-bold flex items-center gap-1"
                        onClick={copyLink}
                      >
                        {copied ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-300" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={download}
                      className="btn95 is-primary !px-4 !py-2.5 text-xs font-bold w-full flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download High-Res PNG</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="my-6 flex flex-col items-center gap-3">
                <p className="text-[#5b7fcb] font-pixel text-[10px]">Ready to save your photos!</p>
                <button
                  type="button"
                  onClick={download}
                  className="btn95 is-primary !px-5 !py-2.5 text-xs font-bold flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Save to Device</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sticker Packs & Folders Explorer Modal */}
      <StickerFolderModal
        isOpen={showFolderModal}
        onClose={() => setShowFolderModal(false)}
        stickers={stickersList}
        folders={stickerFolders}
        placedStickers={stickers}
        onSelectSticker={(src, id) => {
          recordStickerUsage(id)
          addSticker(src)
        }}
      />
    </div>
  )
}
