import cloudSm from '../imports/OmoideCam-1/a5297066793ce425e47c5535863011b0d63c1594.png'
import cloudLg from '../imports/OmoideCam-1/59343e2bf6815009d23cfab35900d0abce742df8.png'
import star from '../imports/OmoideCam-1/83a28b65ed5df81d400d62d4107b713a5027c51b.png'

const img = (id: string, w = 600, h = 800) =>
  `https://images.unsplash.com/${id}?w=${w}&h=${h}&fit=crop&auto=format`

// three stacked windows — geometry ported 1:1 from the original site
const WINDOWS = [
  {
    title: 'My Memories',
    label: 'December...',
    src: img('1649366735070-8e78a4f86f31'),
    style: { top: 0, left: 0, zIndex: 1, width: 'clamp(140px, 40vw, 500px)' },
    tall: false,
  },
  {
    title: 'My Travels',
    label: 'January...',
    src: img('1502920917128-1aa500764cbd'),
    style: {
      top: 'clamp(40px, 9vw, 110px)',
      left: 'clamp(80px, 20vw, 350px)',
      zIndex: 2,
      width: 'clamp(210px, 60vw, 750px)',
    },
    tall: false,
  },
  {
    title: 'Work...',
    label: 'March...',
    src: img('1497215728101-856f4ea42174'),
    style: {
      top: 'clamp(80px, 18vw, 160px)',
      left: 'clamp(40px, 10vw, 125px)',
      zIndex: 3,
      width: 'clamp(117px, 33.32vw, 417px)',
    },
    tall: true,
  },
] as const

const STEPS = [
  ['Step 1', 'Choose your photo source', 'Before you begin, decide how you want to add photos to your strip. You can either take photos live using your camera or upload photos directly from your device.'],
  ['Step 2', 'Pick a layout', 'Select how many photos your strip will have — choose between a 2, 3, or 4-panel layout depending on how many shots you want in your memory strip.'],
  ['Step 3', 'Set up your shot', 'Customize your shooting experience. Toggle Expression Detector on or off, then choose your preferred countdown duration so you have enough time to strike a pose.'],
  ['Step 4', 'Strike a pose!', 'Press Space to start the countdown. Once it hits zero, smile! OmoideCam will automatically snap your photo. Repeat for each panel in your chosen layout.'],
  ['Step 5', 'Confirm or retake', 'Once all your shots are taken, review your photos. Happy with them? Hit Confirm to edit. Not feeling it? Hit Retake to try again.'],
  ['Step 6', 'Customize your strip', 'Add a frame background color or pattern, apply filters like vintage, B&W, sepia, or neon, and decorate with stickers like hats, glasses, and speech bubbles.'],
  ['Step 7', 'Choose your logo language', 'Pick how the OmoideCam logo appears on your strip: English, Korean (오모이데캠), Chinese (回忆相机), or Japanese (思い出カム).'],
  ['Step 8', 'Save your memory', 'Download your finished photo strip directly to your device or scan the QR code to save it instantly to your phone. Your memory is ready to keep and share!'],
]

const DECO = [
  { src: cloudLg, top: '6%', left: '4%', size: '150px', dur: '7s', dist: '-16px' },
  { src: star, top: '16%', left: '88%', size: '58px', dur: '5s', dist: '-14px' },
  { src: cloudSm, top: '40%', left: '2%', size: '100px', dur: '6s', dist: '18px' },
  { src: cloudLg, top: '58%', left: '86%', size: '170px', dur: '8s', dist: '-20px' },
  { src: star, top: '74%', left: '9%', size: '48px', dur: '5.5s', dist: '-12px' },
  { src: star, top: '28%', left: '47%', size: '40px', dur: '6.5s', dist: '16px' },
  { src: cloudSm, top: '80%', left: '70%', size: '110px', dur: '7.5s', dist: '14px' },
]

