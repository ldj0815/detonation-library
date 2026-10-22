import test from 'node:test'
import assert from 'node:assert/strict'
import { BannerPlayback } from './playback.js'

class Video extends EventTarget {
  readyState = 0
  ended = false
  seeking = false
  error = null
  style = {}
  time = 0
  playCalls = 0
  playbackRate = 1
  paused = true
  get currentTime() { return this.time }
  set currentTime(value) { this.seekTarget = value; this.seeking = true }
  load() { this.readyState = 0; this.time = 0; this.ended = false }
  loaded() { this.readyState = 2; this.dispatchEvent(new Event('loadeddata')) }
  seeked() {
    this.time = this.seekTarget; this.seeking = false; this.ended = false
    this.dispatchEvent(new Event('seeked'))
  }
  play() { this.playCalls++; this.paused = false; return Promise.resolve() }
  pause() { this.paused = true }
}
const flush = () => new Promise(resolve => setImmediate(resolve))

test('cold start waits for media; a slow load cannot advance to the tail', async () => {
  const video = new Video(), player = new BannerPlayback(video)
  const starting = player.start('dark.mp4')
  player.advance(30, 16)
  assert.equal(player.phase, 'loading')
  assert.equal(player.time, 0)
  assert.equal(video.playCalls, 0)
  assert.equal(video.style.opacity, '0')
  video.loaded(); await starting
  assert.equal(video.style.opacity, '1')
  assert.equal(player.phase, 'playing')
  assert.equal(video.currentTime, 0)
})

test('first four loops wait for rewind and never change playback speed', async () => {
  const video = new Video(), player = new BannerPlayback(video)
  const starting = player.start('grey.mp4'); video.loaded(); await starting
  for (let cycle = 0; cycle < 4; cycle++) {
    video.time = 7.6; player.advance(0.1, 16)
    assert.equal(player.phase, 'playing')
    assert.equal(video.playbackRate, 1)
    video.time = 12.6; video.ended = true; player.advance(0.1, 16)
    assert.equal(player.phase, 'tail')
    player.advance(3.5, 16)
    assert.equal(player.phase, 'fading')
    player.advance(0.3, 16); await flush()
    assert.equal(video.style.opacity, '0')
    assert.equal(video.seeking, true)
    assert.equal(video.playCalls, cycle + 1)
    player.advance(5, 16)
    assert.equal(player.time, 0)
    video.seeked(); await flush()
    assert.equal(player.phase, 'playing')
    assert.equal(video.style.opacity, '1')
    assert.equal(video.currentTime, 0)
    assert.equal(video.playCalls, cycle + 2)
  }
})

test('rapid theme changes cancel old load listeners without duplicate starts', async () => {
  const video = new Video(), player = new BannerPlayback(video)
  const first = player.start('dark.mp4')
  const second = player.start('light.mp4')
  const third = player.start('grey.mp4')
  video.loaded()
  await Promise.all([first, second, third])
  assert.equal(video.src, 'grey.mp4')
  assert.equal(video.playCalls, 1)
  assert.equal(player.phase, 'playing')
})

test('pause during pending play remains resumable', async () => {
  const video = new Video(), player = new BannerPlayback(video)
  let rejectPlay
  video.play = () => new Promise((_, reject) => { rejectPlay = reject })
  const starting = player.start('grey.mp4'); video.loaded(); await flush()
  player.pause()
  rejectPlay(new DOMException('Playback interrupted by pause', 'AbortError'))
  await starting
  assert.equal(player.phase, 'playing')
  assert.equal(player.paused, true)
  video.play = Video.prototype.play
  await player.resume()
  assert.equal(player.paused, false)
  assert.equal(video.paused, false)
})

test('pausing the tail freezes its clock, including while a tab is hidden', async () => {
  const video = new Video(), player = new BannerPlayback(video)
  const starting = player.start('grey.mp4'); video.loaded(); await starting
  video.time = 12.6; video.ended = true; player.advance(0.1, 16)
  player.pause(); player.advance(60, 16)
  assert.equal(player.time, 12.6)
  await player.resume(); player.advance(0.1, 16)
  assert.equal(player.time, 12.7)
})

test('reduced motion cancels a pending load and never starts playback', async () => {
  const video = new Video(), player = new BannerPlayback(video)
  const starting = player.start('dark.mp4')
  player.stop(); video.loaded(); await starting
  assert.equal(player.phase, 'still')
  assert.equal(video.playCalls, 0)
  assert.equal(video.style.opacity, '0')
})

test('blocked autoplay can be retried with the Play control', async () => {
  const video = new Video(), player = new BannerPlayback(video)
  video.play = () => Promise.reject(new DOMException('Gesture required', 'NotAllowedError'))
  const starting = player.start('dark.mp4'); video.loaded(); await starting
  assert.equal(player.phase, 'ready')
  assert.equal(player.paused, true)
  video.play = Video.prototype.play
  await player.resume()
  assert.equal(player.phase, 'playing')
  assert.equal(video.paused, false)
})
