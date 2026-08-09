import { useState } from 'react'
import { TEMPLATES, countFor, type Template } from '../../lib/strip'
import poseSample from '../../imports/OmoideCam-2/302313d2efc07f05bc89847ee40e382521e8ce4b.png'

type Props = {
  onConfirm: (t: Template) => void
  onBack: () => void
}

export default function LayoutPicker({ onConfirm, onBack }: Props) {
  const [i, setI] = useState(0)
  const t = TEMPLATES[i]
  const prev = () => setI((v) => (v - 1 + TEMPLATES.length) % TEMPLATES.length)
  const next = () => setI((v) => (v + 1) % TEMPLATES.length)

  return (
    <div className="flex flex-col items-center justify-center text-center py-6 min-h-[500px]">
      {/* Title */}
      <h1
        className="font-pixel text-[#5b7fcb] mb-2 text-4xl sm:text-6xl tracking-widest"
        style={{
          textShadow: '0 5px 0 #a8c4f0, 0 8px 16px rgba(100,140,220,0.3)',
        }}
      >
        Select
      </h1>
      <p className="font-pixel text-[#8198ed] text-xs sm:text-sm mb-8 tracking-widest">
        Choose Layout
      </p>

      {/* Carousel */}
      <div className="flex items-center gap-6 sm:gap-12 my-2">
        <button
          className="btn95 !w-11 !h-11 sm:!w-12 sm:!h-12 !p-0 grid place-items-center text-lg font-bold !bg-[#8198ed] !text-white !border-[#5b6fbc]"
          onClick={prev}
          aria-label="Previous"
        >
          ‹
        </button>

        <div className="flex flex-col items-center">
          {/* Photo strip preview card matching screenshots 1 & 2 */}
          <div
            className="bg-white p-3 pb-5 rounded-sm flex flex-col items-center transition-all duration-200"
            style={{
              boxShadow: '0 8px 24px rgba(100,120,190,0.25), 0 2px 6px rgba(0,0,0,0.08)',
              width: 'clamp(170px, 35vw, 220px)',
            }}
          >
            <div
              className="grid gap-1.5 w-full bg-[#f8fafc] p-1 border border-[#e2e8f0]"
              style={{ gridTemplateColumns: `repeat(${t.cols}, 1fr)` }}
            >
              {Array.from({ length: countFor(t) }).map((_, n) => (
                <div
                  key={n}
                  className="bg-[#e8eaf6] relative aspect-[4/3] overflow-hidden border border-[#cbd5e1]"
                >
                  <img
                    src={poseSample}
                    alt="Sample pose"
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
            <p className="font-pixel text-[7px] text-[#8198ed] text-center mt-3 tracking-widest opacity-80">
              OmoideCam
            </p>
          </div>

          {/* Labels */}
          <p className="font-pixel text-[#5b7fcb] text-sm mt-3 font-bold">{t.label}</p>
          <p className="font-pixel text-[#8792c4] text-[10px] tracking-wider uppercase mt-0.5">
            {t.sub}
          </p>
        </div>

        <button
          className="btn95 !w-11 !h-11 sm:!w-12 sm:!h-12 !p-0 grid place-items-center text-lg font-bold !bg-[#8198ed] !text-white !border-[#5b6fbc]"
          onClick={next}
          aria-label="Next"
        >
          ›
        </button>
      </div>

      {/* Pagination dots */}
      <div className="flex gap-2 mt-6">
        {TEMPLATES.map((_, n) => (
          <span
            key={n}
            onClick={() => setI(n)}
            className={`w-2.5 h-2.5 rounded-full cursor-pointer transition-all ${
              n === i ? 'bg-[#8198ed] scale-125' : 'bg-[#cdd6f0] hover:bg-[#a8b8e0]'
            }`}
          />
        ))}
      </div>

      {/* Control buttons */}
      <div className="flex gap-4 mt-8">
        <button className="btn95 !px-6 !py-2.5 text-xs font-bold" onClick={onBack}>
          ← Back
        </button>
        <button className="btn95 is-primary !px-6 !py-2.5 text-xs font-bold" onClick={() => onConfirm(t)}>
          Confirm ›
        </button>
      </div>
    </div>
  )
}
