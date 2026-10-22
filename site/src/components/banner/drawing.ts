// The drawn half of the banner: transverse waves that continue the clip's front
// across the band and write fading tracks, as triple points do on a soot foil.
// Ported from animation/banner/banner.js; the numbers are the ones chosen there.

/** The clip's front, measured frame by frame: x = x0 + v * fps * t, in crop pixels. */
export const CLIP = { w: 292, h: 200, fps: 15, x0: 328.5784, v: -2.937155, duration: 12.6 } as const
/** Part of the clip's width over which the drawing blends into the footage (matches the CSS mask). */
export const FEATHER = 0.08
/** Seconds a track stays visible. */
export const TRACE_LIFETIME = 2
/** How far past the band's left edge the last wave travels before the loop restarts. */
export const MARGIN = 40

interface Point { y: number; py: number; dir: 1 | -1; family: 0 | 1; energy: number; k: number }
interface Segment { x1: number; y1: number; x2: number; y2: number; time: number; energy: number }
interface Flash { x: number; y: number; time: number }

export interface Box { left: number; width: number; height: number }

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
  /** Page pixels per clip-second. */
  speed: number
}

function rgbOf(hex: string, fallback: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return fallback
  return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16)).join(',')
}

export class FoilDrawing {
  geometry: Geometry = { W: 0, H: 0, dpr: 1, scale: 1, vw: 0, videoLeft: 0, videoOrigin: 0, speed: 1 }
  /** Cell width as a fraction of the band's height. */
  cellFrac = 0.3
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
    this.geometry = { W, H, dpr: Math.min(2, dpr), scale, vw, videoLeft, videoOrigin, speed: Math.abs(CLIP.v) * CLIP.fps * scale }
    this.reset()
  }

  /** Clip seconds at which the waves have left the band. */
  leaveTime(): number {
    const g = this.geometry
    return (g.videoOrigin + CLIP.x0 * g.scale + MARGIN) / g.speed
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
    this.seedPoints()
  }

  private seedPoints() {
    const H = this.geometry.H
    const width = Math.max(60, H * this.cellFrac)
    const count = Math.max(2, Math.round(H / width))
    this.seed = 11 + 1013 * this.pass++
    this.points = []
    for (let i = 0; i < count; i++) {
      const y = H * (i + 0.5) / count + (this.random() - 0.5) * 0.3 * width
      const y2 = y + H / (2 * count) + (this.random() - 0.5) * 0.3 * width
      for (const [position, dir, family] of [[y, 1, 0], [y2, -1, 1]] as const) {
        const clamped = Math.max(1, Math.min(H - 1, position))
        // k scales the transverse speed: a different set every pass, within about ±15 %.
        this.points.push({ y: clamped, py: clamped, dir, family, energy: 0.4 + 0.6 * this.random(), k: 0.85 + 0.3 * this.random() })
      }
    }
  }

  private stepPoints(x: number, time: number) {
    const H = this.geometry.H
    const width = Math.max(60, H * this.cellFrac), length = width * 1.7
    const dx = this.previousX - x
    for (const p of this.points) {
      p.py = p.y
      // The transverse wave is strongest just after a collision and weakens along
      // the cell, so the track curves: steep at first, flatter later.
      p.y += p.dir * dx / 1.7 * p.k * (0.55 + 0.6 * p.energy)
      p.energy *= Math.exp(-dx / (0.45 * length))
      if (p.y < 0) { p.y = -p.y; p.dir = 1; p.energy = 1 }
      if (p.y > H) { p.y = 2 * H - p.y; p.dir = -1; p.energy = 1 }
      this.segments.push({ x1: this.previousX, y1: p.py, x2: x, y2: p.y, time, energy: p.energy })
    }
    for (const a of this.points) if (a.family === 0) for (const b of this.points) if (b.family === 1) {
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
    const x = g.videoOrigin + (CLIP.x0 + CLIP.v * CLIP.fps * time) * g.scale
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
        const ex = frontX + length * 1.7 / Math.hypot(1.7, 1)
        const ey = p.y + p.dir * length / Math.hypot(1.7, 1)
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
