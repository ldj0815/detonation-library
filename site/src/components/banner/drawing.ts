// The drawn half of the banner: transverse waves that continue the clip's front
// across the band and write fading tracks, as triple points do on a soot foil.
// One symmetric pair makes a single row of regular diamond cells.
import { CLIP, clipMotion, timeAtFront } from './clip'
import { DEFAULT_BANNER_SETTINGS, type BannerSettings } from './settings'
export { CLIP } from './clip'

/** Part of the clip's width over which the drawing blends into the footage (matches the CSS mask). */
export const FEATHER = 0.08
/** Seconds a track stays visible. */
export const TRACE_LIFETIME = 2
/** How far past the band's left edge the last wave travels before the loop restarts. */
export const MARGIN = 40

interface Point { y: number; py: number; dir: 1 | -1; family: 0 | 1; energy: number }
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
  private settings: BannerSettings = DEFAULT_BANNER_SETTINGS
  geometry: Geometry = { W: 0, H: 0, dpr: 1, scale: 1, vw: 0, videoLeft: 0, videoOrigin: 0, videoOriginY: 0, speed: 1 }
  private ink = '220,230,245'
  private trace = '244,207,53'
  private points: Point[] = []
  private segments: Segment[] = []
  private flashes: Flash[] = []
  private frontX = Infinity
  private previousX = Infinity
  private simulationTime = 0

  configure(settings: BannerSettings) { this.settings = settings }

  /** Keep the recording's cell scale, even when a cell extends past the banner. */
  cellSize(): number {
    return this.settings.animation.cellWidth * this.geometry.scale
  }

  /** The central strip is a window into a larger cell, not a size constraint. */
  cellHeight(): number {
    return this.settings.animation.cellHeight * this.geometry.scale
  }

  /** Band and clip boxes in page pixels; the clip sits in its box like object-fit: cover. */
  layout(band: Box, clip: Box, dpr: number) {
    const W = band.width, H = band.height
    const vw = clip.width
    const v = this.settings.video
    const scale = Math.max(clip.height / v.cropHeight, vw / v.cropWidth) * v.zoom
    const videoLeft = clip.left - band.left
    const videoOrigin = videoLeft - (v.cropWidth * scale - vw) / 2 - v.cropX * scale
    const videoOriginY = (clip.top ?? 0) - (band.top ?? 0) - (v.cropHeight * scale - clip.height) / 2 - v.cropY * scale
    const duration = (v.endFrame - v.startFrame) / CLIP.fps
    const speed = (clipMotion(duration, v.startFrame).x - clipMotion(duration + 1, v.startFrame).x) * scale
    this.geometry = { W, H, dpr: Math.min(2, dpr), scale, vw, videoLeft, videoOrigin, videoOriginY, speed }
    this.reset()
  }

  /** Clip seconds at which the front passes the left edge of the clip's box. */
  clipExitTime(): number {
    const g = this.geometry
    return timeAtFront((g.videoLeft - g.videoOrigin) / g.scale, this.settings.video.startFrame)
  }

  /** Clip seconds at which the waves have left the band. */
  leaveTime(): number {
    const g = this.geometry
    return timeAtFront((-MARGIN - g.videoOrigin) / g.scale, this.settings.video.startFrame)
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
    const g = this.geometry
    const y = g.videoOriginY + this.settings.animation.centerY * g.scale
    this.points = [
      { y, py: y, dir: 1, family: 0, energy: 1 },
      { y, py: y, dir: -1, family: 1, energy: 1 },
    ]
  }

  private stepPoints(x: number, time: number) {
    const g = this.geometry, size = this.cellSize()
    const centerY = g.videoOriginY + this.settings.animation.centerY * g.scale
    const collisionX = g.videoOrigin + this.settings.animation.anchorX * g.scale
    const distance = collisionX - x
    // Mirrored triangle waves: equal slopes, simultaneous reflections,
    // and a center collision every cell. Motion is identical on every pass.
    const phase = ((distance + size / 2) % (2 * size) + 2 * size) % (2 * size)
    const offset = (phase <= size ? phase - size / 2 : 1.5 * size - phase) * this.cellHeight() / size
    const direction = phase < size ? 1 : -1
    const sinceTurn = ((distance % (size / 2)) + size / 2) % (size / 2)
    const energy = 0.35 + 0.65 * Math.exp(-sinceTurn / (0.22 * size))
    for (const p of this.points) {
      p.py = p.y
      const sign = p.family === 0 ? 1 : -1
      p.y = centerY + sign * offset
      p.dir = (sign * direction) as 1 | -1
      p.energy = energy
      this.segments.push({ x1: this.previousX, y1: p.py, x2: x, y2: p.y, time, energy: p.energy })
    }
    const [a, b] = this.points
    if ((a.py - b.py) * (a.y - b.y) < 0 || (a.y === b.y && a.py !== b.py)) {
      this.flashes.push({ x, y: centerY, time })
    }
    this.previousX = x
  }

  /** Move the waves to where the clip's front is at clip-second `time`. */
  advance(time: number) {
    const g = this.geometry
    const start = this.settings.video.startFrame
    const x = g.videoOrigin + clipMotion(time, start).x * g.scale
    if (!Number.isFinite(this.previousX)) this.previousX = Math.min(g.W + 2, g.videoOrigin + clipMotion(0, start).x * g.scale)
    const distance = this.previousX - x
    if (distance > 0 && x < g.W + 2) {
      // Fixed spatial substeps keep collisions and curves stable at 15 fps or after a delayed frame.
      const fromX = this.previousX, fromTime = this.simulationTime
      const count = Math.max(1, Math.ceil(distance / 1.5))
      for (let i = 1; i <= count; i++) {
        this.stepPoints(i === count ? x : fromX - distance * i / count, fromTime + (time - fromTime) * i / count)
      }
    }
    this.frontX = x
    this.simulationTime = time
    this.segments = this.segments.filter(s => time - s.time < this.settings.animation.traceLifetime)
    this.flashes = this.flashes.filter(f => time - f.time < 0.6)
  }

  draw(ctx: CanvasRenderingContext2D) {
    const { W, H, dpr, videoLeft, vw } = this.geometry
    const ink = this.ink, trace = this.trace
    const a = this.settings.animation
    const now = this.simulationTime
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const s of this.segments) {
      const life = Math.max(0, 1 - (now - s.time) / Math.max(0.001, a.traceLifetime))
      const fade = life * life * (3 - 2 * life)
      ctx.strokeStyle = `rgba(${trace},${(0.55 + 0.4 * s.energy) * fade * a.traceOpacity})`
      ctx.lineWidth = a.traceWidth * (1 + 2 / 3 * s.energy)
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
      const cellWidth = this.cellSize(), cellHeight = this.cellHeight()
      const diagonal = Math.hypot(cellWidth, cellHeight)
      for (const p of this.points) {
        const length = (0.45 + 0.5 * p.energy) * diagonal * a.waveLength
        const ex = frontX + length * cellWidth / diagonal
        const ey = p.y + p.dir * length * cellHeight / diagonal
        const gradient = ctx.createLinearGradient(frontX, p.y, ex, ey)
        gradient.addColorStop(0, `rgba(${ink},${(0.25 + 0.35 * p.energy) * a.waveOpacity})`)
        gradient.addColorStop(1, `rgba(${ink},0)`)
        ctx.strokeStyle = gradient
        ctx.lineWidth = a.waveWidth
        ctx.beginPath(); ctx.moveTo(frontX, p.y)
        // The bulge follows the wave's direction of travel while both ends stay put.
        const controlX = frontX + 0.4 * (ex - frontX)
        const controlY = p.y + (0.4 + a.curvature) * (ey - p.y)
        ctx.quadraticCurveTo(controlX, controlY, ex, ey); ctx.stroke()
      }
    }
    // Complement the clip's narrow horizontal mask: nothing is drawn over the footage.
    ctx.globalCompositeOperation = 'destination-in'
    const mask = ctx.createLinearGradient(videoLeft, 0, videoLeft + Math.max(0.01, vw * this.settings.layout.feather / 100), 0)
    mask.addColorStop(0, '#000')
    mask.addColorStop(1, 'transparent')
    ctx.fillStyle = mask
    ctx.fillRect(0, 0, W, H)
    ctx.globalCompositeOperation = 'source-over'
  }
}
