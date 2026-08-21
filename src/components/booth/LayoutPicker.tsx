import { TEMPLATES, countFor, type Template } from '../../lib/strip'
import poseSample from '../../imports/OmoideCam-2/302313d2efc07f05bc89847ee40e382521e8ce4b.png'

type Props = {
  onConfirm: (t: Template) => void
  onBack: () => void
}

export default function LayoutPicker({ onConfirm, onBack }: Props) {
  return (
    <div className="w-full flex flex-col items-center justify-center text-center py-2 px-1 sm:px-4">
      {/* Title */}
      <h1
        className="font-pixel text-[#5b7fcb] text-4xl sm:text-6xl md:text-7xl tracking-wider select-none mb-1"
        style={{
          textShadow:
            '0 4px 0 #9cb6ec, 0 7px 0 #7ca2e8, 0 12px 24px rgba(91,127,203,0.35)',
        }}
      >
        Select
      </h1>

      {/* Subtitle */}
      <p className="font-pixel text-[#5b7fcb] text-xs sm:text-sm md:text-base mb-6 sm:mb-8 tracking-widest select-none">
        Choose Layout
      </p>

      {/* All 5 Layout Options In One Single Horizontal Row */}
      <div className="flex flex-row items-end justify-center gap-2 sm:gap-4 md:gap-5 lg:gap-6 w-full max-w-full overflow-x-auto pb-4 pt-2">
        {TEMPLATES.map((tmpl) => (
          <div
            key={tmpl.id}
            onClick={() => onConfirm(tmpl)}
            className="group flex flex-col items-center cursor-pointer select-none shrink-0 transition-transform duration-200 hover:-translate-y-2.5 active:translate-y-0"
            style={{
              width:
                tmpl.cols === 2
                  ? 'clamp(140px, 17vw, 210px)'
                  : 'clamp(115px, 14vw, 170px)',
            }}
          >
            {/* Pure White Borderless Photo Strip Card */}
            <div className="polaroid-texture p-2 pt-2 pb-5 sm:p-2.5 sm:pt-2.5 sm:pb-6 w-full flex flex-col items-center shadow-[0_6px_20px_rgba(100,120,190,0.18)] group-hover:shadow-[0_12px_32px_rgba(90,110,185,0.3)] rounded-sm transition-all border border-white/60">
              <div
                className="grid gap-1.5 w-full"
                style={{ gridTemplateColumns: `repeat(${tmpl.cols}, 1fr)` }}
              >
                {Array.from({ length: countFor(tmpl) }).map((_, n) => (
                  <div
                    key={n}
                    className="relative aspect-[4/3] overflow-hidden bg-[#e8eaf6]"
                  >
                    <img
                      src={poseSample}
                      alt="Sample pose"
                      className="w-full h-full object-cover pointer-events-none group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                ))}
              </div>

              {/* Strip bottom watermark */}
              <p className="font-pixel text-[6px] sm:text-[8px] text-[#8198ed] text-center mt-2.5 sm:mt-3 tracking-widest opacity-85">
                OmoideCam
              </p>
            </div>

            {/* Template Labels Below the Strip */}
            <div className="flex flex-col items-center mt-3">
              <p className="font-pixel text-[#5b7fcb] text-xs sm:text-sm font-bold group-hover:text-[#4162b8] transition-colors">
                {tmpl.label}
              </p>
              <p className="font-pixel text-[#8792c4] text-[8px] sm:text-[9px] tracking-wider uppercase mt-0.5 group-hover:text-[#5b7fcb] transition-colors">
                {tmpl.sub}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Back Button */}
      <div className="flex items-center justify-center mt-6 sm:mt-8">
        <div className="p-1 bg-white rounded-xl shadow-[0_4px_12px_rgba(100,120,190,0.18)]">
          <button
            type="button"
            onClick={onBack}
            className="bg-[#9cb2f8] hover:bg-[#8ca8f5] active:translate-y-0.5 text-white px-7 sm:px-9 py-2.5 sm:py-3 rounded-lg font-pixel text-xs sm:text-sm tracking-wider shadow-[3px_3px_0px_#7088bc] transition-all cursor-pointer select-none"
          >
            ← Back to Home
          </button>
        </div>
      </div>
    </div>
  )
}