export default function Desktop({
  onStart,
  onOpenAdmin,
}: {
  onStart: () => void
  onOpenAdmin?: () => void
}) {
  return (
    <div className="landing">
      {/* Top right Admin shortcut button */}
      {onOpenAdmin && (
        <div className="fixed top-3 right-3 sm:top-4 sm:right-4 z-50">
          <button
            onClick={onOpenAdmin}
            title="Open Admin Studio (Ctrl+Shift+A)"
            className="btn95 !px-3 sm:!px-4 !py-1.5 text-[9px] sm:text-xs font-bold flex items-center gap-1.5 shadow-md bg-white/90 backdrop-blur-xs"
          >
            <span>⚙️</span>
            <span className="hidden sm:inline">Admin Studio</span>
            <span className="sm:hidden">Admin</span>
          </button>
        </div>
      )}

      {/* floating decorations */}
      <div className="deco-layer" aria-hidden>
        {DECO.map((d, i) => (
          <img
            key={i}
            src={d.src}
            alt=""
            className="deco deco-animated"
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

      <div className="content-layer">
        <h1 className="title">IT GUILD</h1>

        {/* stacked windows + start button */}
        <div className="windows-wrapper">
          <div className="windows-outer">
            <div className="windows-stack">
              {WINDOWS.map((w) => (
                <div key={w.title} className="window" style={w.style as any}>
                  <div className="titlebar">
                    <span className="titlebar-title">{w.title}</span>
                    <div className="titlebar-buttons">
                      <span className="btn-win">_</span>
                      <span className="btn-win">▢</span>
                      <span className="btn-win">x</span>
                    </div>
                  </div>
                  <div className="window-body">
                    <div className="scrollbar-track">
                      <span className="scrollbar-arrow">▲</span>
                      <span className="scrollbar-thumb" />
                      <span className="scrollbar-arrow">▼</span>
                    </div>
                    <div className="content-area">
                      <p className="win-label">{w.label}</p>
                      <div className={`img-wrapper${w.tall ? ' img-wrapper--tall' : ''}`}>
                        <img src={w.src} alt={w.title} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <div className="start-btn-portal">
                <button className="start-btn" onClick={onStart}>
                  <span className="start-icon" aria-hidden>📷</span>
                  <span>Start</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* description + developer info */}
        <div className="info-row">
          <section className="desc-window">
            <div className="desc-titlebar">
              <span className="desc-titlebar-title">Description</span>
              <div className="desc-titlebar-buttons">
                <span className="desc-btn-win">_</span>
                <span className="desc-btn-win">▢</span>
                <span className="desc-btn-win">x</span>
              </div>
            </div>
            <div className="desc-body">
              <p className="desc-headline">
                IT GUILD — capture the moment, keep the memory.
              </p>
              <p className="desc-text">
                IT GUILD is a modern, retro-styled photobooth web application that lets you create
                beautiful photo strips with friends, solo, or anywhere you have a camera.
                Experience the charm of classic photobooths straight from your browser.
              </p>
              <p className="desc-text">
                Snap photos or upload your own, choose your layout, dress up your strip with
                filters, stickers, and frames, and walk away with a personalized memory you
                can save instantly. With smart face props, countdown timers, and
                custom text options, every photo strip feels uniquely yours.
              </p>
              <p className="desc-footer">
                Presented by IT GUILD.
              </p>
            </div>
          </section>

          <section className="devinfo-window">
            <div className="devinfo-titlebar">
              <span className="devinfo-titlebar-title">Developer Info</span>
              <div className="devinfo-titlebar-buttons">
                <span className="devinfo-btn-win">_</span>
                <span className="devinfo-btn-win">▢</span>
                <span className="devinfo-btn-win">x</span>
              </div>
            </div>
            <div className="devinfo-body">
              <p className="devinfo-text">
                Greetings! My name is Yhvhan Suba, a BSIT Student from National University
                Manila specializing in developing Mobile and Web applications. Feel free to
                connect with me through my Socials!
              </p>
              <p className="devinfo-label">
                Facebook:{' '}
                <a className="devinfo-link" href="https://www.facebook.com/Yvhyy.suba.75" target="_blank" rel="noreferrer">
                  facebook.com/Yvhyy.suba.75
                </a>
              </p>
              <p className="devinfo-label">
                GitHub:{' '}
                <a className="devinfo-link" href="https://github.com/" target="_blank" rel="noreferrer">
                  github.com
                </a>
              </p>
              <p className="devinfo-label">
                LinkedIn:{' '}
                <a className="devinfo-link" href="https://www.linkedin.com/in/yhvhan-suba-4b985339b/" target="_blank" rel="noreferrer">
                  linkedin.com/in/yhvhan-suba
                </a>
              </p>
              <p className="devinfo-label">
                Instagram:{' '}
                <a className="devinfo-link" href="https://www.instagram.com/_vhxn_/" target="_blank" rel="noreferrer">
                  instagram.com/_vhxn_
                </a>
              </p>
              <p className="devinfo-label">Gmail: subayhvhan@gmail.com</p>
            </div>
          </section>
        </div>

        {/* tutorial */}
        <div className="tutorial-wrapper">
          <h2 className="tutorial-title">How to Use?</h2>
          <div className="steps-grid">
            {STEPS.map(([n, t, d]) => (
              <div key={n} className="step-card">
                <p className="step-number">{n}</p>
                <p className="step-title">{t}</p>
                <p className="step-desc">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
