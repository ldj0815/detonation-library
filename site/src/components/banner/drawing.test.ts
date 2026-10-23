import { test, expect } from 'vitest'
import { FoilDrawing, CLIP, TRACE_LIFETIME } from './drawing'
import { clipMotion, timeAtFront } from './clip'

const band = { left: 0, width: 1200, height: 440 }
const clip = { left: 600, width: 600, height: 440 }

function points(d: FoilDrawing) {
  return (d as unknown as { points: { y: number; dir: number }[] }).points.map(({ y, dir }) => ({ y, dir }))
}

test('the clip box is treated like object-fit: cover', () => {
  const d = new FoilDrawing()
  d.layout(band, clip, 1)
  const g = d.geometry
  expect(g.scale).toBeCloseTo(440 / CLIP.h)
  expect(g.videoLeft).toBe(600)
  // The clip is wider than its box at this scale, so its own x = 0 lies left of the box.
  expect(g.videoOrigin).toBeLessThan(600)
  expect(d.clipExitTime()).toBeGreaterThan(0)
  expect(d.clipExitTime()).toBeLessThan(CLIP.duration)
  expect(clipMotion(d.clipExitTime()).x * g.scale + g.videoOrigin).toBeCloseTo(g.videoLeft)
  expect(d.leaveTime()).toBeGreaterThan(CLIP.duration)
})

test('the symmetric cell keeps the video scale and can extend beyond the banner', () => {
  const d = new FoilDrawing()
  d.layout(band, clip, 1)
  const g = d.geometry, size = d.cellSize()
  const centerY = g.videoOriginY + CLIP.center.y * g.scale
  expect(size).toBeGreaterThan(band.width)
  expect(d.cellHeight()).toBeGreaterThan(band.height)
  let extendsOutside = false
  for (let quarter = 0; quarter <= 12; quarter++) {
    const x = CLIP.cell.anchorX - quarter * size / (4 * g.scale)
    d.advance(timeAtFront(x))
    const [a, b] = points(d)
    expect(points(d)).toHaveLength(2)
    expect((a.y + b.y) / 2).toBeCloseTo(centerY)
    expect(a.dir).toBe(-b.dir)
    const height = d.cellHeight()
    const offset = [0, height / 4, height / 2, height / 4][quarter % 4]
    expect(Math.abs(a.y - centerY)).toBeCloseTo(offset)
    extendsOutside ||= [a, b].some(point => point.y < 0 || point.y > band.height)
  }
  expect(extendsOutside).toBe(true)
  // A wider banner at the same media scale does not stretch the cell.
  d.layout({ ...band, width: 1600 }, { ...clip, left: 800, width: 800 }, 1)
  expect(d.cellSize()).toBeCloseTo(size)
})

test('regular wave positions repeat exactly across loops and delayed frames', () => {
  const d = new FoilDrawing()
  d.layout(band, clip, 1)
  for (let time = 0; time < 12; time += 0.05) d.advance(time)
  d.advance(12)
  const first = points(d)
  d.reset()
  d.advance(12)
  expect(points(d)).toEqual(first)
})

test('front inversion stays continuous through the collision and beyond the footage', () => {
  let previous = Infinity
  for (let time = 0; time < 20; time += 0.05) {
    const x = clipMotion(time).x
    expect(x).toBeLessThan(previous)
    expect(timeAtFront(x)).toBeCloseTo(time, 6)
    previous = x
  }
})

test('the handoff uses the visible video crop, including vertical crop on wide screens', () => {
  const d = new FoilDrawing()
  d.layout({ left: 0, top: 100, width: 3600, height: 400 }, { left: 1800, top: 100, width: 1800, height: 400 }, 3)
  const g = d.geometry
  expect(g.videoOriginY).toBeLessThan(0)
  expect(g.dpr).toBe(2)
  expect(g.videoOriginY + CLIP.h / 2 * g.scale).toBeCloseTo(200)
  d.advance(d.clipExitTime() - 0.01)
  d.advance(d.clipExitTime() + 0.01)
  const points = (d as unknown as { points: { y: number }[] }).points
  expect(points).toHaveLength(2)
  for (const point of points) expect(Number.isFinite(point.y)).toBe(true)
})

test('gold traces expire completely at two seconds', () => {
  const d = new FoilDrawing()
  d.layout(band, clip, 1)
  for (let time = 0; time < 14; time += 0.05) d.advance(time)
  const state = d as unknown as { simulationTime: number; segments: { time: number }[] }
  expect(state.segments.length).toBeGreaterThan(0)
  for (const segment of state.segments) expect(state.simulationTime - segment.time).toBeLessThan(TRACE_LIFETIME)
})
