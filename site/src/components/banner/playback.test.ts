import { test, expect } from 'vitest'
import { BannerPlayback, type MediaLike } from './playback'

class Video extends EventTarget implements MediaLike {
  readyState = 0
  ended = false
  seeking = false
  error: unknown = null
  style = { opacity: '' }
  time = 0
  seekTarget = 0
  playCalls = 0
  playbackRate = 1
  paused = true
  src = ''
  get currentTime() { return this.time }
  set currentTime(value: number) { this.seekTarget = value; this.seeking = true }
  load() { this.readyState = 0; this.time = 0; this.ended = false }
  loaded() { this.readyState = 2; this.dispatchEvent(new Event('loadeddata')) }
  seeked() {
    this.time = this.seekTarget; this.seeking = false; this.ended = false
    this.dispatchEvent(new Event('seeked'))
  }
  play() { this.playCalls++; this.paused = false; return Promise.resolve() }
  pause() { this.paused = true }
}
const flush = () => new Promise(resolve => setTimeout(resolve, 0))

test('cold start waits for media; a slow load cannot advance to the tail', async () => {
  const video = new Video(), player = new BannerPlayback(video)
  const starting = player.start('dark.mp4')
  player.advance(30, 16)
  expect(player.phase).toBe('loading')
  expect(player.time).toBe(0)
  expect(video.playCalls).toBe(0)
  expect(video.style.opacity).toBe('0')
  video.loaded(); await starting
  expect(video.style.opacity).toBe('1')
  expect(player.phase).toBe('playing')
  expect(video.currentTime).toBe(0)
})

test('first four loops wait for rewind and never change playback speed', async () => {
  const video = new Video(), player = new BannerPlayback(video)
  const starting = player.start('dark.mp4'); video.loaded(); await starting
  for (let cycle = 0; cycle < 4; cycle++) {
    video.time = 7.6; player.advance(0.1, 16)
    expect(player.phase).toBe('playing')
    expect(video.playbackRate).toBe(1)
    video.time = 12.6; video.ended = true; player.advance(0.1, 16)
    expect(player.phase).toBe('tail')
    player.advance(3.5, 16)
    expect(player.phase).toBe('fading')
    player.advance(0.3, 16); await flush()
    expect(video.style.opacity).toBe('0')
    expect(video.seeking).toBe(true)
    expect(video.playCalls).toBe(cycle + 1)
    player.advance(5, 16)
    expect(player.time).toBe(0)
    video.seeked(); await flush()
    expect(player.phase).toBe('playing')
    expect(video.style.opacity).toBe('1')
    expect(video.currentTime).toBe(0)
    expect(video.playCalls).toBe(cycle + 2)
  }
})

test('rapid theme changes cancel old load listeners without duplicate starts', async () => {
  const video = new Video(), player = new BannerPlayback(video)
  const first = player.start('dark.mp4')
  const second = player.start('light.mp4')
  const third = player.start('dark.mp4')
  video.loaded()
  await Promise.all([first, second, third])
  expect(video.src).toBe('dark.mp4')
  expect(video.playCalls).toBe(1)
  expect(player.phase).toBe('playing')
})

test('pause during pending play remains resumable', async () => {
  const video = new Video(), player = new BannerPlayback(video)
  let rejectPlay: (reason: unknown) => void = () => {}
  video.play = () => new Promise<void>((_, reject) => { rejectPlay = reject })
  const starting = player.start('dark.mp4'); video.loaded(); await flush()
  player.pause()
  rejectPlay(new DOMException('Playback interrupted by pause', 'AbortError'))
  await starting
  expect(player.phase).toBe('playing')
  expect(player.paused).toBe(true)
  video.play = Video.prototype.play
  await player.resume()
  expect(player.paused).toBe(false)
  expect(video.paused).toBe(false)
})

test('pausing the tail freezes its clock, including while a tab is hidden', async () => {
  const video = new Video(), player = new BannerPlayback(video)
  const starting = player.start('dark.mp4'); video.loaded(); await starting
  video.time = 12.6; video.ended = true; player.advance(0.1, 16)
  player.pause(); player.advance(60, 16)
  expect(player.time).toBe(12.6)
  await player.resume(); player.advance(0.1, 16)
  expect(player.time).toBeCloseTo(12.7)
})

test('reduced motion cancels a pending load and never starts playback', async () => {
  const video = new Video(), player = new BannerPlayback(video)
  const starting = player.start('dark.mp4')
  player.stop(); video.loaded(); await starting
  expect(player.phase).toBe('still')
  expect(video.playCalls).toBe(0)
  expect(video.style.opacity).toBe('0')
})

test('blocked autoplay can be retried with the Play control', async () => {
  const video = new Video(), player = new BannerPlayback(video)
  video.play = () => Promise.reject(new DOMException('Gesture required', 'NotAllowedError'))
  const starting = player.start('dark.mp4'); video.loaded(); await starting
  expect(player.phase).toBe('ready')
  expect(player.paused).toBe(true)
  video.play = Video.prototype.play
  await player.resume()
  expect(player.phase).toBe('playing')
  expect(video.paused).toBe(false)
})
