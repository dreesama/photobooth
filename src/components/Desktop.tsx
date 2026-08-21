import { Settings, Camera, Sparkles } from 'lucide-react'
import cloudSm from '../imports/OmoideCam-1/a5297066793ce425e47c5535863011b0d63c1594.png'
import cloudLg from '../imports/OmoideCam-1/59343e2bf6815009d23cfab35900d0abce742df8.png'
import star from '../imports/OmoideCam-1/83a28b65ed5df81d400d62d4107b713a5027c51b.png'

const DECO = [
  { src: cloudLg, top: '8%', left: '5%', size: '160px', dur: '7s', dist: '-16px' },
  { src: star, top: '15%', left: '88%', size: '58px', dur: '5s', dist: '-14px' },
  { src: cloudSm, top: '42%', left: '3%', size: '110px', dur: '6s', dist: '18px' },
  { src: cloudLg, top: '65%', left: '85%', size: '180px', dur: '8s', dist: '-20px' },
  { src: star, top: '78%', left: '8%', size: '48px', dur: '5.5s', dist: '-12px' },
  { src: star, top: '22%', left: '50%', size: '42px', dur: '6.5s', dist: '16px' },
  { src: cloudSm, top: '82%', left: '72%', size: '120px', dur: '7.5s', dist: '14px' },
]

export default function Desktop({
  onStart,
  onOpenAdmin,
}: {
  onStart: () => void
  onOpenAdmin?: () => void
}) {
  return (
    <div className="landing min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden select-none">
      {/* Top right Admin shortcut button */}
      {onOpenAdmin && (
        <div className="fixed top-4 right-4 z-50">
          <button
            onClick={onOpenAdmin}
            title="Open Admin Studio (Ctrl+Shift+A)"
            className="btn95 !px-4 !py-2 text-xs font-bold flex items-center gap-1.5 shadow-md bg-white/95 backdrop-blur-xs cursor-pointer hover:scale-105 transition-transform"
          >
            <Settings className="w-4 h-4 text-[#5b7fcb]" />
            <span>Admin Studio</span>
          </button>
        </div>
      )}

      {/* Floating retro cloud and star decorations */}
      <div className="deco-layer pointer-events-none" aria-hidden>
        {DECO.map((d, i) => (
          <img
            key={i}
            src={d.src}
            alt=""
            className="deco deco-animated pointer-events-none"
            style={{
              top: d.top,
              left: d.left,
              width: d.size,
              animationDuration: d.dur,
              // @ts-expect-error custom prop
              '--dist': d.dist,
            }}
          />
        ))}
      </div>

      {/* Main Center Content Hero */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center max-w-2xl px-6 py-12 my-auto">
        {/* Retro Badge */}
        <div className="inline-flex items-center gap-1.5 bg-white/90 border-2 border-[#8198ed] text-[#5b7fcb] px-3.5 py-1.5 rounded-full font-pixel text-[9px] sm:text-[10px] tracking-wider shadow-md mb-4 animate-bounce">
          <Sparkles className="w-3.5 h-3.5 text-[#8198ed]" />
          <span>RETRO PHOTOBOOTH STUDIO</span>
        </div>

        {/* Big Retro 3D Title */}
        <h1
          className="font-pixel text-4xl sm:text-6xl md:text-7xl text-[#5b7fcb] tracking-wider mb-4 leading-tight"
          style={{
            textShadow:
              '0 4px 0 #9cb6ec, 0 8px 0 #5b6fbc, 0 12px 24px rgba(91, 127, 203, 0.4)',
          }}
        >
          IT GUILD
        </h1>

        <p className="font-pixel text-xs sm:text-sm text-[#5b6fbc] tracking-widest uppercase mb-10 max-w-md leading-relaxed">
          Capture the moment • Keep the memory
        </p>

        {/* Centered Big Start Button */}
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={onStart}
            className="group relative bg-gradient-to-b from-[#91b5ff] to-[#8198ed] hover:from-[#8198ed] hover:to-[#5b6fbc] text-white border-4 border-white font-pixel text-lg sm:text-2xl px-10 sm:px-14 py-5 sm:py-6 rounded-3xl shadow-[0_12px_0_#5b6fbc,0_20px_35px_rgba(91,111,188,0.45)] hover:shadow-[0_8px_0_#5b6fbc,0_14px_25px_rgba(91,111,188,0.45)] hover:translate-y-1 active:translate-y-3 active:shadow-[0_2px_0_#5b6fbc] transition-all cursor-pointer flex items-center justify-center gap-3"
          >
            <Camera className="w-7 h-7 sm:w-8 sm:h-8 group-hover:scale-110 transition-transform" />
            <span>START</span>
          </button>

          <span className="font-pixel text-[9px] text-[#8792c4] tracking-wider mt-2">
            Click to start photo session
          </span>
        </div>
      </div>
    </div>
  )
}
