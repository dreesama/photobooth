import cloudSm from '../imports/OmoideCam-1/a5297066793ce425e47c5535863011b0d63c1594.png'
import cloudLg from '../imports/OmoideCam-1/59343e2bf6815009d23cfab35900d0abce742df8.png'
import star from '../imports/OmoideCam-1/83a28b65ed5df81d400d62d4107b713a5027c51b.png'

const DECO = [
  { src: cloudLg, top: '6%', left: '4%', size: '160px', dur: '7s', dist: '-16px' },
  { src: star, top: '14%', left: '88%', size: '58px', dur: '5s', dist: '-14px' },
  { src: cloudSm, top: '40%', left: '2%', size: '110px', dur: '6s', dist: '18px' },
  { src: cloudLg, top: '58%', left: '86%', size: '180px', dur: '8s', dist: '-20px' },
  { src: star, top: '74%', left: '8%', size: '48px', dur: '5.5s', dist: '-12px' },
  { src: star, top: '28%', left: '47%', size: '40px', dur: '6.5s', dist: '16px' },
  { src: cloudSm, top: '80%', left: '70%', size: '120px', dur: '7.5s', dist: '14px' },
]

export default function FloatingDeco() {
  return (
    <div className="deco-layer pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      {DECO.map((d, i) => (
        <img
          key={i}
          src={d.src}
          alt=""
          className="deco deco-animated absolute select-none pointer-events-none"
          style={{
            top: d.top,
            left: d.left,
            width: d.size,
            animationDuration: d.dur,
            // @ts-expect-error custom css variable
            '--dist': d.dist,
          }}
        />
      ))}
    </div>
  )
}
