import { expect, test } from 'vitest'
import { DEFAULT_BANNER_SETTINGS, parseBannerSettings } from './settings'

test('saved settings round-trip without altering the selected banner', () => {
  expect(parseBannerSettings(JSON.parse(JSON.stringify(DEFAULT_BANNER_SETTINGS)))).toEqual(DEFAULT_BANNER_SETTINGS)
})
test('imports keep crop and trim inside the available recording', () => {
  const value = parseBannerSettings({ version: 1, video: { cropX: 600, cropY: 470, cropWidth: 400, cropHeight: 300, startFrame: 248, endFrame: 10 } })
  expect(value.video.cropX + value.video.cropWidth).toBeLessThanOrEqual(628)
  expect(value.video.cropY + value.video.cropHeight).toBeLessThanOrEqual(480)
  expect(value.video.endFrame).toBe(249)
  expect(value.video.startFrame).toBe(248)
})
test('invalid files cannot inject arbitrary settings or non-finite drawing values', () => {
  expect(() => parseBannerSettings({ version: 8 })).toThrow()
  expect(() => parseBannerSettings({ version: 1, video: { zoom: Infinity } })).toThrow()
  expect(() => parseBannerSettings({ version: 1, animation: { traceColor: 'url(external)' } })).toThrow()
  const value = parseBannerSettings({ version: 1, path: '../../anything', video: { source: 'external' } })
  expect(value).not.toHaveProperty('path')
  expect(value.video).not.toHaveProperty('source')
})
