/** Centered crop of test04: 2H2/O2/12Ar, 15 kPa, captured at 2 MHz.
 * Source frames 86..210, crop (190, -22, 280, 200); see render_test04.py.
 * The visual anchors below follow the leading front and the converging pair.
 */
export const CLIP = {
  w: 280, h: 200, fps: 15, duration: 125 / 15,
  asset: 'test04-wide', collisionTime: (150 - 86) / 15,
  collision: { x: 140, y: 99 },
} as const

// Frame numbers are in the original AVI; x/y were traced in the initial crop.
// Out-of-crop y values keep a wave offscreen until it enters naturally.
const ANCHORS = [
  { frame: 86, x: 245, upper: -60, lower: 250 },
  { frame: 100, x: 222, upper: -30, lower: 200 },
  { frame: 112, x: 196, upper: 0, lower: 154 },
  { frame: 120, x: 177, upper: 14, lower: 138 },
  { frame: 130, x: 158, upper: 32, lower: 111 },
  { frame: 140, x: 139, upper: 53, lower: 96 },
  { frame: 148, x: 119, upper: 70, lower: 81 },
  { frame: 150, x: 114, upper: 77, lower: 77 },
  { frame: 152, x: 108, upper: 75, lower: 80 },
  { frame: 160, x: 83, upper: 63, lower: 101 },
  { frame: 170, x: 54, upper: 59, lower: 132 },
  { frame: 180, x: 21, upper: 60, lower: 164 },
  { frame: 190, x: -8, upper: 72, lower: 197 },
  { frame: 200, x: -37, upper: 90, lower: 219 },
  { frame: 210, x: -59, upper: 112, lower: 230 },
] as const

export function clipMotion(time: number) {
  const frame = 86 + time * CLIP.fps
  const index = Math.max(0, ANCHORS.findIndex((_, i) => i < ANCHORS.length - 1 && frame <= ANCHORS[i + 1].frame))
  const last = ANCHORS.length - 2
  const i = frame > ANCHORS.at(-1)!.frame ? last : index
  const a = ANCHORS[i], b = ANCHORS[i + 1]
  const fraction = (frame - a.frame) / (b.frame - a.frame)
  return {
    x: a.x + (b.x - a.x) * fraction + 26,
    upper: a.upper + (b.upper - a.upper) * fraction + 22,
    lower: a.lower + (b.lower - a.lower) * fraction + 22,
    upperDirection: (b.upper >= a.upper ? 1 : -1) as 1 | -1,
    lowerDirection: (b.lower >= a.lower ? 1 : -1) as 1 | -1,
  }
}

/** Invert the monotonic front path, extrapolating its final speed for the drawing. */
export function timeAtFront(x: number): number {
  x -= 26 // Convert from the wider crop back to the traced coordinates.
  let i = ANCHORS.findIndex((_, index) => index < ANCHORS.length - 1 && x >= ANCHORS[index + 1].x)
  if (i < 0) i = ANCHORS.length - 2
  const a = ANCHORS[i], b = ANCHORS[i + 1]
  const frame = a.frame + (x - a.x) / (b.x - a.x) * (b.frame - a.frame)
  return (frame - 86) / CLIP.fps
}
