// The media clock owns the handoff. Rewinds finish while the video is hidden.
export class BannerPlayback {
  constructor(video, { onReset = () => {}, onChange = () => {} } = {}) {
    this.video = video
    this.onReset = onReset
    this.onChange = onChange
    this.phase = 'idle'
    this.time = 0
    this.paused = false
    this.fadeElapsed = 0
    this.generation = 0
    this.pending = null
  }

  waitFor(events, ready, signal) {
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        events.forEach(name => this.video.removeEventListener(name, check))
        this.video.removeEventListener('error', error)
        signal.removeEventListener('abort', abort)
      }
      const check = () => { if (ready()) { cleanup(); resolve() } }
      const error = () => { cleanup(); reject(new Error('Video could not load.')) }
      const abort = () => { cleanup(); reject(new DOMException('Cancelled', 'AbortError')) }
      events.forEach(name => this.video.addEventListener(name, check))
      this.video.addEventListener('error', error)
      signal.addEventListener('abort', abort, { once: true })
      if (signal.aborted) abort()
      else if (this.video.error) error()
      else check()
    })
  }

  async start(source) {
    this.pending?.abort()
    const pending = new AbortController()
    this.pending = pending
    const generation = ++this.generation
    const video = this.video
    video.pause()
    video.style.opacity = '0'
    video.playbackRate = 1
    this.phase = 'loading'
    this.time = 0
    this.onReset()
    this.onChange()
    try {
      if (source !== undefined) {
        video.src = source
        video.load()
      }
      await this.waitFor(['loadeddata', 'canplay'], () => video.readyState >= 2, pending.signal)
      if (video.currentTime !== 0 || video.ended || video.seeking) {
        // Register before assigning currentTime, including fast cached seeks.
        const rewound = this.waitFor(['seeked', 'loadeddata', 'canplay'],
          () => !video.seeking && video.currentTime < 0.02 && !video.ended && video.readyState >= 2,
          pending.signal)
        video.currentTime = 0
        await rewound
      }
      if (generation !== this.generation) return
      if (!this.paused) await video.play()
      if (generation !== this.generation) return
      if (this.paused) video.pause()
      this.phase = 'playing'
      video.style.opacity = '1'
      this.onChange()
    } catch (error) {
      if (generation !== this.generation || pending.signal.aborted) return
      // Pausing (including hiding the tab) can interrupt an in-flight play().
      // Keep the prepared first frame resumable rather than stuck in loading.
      if (error.name === 'AbortError') {
        this.phase = 'playing'
        video.style.opacity = '1'
        this.onChange()
        return
      }
      this.phase = error.name === 'NotAllowedError' ? 'ready' : 'error'
      this.paused = true
      this.onChange()
    }
  }

  async resume() {
    this.paused = false
    if (this.phase === 'ready') return this.start()
    if (this.phase === 'playing') {
      try { await this.video.play() }
      catch { this.paused = true }
    }
    this.onChange()
  }

  pause() {
    this.paused = true
    this.video.pause()
    this.onChange()
  }

  advance(seconds, finishTime) {
    if (this.paused) return
    if (this.phase === 'playing' && !this.video.seeking) {
      this.time = this.video.currentTime
      if (this.video.ended) this.phase = 'tail'
    } else if (this.phase === 'tail') {
      this.time += seconds
      if (this.time >= finishTime) {
        this.phase = 'fading'
        this.fadeElapsed = 0
        this.video.style.opacity = '0'
      }
    } else if (this.phase === 'fading') {
      this.fadeElapsed += seconds
      if (this.fadeElapsed >= 0.28) void this.start()
    }
  }

  stop() {
    ++this.generation
    this.pending?.abort()
    this.video.pause()
    this.video.style.opacity = '0'
    this.phase = 'still'
    this.time = 0
    this.onReset()
    this.onChange()
  }
}
