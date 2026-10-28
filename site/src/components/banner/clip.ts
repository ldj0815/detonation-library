import { DEFAULT_BANNER_SETTINGS } from './settings'

/** Full recording; its visible crop and trim are editable in settings.json. */
export const CLIP = {
  w: 628, h: 480, fps: 15, frames: 249, duration: (DEFAULT_BANNER_SETTINGS.video.endFrame - DEFAULT_BANNER_SETTINGS.video.startFrame) / 15,
  asset: 'test04-full', center: { x: 314, y: 240 },
  // Media is encoded at 3x resolution; geometry always uses original pixels.
  revision: 'clean-aa3-dotfix-1',
  cell: { anchorX: 551, width: 512, height: 366 },
} as const

// Leading front near the original center line (y = 240), in source pixels.
// Its progress controls both the footage handoff and the drawn continuation.
const ANCHORS = [
  { frame: 86, x: 455 },
  { frame: 100, x: 416 },
  { frame: 112, x: 386 },
  { frame: 120, x: 367 },
  { frame: 130, x: 343 },
  { frame: 140, x: 318 },
  { frame: 150, x: 295 },
  { frame: 160, x: 273 },
  { frame: 170, x: 252 },
  { frame: 180, x: 231 },
  { frame: 190, x: 207 },
  { frame: 200, x: 186 },
  { frame: 210, x: 166 },
  { frame: 220, x: 145 },
  { frame: 230, x: 126 },
  { frame: 240, x: 108 },
  { frame: 248, x: 94 },
] as const

export function clipMotion(time: number, startFrame = DEFAULT_BANNER_SETTINGS.video.startFrame) {
  const frame = startFrame + time * CLIP.fps
  let i = ANCHORS.findIndex((_, index) => index < ANCHORS.length - 1 && frame <= ANCHORS[index + 1].frame)
  if (i < 0) i = ANCHORS.length - 2
  const a = ANCHORS[i], b = ANCHORS[i + 1]
  return { x: a.x + (b.x - a.x) * (frame - a.frame) / (b.frame - a.frame) }
}

/** Invert the monotonic front path, extrapolating its final speed for the drawing. */
export function timeAtFront(x: number, startFrame = DEFAULT_BANNER_SETTINGS.video.startFrame): number {
  let i = ANCHORS.findIndex((_, index) => index < ANCHORS.length - 1 && x >= ANCHORS[index + 1].x)
  if (i < 0) i = ANCHORS.length - 2
  const a = ANCHORS[i], b = ANCHORS[i + 1]
  const frame = a.frame + (x - a.x) / (b.x - a.x) * (b.frame - a.frame)
  return (frame - startFrame) / CLIP.fps
}
