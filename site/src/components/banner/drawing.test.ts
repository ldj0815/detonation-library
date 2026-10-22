import { test, expect } from 'vitest'
import { FoilDrawing, CLIP } from './drawing'

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
  // The front enters the footage 0.8 s in and crosses it in about seven seconds.
  expect(d.clipExitTime()).toBeGreaterThan(7)
  expect(d.clipExitTime()).toBeLessThan(7.5)
  expect(d.leaveTime()).toBeGreaterThan(CLIP.duration)
})

test('each pass draws its own wave speeds, within the same bounds', () => {
  const d = new FoilDrawing()
  d.layout(band, clip, 1)
  const first = speeds(d)
  d.reset()
  const second = speeds(d)
  expect(second).toHaveLength(first.length)
  expect(second).not.toEqual(first)
  for (const k of [...first, ...second]) {
    expect(k).toBeGreaterThanOrEqual(0.85)
    expect(k).toBeLessThanOrEqual(1.15)
  }
})
