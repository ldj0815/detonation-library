import { test, expect } from 'vitest'
import { FoilDrawing, CLIP, TRACE_LIFETIME } from './drawing'
import { clipMotion, timeAtFront } from './clip'

const band = { left: 0, width: 1200, height: 440 }
const clip = { left: 600, width: 600, height: 440 }

function speeds(d: FoilDrawing): number[] {
  return (d as unknown as { points: { k: number }[] }).points.map(p => p.k)
}

test('the clip box is treated like object-fit: cover', () => {
  const d = new FoilDrawing()
  d.layout(band, clip, 1)
  const g = d.geometry
  expect(g.scale).toBeCloseTo(440 / CLIP.h)
  expect(g.videoLeft).toBe(600)
  // The clip is wider than its box at this scale, so its own x = 0 lies left of the box.
  expect(g.videoOrigin).toBeLessThan(600)
  expect(d.clipExitTime()).toBeGreaterThan(CLIP.collisionTime)
  expect(d.clipExitTime()).toBeLessThan(CLIP.duration)
  expect(clipMotion(d.clipExitTime()).x * g.scale + g.videoOrigin).toBeCloseTo(g.videoLeft)
  expect(d.leaveTime()).toBeGreaterThan(CLIP.duration)
})

test('each pass draws its own wave speeds, within the same bounds', () => {
  const d = new FoilDrawing()
  d.layout(band, clip, 1)
  const first = speeds(d)
  d.reset()
  const second = speeds(d)
  expect(second).toHaveLength(2)
  expect(second).not.toEqual(first)
  for (const k of [...first, ...second]) {
    expect(k).toBeGreaterThanOrEqual(0.85)
    expect(k).toBeLessThanOrEqual(1.15)
  }
})

test('test04 collision is centered and its two branches converge then separate', () => {
  const at = clipMotion(CLIP.collisionTime)
  const before = clipMotion(CLIP.collisionTime - 0.5)
  const after = clipMotion(CLIP.collisionTime + 0.5)
  expect(at.upper).toBe(at.lower)
  expect(at.x).toBe(CLIP.collision.x)
  expect(at.upper).toBe(CLIP.collision.y)
  expect(Math.abs(at.x / CLIP.w - 0.5)).toBeLessThan(0.02)
  expect(Math.abs(at.upper / CLIP.h - 0.5)).toBeLessThan(0.02)
  expect(before.upper).toBeLessThan(at.upper)
  expect(before.lower).toBeGreaterThan(at.lower)
  expect(after.upper).toBeLessThan(at.upper)
  expect(after.lower).toBeGreaterThan(at.lower)
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
  d.layout({ left: 0, top: 100, width: 1800, height: 400 }, { left: 900, top: 100, width: 900, height: 400 }, 3)
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
