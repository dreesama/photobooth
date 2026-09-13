import { useState, useEffect } from 'react'
import { Download, Image as ImageIcon, FileArchive, Check, Sparkles, AlertCircle, ArrowLeft, Clock } from 'lucide-react'
import JSZip from 'jszip'
import { getPhotoFromSupabase, isSupabaseConfigured } from '../lib/supabase'
import { getArchive } from '../lib/db'

type Props = {
  photoId: string
  onBackToHome?: () => void
}

export default function MobilePhotoViewer({ photoId, onBackToHome }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stripUrl, setStripUrl] = useState<string>('')
  const [frameUrls, setFrameUrls] = useState<string[]>([])
  const [downloadingZip, setDownloadingZip] = useState(false)
  const [downloadedItem, setDownloadedItem] = useState<string | null>(null)

  useEffect(() => {
    async function loadPhoto() {
      setLoading(true)
      setError(null)
      try {
        // 1. Check Supabase cloud storage first
        const hasSupabase = await isSupabaseConfigured().catch(() => false)
        if (hasSupabase) {
          const res = await getPhotoFromSupabase(photoId)
          if (res && res.stripUrl) {
            setStripUrl(res.stripUrl)
            setFrameUrls(res.frameUrls || [])
            setLoading(false)
            return
          }
        }

        // 2. Check local IndexedDB archive (for same-machine/kiosk instant access)
        try {
          const archive = await getArchive()
          const matched = archive.find((a) => a.id === photoId)
          if (matched && matched.stripDataUrl) {
            setStripUrl(matched.stripDataUrl)
            setFrameUrls(matched.rawFrames || [])
            setLoading(false)
            return
          }
        } catch {}

        // 3. Fallback: try direct server route (/api/raw/id)
        setStripUrl(`/api/raw/${photoId}`)
        setFrameUrls([])
        setLoading(false)
      } catch (err: any) {
        console.warn('Failed to load mobile photo:', err)
        setError('Could not load this photo. The session may have expired (valid for 30 days) or the ID is incorrect.')
        setLoading(false)
      }
    }

    if (photoId) {
      loadPhoto()
    }
  }, [photoId])

  const triggerDownload = async (url: string, filename: string) => {
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      setTimeout(() => {
        document.body.removeChild(a)
        URL.revokeObjectURL(blobUrl)
      }, 1000)

      setDownloadedItem(filename)
      setTimeout(() => setDownloadedItem(null), 3000)
    } catch (err) {
      // Fallback: open directly in new tab for manual long-press save
      window.open(url, '_blank')
    }
  }

  const downloadAllZip = async () => {
    if (downloadingZip) return
    setDownloadingZip(true)
    try {
      const zip = new JSZip()

      // 1. Fetch strip
      if (stripUrl) {
        const stripRes = await fetch(stripUrl)
        const stripBlob = await stripRes.blob()
        zip.file(`itguild-${photoId}-framed-strip.jpg`, stripBlob)
      }

      // 2. Fetch individual frames
      await Promise.all(
        frameUrls.map(async (fUrl, i) => {
          try {
            const fRes = await fetch(fUrl)
            const fBlob = await fRes.blob()
            zip.file(`photo-capture-${i + 1}.jpg`, fBlob)
          } catch {}
        })
      )

      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const zipUrl = URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = zipUrl
      a.download = `itguild-photos-${photoId}.zip`
      document.body.appendChild(a)
      a.click()
      setTimeout(() => {
        document.body.removeChild(a)
        URL.revokeObjectURL(zipUrl)
      }, 1000)

      setDownloadedItem('all_zip')
      setTimeout(() => setDownloadedItem(null), 3000)
    } catch (err) {
      console.warn('ZIP download error:', err)
      alert('Could not generate ZIP. You can download the images individually below.')
    } finally {
      setDownloadingZip(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 bg-gradient-to-b from-[#eaf4ff] via-[#dce8fc] to-[#91b5ff] select-none text-center">
        <div className="bg-white/90 backdrop-blur-md p-8 rounded-2xl shadow-xl border border-white flex flex-col items-center gap-4 max-w-xs w-full">
          <div className="w-12 h-12 border-4 border-[#8198ed] border-t-transparent rounded-full animate-spin" />
          <h2 className="font-pixel text-[#5b7fcb] text-base font-bold">Loading Your Photos...</h2>
          <p className="font-sans text-xs text-slate-500">Preparing high-resolution softcopy</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 bg-gradient-to-b from-[#eaf4ff] via-[#dce8fc] to-[#91b5ff] select-none text-center">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-white flex flex-col items-center gap-4 max-w-sm w-full">
          <AlertCircle className="w-12 h-12 text-rose-500" />
          <h2 className="font-pixel text-rose-600 text-base font-bold">Photo Not Found</h2>
          <p className="font-sans text-xs text-slate-600 leading-relaxed">{error}</p>
          {onBackToHome && (
            <button
              onClick={onBackToHome}
              className="mt-2 btn95 is-primary !px-5 !py-2 text-xs font-bold"
            >
              Back to Home
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-[#eaf4ff] via-[#dce8fc] to-[#91b5ff] p-4 sm:p-6 lg:p-8 flex flex-col items-center select-none pb-16">
      {/* Header Banner */}
      <div className="w-full max-w-md flex items-center justify-between pt-2 pb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[#5b7fcb] animate-spin" />
          <span className="font-pixel text-[#5b7fcb] text-base sm:text-lg font-bold tracking-wider">
            IT GUILD Softcopy
          </span>
        </div>
        {onBackToHome && (
          <button
            type="button"
            onClick={onBackToHome}
            className="font-pixel text-[10px] text-[#5b7fcb] bg-white/80 hover:bg-white px-2.5 py-1 rounded-lg border border-[#cdd6f0] flex items-center gap-1 shadow-xs"
          >
            <ArrowLeft className="w-3 h-3" />
            <span>Booth</span>
          </button>
        )}
      </div>

      {/* Main Content Card */}
      <div className="w-full max-w-md bg-white rounded-3xl p-5 sm:p-6 shadow-[0_20px_60px_rgba(91,127,203,0.35)] border border-white/80 flex flex-col items-center gap-5">
        {/* Photo Strip Preview */}
        <div className="relative w-full rounded-2xl overflow-hidden shadow-md border-2 border-slate-200 bg-[#f8fafc] flex items-center justify-center group">
          <img
            src={stripUrl}
            alt="Your Photo Strip"
            className="w-full h-auto max-h-[70vh] object-contain block mx-auto"
            onError={(e) => {
              // Fallback if image fails
              const target = e.currentTarget
              target.src = `/api/raw/${photoId}`
            }}
          />
        </div>

        {/* Tip for iOS / Android users with 30-Day Expiry Reminder */}
        <div className="w-full bg-[#f0f4ff] rounded-xl p-3 border border-[#d2dfff] text-center space-y-1.5">
          <p className="font-sans text-[11px] text-[#5b7fcb] font-medium leading-relaxed">
            💡 <strong>Tip:</strong> Tap <strong>Download</strong> or long-press (touch & hold) any photo to save directly to your Camera Roll / Gallery!
          </p>
          <div className="flex items-center justify-center gap-1.5 pt-1 border-t border-[#d2dfff]/70 text-[#5b7fcb] text-[10px] font-sans font-semibold">
            <Clock className="w-3.5 h-3.5" />
            <span>Softcopy available for 30 days</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="w-full flex flex-col gap-2.5">
          {/* Download Framed Strip */}
          <button
            type="button"
            onClick={() => triggerDownload(stripUrl, `itguild-${photoId}-strip.jpg`)}
            className="w-full bg-[#8198ed] hover:bg-[#6e88e8] active:scale-[0.98] text-white py-3.5 rounded-xl font-pixel text-xs tracking-wider shadow-[0_4px_0_#5b6fbc] transition-all flex items-center justify-center gap-2 cursor-pointer font-bold"
          >
            {downloadedItem === `itguild-${photoId}-strip.jpg` ? (
              <>
                <Check className="w-4 h-4 text-emerald-300" />
                <span>Downloaded!</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Download Framed Strip</span>
              </>
            )}
          </button>

          {/* Download All as ZIP (if multiple photos) */}
          {frameUrls.length > 0 && (
            <button
              type="button"
              onClick={downloadAllZip}
              disabled={downloadingZip}
              className="w-full bg-[#52b788] hover:bg-[#40916c] active:scale-[0.98] text-white py-3 rounded-xl font-pixel text-xs tracking-wider shadow-[0_4px_0_#2d6a4f] transition-all flex items-center justify-center gap-2 cursor-pointer font-bold disabled:opacity-50"
            >
              {downloadingZip ? (
                <span>Packing ZIP...</span>
              ) : downloadedItem === 'all_zip' ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>ZIP Downloaded!</span>
                </>
              ) : (
                <>
                  <FileArchive className="w-4 h-4" />
                  <span>Download All + Raw Photos (.ZIP)</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Individual Photos Section */}
        {frameUrls.length > 0 && (
          <div className="w-full pt-4 border-t border-slate-100 flex flex-col gap-3">
            <h3 className="font-pixel text-[#5b7fcb] text-xs font-bold tracking-wider text-left">
              Individual Camera Captures ({frameUrls.length})
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {frameUrls.map((fUrl, idx) => (
                <div
                  key={idx}
                  className="relative aspect-[4/3] rounded-xl overflow-hidden border border-slate-200 bg-slate-900 group shadow-xs"
                >
                  <img
                    src={fUrl}
                    alt={`Capture ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => triggerDownload(fUrl, `itguild-${photoId}-photo-${idx + 1}.jpg`)}
                    className="absolute bottom-1.5 right-1.5 bg-black/70 hover:bg-[#8198ed] text-white p-1.5 rounded-lg backdrop-blur-xs transition-colors cursor-pointer shadow-md"
                    title={`Download photo ${idx + 1}`}
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <span className="absolute top-1.5 left-1.5 font-pixel text-[8px] text-white bg-black/60 px-1.5 py-0.5 rounded backdrop-blur-xs">
                    #{idx + 1}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer info */}
        <div className="text-center pt-2">
          <p className="font-pixel text-[8px] text-slate-400">
            Powered by IT GUILD Photobooth Studio
          </p>
        </div>
      </div>
    </div>
  )
}
