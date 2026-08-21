import { useState } from 'react'
import { Camera, Lock } from 'lucide-react'

export default function PublicPortal() {
  const [photoCode, setPhotoCode] = useState('')
  const [error, setError] = useState('')

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault()
    const clean = photoCode.trim()
    if (!clean) {
      setError('Please enter a photo code')
      return
    }
    const id = clean.startsWith('photo_') ? clean : `photo_${clean}`
    window.location.href = `/photo/${id}`
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 bg-gradient-to-b from-[#eaf4ff] via-[#dce8fc] to-[#91b5ff] select-none">
      <div className="max-w-md w-full bg-white rounded-2xl p-8 sm:p-10 shadow-[0_20px_50px_rgba(91,127,203,0.3)] border border-white/80 text-center flex flex-col items-center">
        {/* Retro Logo Icon */}
        <div className="w-16 h-16 rounded-2xl bg-[#8198ed] text-white flex items-center justify-center text-3xl shadow-[0_6px_0_#5b6fbc] mb-5">
          <Camera className="w-8 h-8 text-white" />
        </div>

        {/* Title */}
        <h1
          className="font-pixel text-[#5b7fcb] text-2xl sm:text-3xl tracking-wider mb-2"
          style={{
            textShadow: '0 2px 0 #9cb6ec, 0 4px 10px rgba(91,127,203,0.25)',
          }}
        >
          IT GUILD
        </h1>
        <p className="font-pixel text-[10px] sm:text-xs text-[#8792c4] tracking-widest uppercase mb-6">
          Photo Delivery Hub
        </p>

        {/* Info Box */}
        <div className="bg-[#f0f4ff] border border-[#d2dfff] rounded-xl p-4 sm:p-5 text-left mb-6 w-full">
          <p className="text-xs sm:text-sm text-[#475569] leading-relaxed mb-3">
            <strong className="text-[#5b7fcb]">Looking for your photos?</strong>
          </p>
          <p className="text-xs text-[#64748b] leading-relaxed">
            Scan the <strong>QR code</strong> printed at the bottom of your photo strip with your phone camera to view and download your high-resolution softcopy.
          </p>
        </div>

        {/* Photo ID Lookup form */}
        <form onSubmit={handleLookup} className="w-full space-y-3">
          <label className="block text-left font-pixel text-[9px] text-[#5b7fcb] tracking-wider">
            Have a Photo Code?
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. photo_mt2sfkq1_pyjf"
              value={photoCode}
              onChange={(e) => {
                setPhotoCode(e.target.value)
                setError('')
              }}
              className="flex-1 bg-[#f8fafc] border border-[#cbd5e1] focus:border-[#8198ed] focus:ring-2 focus:ring-[#8198ed]/30 px-3.5 py-2.5 rounded-xl font-mono text-xs text-slate-700 outline-none transition-all"
            />
            <button
              type="submit"
              className="btn95 is-primary !px-4 !py-2 text-xs font-bold shrink-0"
            >
              View
            </button>
          </div>
          {error && <p className="text-[10px] text-rose-500 font-bold text-left">{error}</p>}
        </form>

        {/* Footer Notice */}
        <div className="mt-8 pt-4 border-t border-slate-100 w-full flex items-center justify-center gap-1.5 text-[#8792c4]">
          <Lock className="w-3 h-3" />
          <p className="font-pixel text-[8px] tracking-wider">
            Photobooth Terminal: Local Kiosk Only
          </p>
        </div>
      </div>
    </div>
  )
}
