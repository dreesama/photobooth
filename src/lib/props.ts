// Real face-prop sprites imported from the OmoideCam design + metadata for head landmark anchoring
import bunny from '../imports/OmoideCam-3/c7d50a5ffd9545172931ee8b5b84624af8b5b37c.png'
import cat from '../imports/OmoideCam-3/42526dcbad22d5b2f39ace994304a55b645bb405.png'
import cowboy from '../imports/OmoideCam-3/4e1738180a2816d99cfe1db64f48774316720c28.png'
import dog from '../imports/OmoideCam-3/c1c874077148bd771d7a43c736e73bafb6ff1ac9.png'
import grad from '../imports/OmoideCam-3/f7ebaecfdb7305cfc6b5a08fe41b001b4135e139.png'
import pirate from '../imports/OmoideCam-3/5d7d0f8bbc21d5588c115bf45540d327fd329bad.png'
import flower from '../imports/OmoideCam-3/8f2026700a0251154012c4fb2605b53d65c540a4.png'

export type PropAnchor = 'forehead' | 'eyes' | 'nose' | 'ear'

export type PropDef = {
  id: string
  label: string
  src: string | null
  anchor?: PropAnchor
  offsetY?: number // relative vertical offset
  scaleFactor?: number // size relative to face width
}

export const PROPS: PropDef[] = [
  { id: 'none', label: 'None', src: null },
  { id: 'bunny', label: 'Bunny', src: bunny, anchor: 'forehead', offsetY: -0.22, scaleFactor: 1.5 },
  { id: 'cat', label: 'Cat', src: cat, anchor: 'forehead', offsetY: -0.14, scaleFactor: 1.4 },
  { id: 'cowboy', label: 'Cowboy', src: cowboy, anchor: 'forehead', offsetY: -0.18, scaleFactor: 1.6 },
  { id: 'dog', label: 'Dog', src: dog, anchor: 'eyes', offsetY: -0.06, scaleFactor: 1.65 },
  { id: 'grad', label: 'Grad', src: grad, anchor: 'forehead', offsetY: -0.16, scaleFactor: 1.4 },
  { id: 'pirate', label: 'Pirate', src: pirate, anchor: 'forehead', offsetY: -0.16, scaleFactor: 1.5 },
  { id: 'flower', label: 'Flower', src: flower, anchor: 'ear', offsetY: -0.02, scaleFactor: 0.85 },
]

// Preload sprites so they can be composited synchronously at capture time.
const cache = new Map<string, HTMLImageElement>()
export function loadProps() {
  for (const p of PROPS) {
    if (!p.src || cache.has(p.src)) continue
    const im = new Image()
    im.src = p.src
    cache.set(p.src, im)
  }
}
export function propImage(src: string | null): HTMLImageElement | null {
  return src ? cache.get(src) ?? null : null
}
