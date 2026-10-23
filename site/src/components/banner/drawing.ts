// The drawn half of the banner: transverse waves that continue the clip's front
// across the band and write fading tracks, as triple points do on a soot foil.
// The first pair follows the centered test04 collision before continuing freely.
import { CLIP, clipMotion, timeAtFront } from './clip'
export { CLIP } from './clip'

/** Part of the clip's width over which the drawing blends into the footage (matches the CSS mask). */
export const FEATHER = 0.08
/** Seconds a track stays visible. */
export const TRACE_LIFETIME = 2
/** How far past the band's left edge the last wave travels before the loop restarts. */
export const MARGIN = 40

interface Point { y: number; py: number; dir: 1 | -1; family: 0 | 1; energy: number; k: number; slope: number }
interface Segment { x1: number; y1: number; x2: number; y2: number; time: number; energy: number }
interface Flash { x: number; y: number; time: number }

export interface Box { left: number; top?: number; width: number; height: number }

export interface Geometry {
  W: number
  H: number
  dpr: number
  /** Page pixels per clip pixel. */
  scale: number
  /** Width of the clip's box on the page. */
  vw: number
  /** Left edge of the clip's box, in band pixels. */
  videoLeft: number
  /** Where the clip's own x = 0 falls, in band pixels (the box crops it). */
  videoOrigin: number
  /** Where the crop's own y = 0 falls after object-fit: cover. */
  videoOriginY: number
  /** Page pixels per clip-second. */
  speed: number
}

function rgbOf(hex: string, fallback: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return fallback
  return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16)).join(',')
}

export class FoilDrawing {
  geometry: Geometry = { W: 0, H: 0, dpr: 1, scale: 1, vw: 0, videoLeft: 0, videoOrigin: 0, videoOriginY: 0, speed: 1 }
  /** Cell width as a fraction of the band's height. */
  cellFrac = 0.7
  private ink = '220,230,245'
  private trace = '244,207,53'
  private points: Point[] = []
  private segments: Segment[] = []
  private flashes: Flash[] = []
  private frontX = Infinity
  private previousX = Infinity
  private simulationTime = 0
  private seed = 11
  /** Counts the passes, so each one gets its own draw of positions and speeds. */
  private pass = 0
  private tracking = true

  /** Deterministic jitter: the lattice is not perfectly regular, and each pass differs a little. */
  private random(): number {
    this.seed = (this.seed * 16807) % 2147483647
    return (this.seed - 1) / 2147483646
  }

  /** Band and clip boxes in page pixels; the clip sits in its box like object-fit: cover. */
  layout(band: Box, clip: Box, dpr: number) {
    const W = band.width, H = band.height
    const vw = clip.width
    const scale = Math.max(clip.height / CLIP.h, vw / CLIP.w)
    const videoLeft = clip.left - band.left
    const videoOrigin = videoLeft - (CLIP.w * scale - vw) / 2
    const videoOriginY = (clip.top ?? 0) - (band.top ?? 0) - (CLIP.h * scale - clip.height) / 2
    const speed = (clipMotion(CLIP.duration).x - clipMotion(CLIP.duration + 1).x) * scale
    this.geometry = { W, H, dpr: Math.min(2, dpr), scale, vw, videoLeft, videoOrigin, videoOriginY, speed }
    this.reset()
  }

  /** Clip seconds at which the front passes the left edge of the clip's box. */
  clipExitTime(): number {
    const g = this.geometry
    return timeAtFront((g.videoLeft - g.videoOrigin) / g.scale)
  }

  /** Clip seconds at which the waves have left the band. */
  leaveTime(): number {
    const g = this.geometry
    return timeAtFront((-MARGIN - g.videoOrigin) / g.scale)
  }

  /** Ink for the waves and colour for the tracks, as hex. */
  setColours(ink: string, trace: string) {
    this.ink = rgbOf(ink, this.ink)
    this.trace = rgbOf(trace, this.trace)
  }

  reset() {
    this.frontX = this.previousX = Infinity
    this.simulationTime = 0
    this.segments = []
    this.flashes = []
    this.tracking = true
    this.seedPoints()
  }

  private seedPoints() {
    const g = this.geometry
    const initial = clipMotion(0)
    const handoff = this.clipExitTime()
    const a = clipMotion(handoff), b = clipMotion(handoff + 0.05)
    this.seed = 11 + 1013 * this.pass++
    this.points = []
    for (const [key, dirKey, family] of [['upper', 'upperDirection', 0], ['lower', 'lowerDirection', 1]] as const) {
      const y = g.videoOriginY + initial[key] * g.scale
      const slope = Math.max(0.25, Math.min(1.4, Math.abs((b[key] - a[key]) / (b.x - a.x))))
      // Only the two branches of this collision; vary speed after the handoff.
      this.points.push({ y, py: y, dir: initial[dirKey], family, energy: 0.5, k: 0.85 + 0.3 * this.random(), slope })
    }
  }

