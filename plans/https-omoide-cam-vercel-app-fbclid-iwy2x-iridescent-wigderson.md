# Remake: OmoideCam — retro browser photobooth

## Context
The user wants to recreate **OmoideCam** (https://omoide-cam.vercel.app/), a free browser-based
purikura-style photobooth. It captures webcam (or uploaded) photos, arranges them into a decorated
photo strip, and lets the user download it — all with a nostalgic **retro desktop / Win95 window**
aesthetic (draggable windows with `- [ ] x` chrome, pixel camera icon, "思い出 = memory").

The current `src/App.tsx` is only a scaffold placeholder (a dot-grid mouse demo) with no real app,
so it will be replaced. User confirmed: build the **full working photobooth** (webcam capture,
layouts, countdown, filters, stickers, downloadable strip).

## Aesthetic
- Invoke `Skill('make:aesthetic-stance')` before writing UI, and call `create_make_theme` (full-page
  brief) for palette/typography direction, committing to a retro-desktop pixel stance.
- Pixel/retro display font for the logo + a clean readable sans for body, wired via Google Fonts
  `@import` in `src/index.css` (per AGENTS.md). Likely a pixel font (e.g. "Press Start 2P" / "VT323")
  for headings and a soft sans for controls.
- Window chrome, beveled buttons, playful pastel purikura accents. Multilingual logo variants
  (OmoideCam / 오모이데캠 / 回忆相机 / 思い出カム).

## Implementation (all in `src/`)
Extend the scaffold in place: keep `src/main.tsx`, `src/index.css`, `index.html`; replace the
placeholder `src/App.tsx` and add components under `src/components/`.

1. **Design tokens & fonts** — `src/index.css`: Google Font `@import` (imports first), CSS vars for
   the palette, `.window`/bevel helper classes, pixel-rendering utility.

2. **Desktop shell / landing** — `src/App.tsx` orchestrates app state (view: `desktop` → `booth`),
   renders a retro desktop background with draggable `Window` panels ("My Memories", "Description",
   "How To", "Developer Info") and a hero window with pixel camera icon + **Start**.

3. **Reusable `Window` component** — `src/components/Window.tsx`: titlebar with `- [ ] x` controls,
   optional draggable behavior (pointer drag), body slot. Reused across landing + booth panels.

4. **Photobooth flow** — `src/components/Booth/`:
   - `SourcePicker.tsx` — choose **Live camera** (`navigator.mediaDevices.getUserMedia`) or
     **Upload** (`<input type=file>`); handle permission-denied gracefully.
   - `LayoutPicker.tsx` — 2 / 3 / 4 panel strip choice.
   - `CameraStage.tsx` — live `<video>` preview, mirror toggle, **countdown timer** (adjustable
     seconds, Space to start), sequential capture into `<canvas>` frames until strip is full.
   - `Editor.tsx` — decorate the strip: frame color/pattern, filters (vintage, B&W, sepia, neon via
     CSS filter → baked onto canvas), draggable stickers (hats, glasses, speech bubbles as
     emoji/SVG), and a date/month caption.
   - `StripCanvas.tsx` — composites captured frames + frame + filter + stickers onto a single
     `<canvas>`; produces the final downloadable image.
   - `SavePanel.tsx` — **Download PNG** (canvas `toDataURL`) and a **QR code** of the data (optional;
     use a small `qrcode` lib if added).

5. **Hooks/util** — `src/hooks/useCamera.ts` (stream lifecycle + cleanup), `src/lib/strip.ts`
   (canvas composition helpers), `src/lib/stickers.ts` (sticker catalog).

## Notes / decisions
- Filters applied live via CSS `filter` on the video, then re-applied to canvas `ctx.filter` at
  capture/composite time so the download matches the preview.
- Stickers are absolutely-positioned draggable overlays in the editor, with their normalized
  positions re-drawn onto the final canvas.
- Expression Detector from the original is out of scope for v1 (would need a face model); can be a
  later add. Everything else from the original is covered.
- QR code: only if a lightweight dep (`qrcode`) is acceptable; otherwise SavePanel ships with
  download only. Will install `qrcode` if used.

## Verification
- Dev server is already running on `$PORT`; open the preview.
- Landing: windows render, are draggable, Start opens the booth.
- Grant camera permission → live preview shows; Space starts countdown; frames capture into the strip.
- Upload path works without a camera.
- Editor: switching filter/frame updates preview; stickers drag; caption edits.
- Download produces a PNG matching the on-screen strip (filters + stickers baked in).
- Run a typecheck/build only if broad issues are suspected; otherwise rely on the running preview.