  private stepPoints(x: number, time: number) {
    const H = this.geometry.H
    const width = Math.max(60, H * this.cellFrac), length = width * 1.7
    const dx = this.previousX - x
    const tracked = time <= this.clipExitTime()
    const motion = clipMotion(time)
    if (!tracked && this.tracking) {
      // A branch outside the camera crop joins from the canvas edge, not its interior.
      for (const p of this.points) p.y = Math.max(0, Math.min(H, p.y))
      this.tracking = false
    }
    for (const p of this.points) {
      p.py = p.y
      if (tracked) {
        p.y = this.geometry.videoOriginY + (p.family === 0 ? motion.upper : motion.lower) * this.geometry.scale
        p.dir = p.family === 0 ? motion.upperDirection : motion.lowerDirection
        p.energy = time < CLIP.collisionTime ? 0.5 : 0.25 + 0.75 * Math.exp(-(time - CLIP.collisionTime) / 1.1)
      } else {
        p.y += p.dir * dx * p.slope * p.k * (0.75 + 0.25 * p.energy)
        p.energy *= Math.exp(-dx / (0.45 * length))
        if (p.y < 0) { p.y = -p.y; p.dir = 1; p.energy = 1 }
        if (p.y > H) { p.y = 2 * H - p.y; p.dir = -1; p.energy = 1 }
      }
      this.segments.push({ x1: this.previousX, y1: p.py, x2: x, y2: p.y, time, energy: p.energy })
    }
    for (const a of this.points) if (!tracked && a.family === 0) for (const b of this.points) if (b.family === 1) {
      if ((a.py - b.py) * (a.y - b.y) < 0 && Math.abs(a.py - b.py) < width) {
        this.flashes.push({ x, y: (a.y + b.y) / 2, time })
        a.energy = b.energy = 1
      }
    }
    this.previousX = x
  }

  /** Move the waves to where the clip's front is at clip-second `time`. */
  advance(time: number) {
    const g = this.geometry
    const x = g.videoOrigin + clipMotion(time).x * g.scale
    if (!Number.isFinite(this.previousX)) this.previousX = Math.min(g.W + 2, x)
    const distance = this.previousX - x
    if (distance > 0 && x < g.W + 2) {
      // Fixed spatial substeps keep collisions and curves stable at 15 fps or after a delayed frame.
      const fromX = this.previousX, fromTime = this.simulationTime
      const count = Math.max(1, Math.ceil(distance / 1.5))
      for (let i = 1; i <= count; i++) {
        this.stepPoints(fromX - distance * i / count, fromTime + (time - fromTime) * i / count)
      }
    }
    this.frontX = x
    this.simulationTime = time
    this.segments = this.segments.filter(s => time - s.time < TRACE_LIFETIME)
    this.flashes = this.flashes.filter(f => time - f.time < 0.6)
  }

  draw(ctx: CanvasRenderingContext2D) {
    const { W, H, dpr, videoLeft, vw } = this.geometry
    const ink = this.ink, trace = this.trace
    const now = this.simulationTime
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const s of this.segments) {
      const life = Math.max(0, 1 - (now - s.time) / TRACE_LIFETIME)
      const fade = life * life * (3 - 2 * life)
      ctx.strokeStyle = `rgba(${trace},${(0.55 + 0.4 * s.energy) * fade})`
      ctx.lineWidth = 1.2 + 0.8 * s.energy
      ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke()
    }
    for (const f of this.flashes) {
      const age = now - f.time
      const radius = 6 + 18 * age
      const gradient = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, radius)
      gradient.addColorStop(0, `rgba(${ink},${0.4 * Math.max(0, 1 - age / 0.6)})`)
      gradient.addColorStop(1, `rgba(${ink},0)`)
      ctx.fillStyle = gradient
      ctx.beginPath(); ctx.arc(f.x, f.y, radius, 0, Math.PI * 2); ctx.fill()
    }
    // Only transverse waves: there is deliberately no continuous front line.
    const frontX = this.frontX
    if (frontX < W + 2 && frontX > -MARGIN) {
      const width = Math.max(60, H * this.cellFrac)
      for (const p of this.points) {
        const length = (0.45 + 0.5 * p.energy) * width
        const aspect = 1 / p.slope
        const ex = frontX + length * aspect / Math.hypot(aspect, 1)
        const ey = p.y + p.dir * length / Math.hypot(aspect, 1)
        const gradient = ctx.createLinearGradient(frontX, p.y, ex, ey)
        gradient.addColorStop(0, `rgba(${ink},${0.25 + 0.35 * p.energy})`)
        gradient.addColorStop(1, `rgba(${ink},0)`)
        ctx.strokeStyle = gradient
        ctx.lineWidth = 1.2
        ctx.beginPath(); ctx.moveTo(frontX, p.y)
        // The bulge follows the wave's direction of travel while both ends stay put.
        const controlX = frontX + 0.3 * length
        const chordY = p.y + (ey - p.y) * (controlX - frontX) / (ex - frontX)
        const controlY = 2 * chordY - (p.y + p.dir * 0.08 * length)
        ctx.quadraticCurveTo(controlX, controlY, ex, ey); ctx.stroke()
      }
    }
    // Complement the clip's narrow horizontal mask: nothing is drawn over the footage.
    ctx.globalCompositeOperation = 'destination-in'
    const mask = ctx.createLinearGradient(videoLeft, 0, videoLeft + vw * FEATHER, 0)
    mask.addColorStop(0, '#000')
    mask.addColorStop(1, 'transparent')
    ctx.fillStyle = mask
    ctx.fillRect(0, 0, W, H)
    ctx.globalCompositeOperation = 'source-over'
  }
}
