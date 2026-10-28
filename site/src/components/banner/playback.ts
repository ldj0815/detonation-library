// Playback of the banner clip. The media clock owns the hand-over from the
// footage to the drawing; rewinds finish while the video is hidden, so a loop
// never shows a jump. Ported from animation/banner/playback.js.

export type Phase = 'idle' | 'loading' | 'playing' | 'tail' | 'fading' | 'ready' | 'error' | 'still'

/** The parts of a video element the player uses. Tests pass a fake. */
export interface MediaLike extends EventTarget {
  readyState: number
  ended: boolean
  seeking: boolean
  error: unknown
  currentTime: number
  playbackRate: number
  src: string
  style: { opacity: string }
  load(): void
  play(): Promise<void>
  pause(): void
}

export interface PlaybackCallbacks {
  /** The drawing starts over: a new clip, a rewind, or a stop. */
  onReset?: () => void
  /** The phase or the paused flag changed. */
  onChange?: () => void
}

export interface PlaybackRange { from: number; to: number; rate: number }

export class BannerPlayback {
  readonly video: MediaLike
  phase: Phase = 'idle'
  /** Clip seconds; keeps counting after the footage ends. */
  time = 0
  paused = false
  private readonly onReset: () => void
  private readonly onChange: () => void
  private fadeElapsed = 0
  private generation = 0
  private pending: AbortController | null = null
  private range: PlaybackRange

  constructor(video: MediaLike, { onReset = () => {}, onChange = () => {} }: PlaybackCallbacks = {}, range: PlaybackRange = { from: 0, to: Infinity, rate: 1 }) {
    this.video = video
    this.onReset = onReset
    this.onChange = onChange
    this.range = range
  }

  get duration() { return this.range.to - this.range.from }

  configure(range: PlaybackRange) {
    const changed = range.from !== this.range.from || range.to !== this.range.to
    this.range = range
    this.video.playbackRate = range.rate
    if (changed) return this.seek(this.time)
    return Promise.resolve()
  }

  /** Seek the shared video/drawing clock, including its drawn continuation. */
  seek(time: number) { return this.prepare(undefined, Math.max(0, time)) }

  private waitFor(events: string[], ready: () => boolean, signal: AbortSignal): Promise<void> {
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

  /** Load `source` (or keep the current one), rewind, and play from the start. */
  start(source?: string): Promise<void> { return this.prepare(source, 0) }

  private async prepare(source: string | undefined, time: number): Promise<void> {
    this.pending?.abort()
    const pending = new AbortController()
    this.pending = pending
    const generation = ++this.generation
    const video = this.video
    video.pause()
    video.style.opacity = '0'
    video.playbackRate = this.range.rate
    this.phase = 'loading'
    this.time = time
    this.onReset()
    this.onChange()
    try {
      if (source !== undefined) {
        video.src = source
        video.load()
      } else if (video.error) video.load()
      await this.waitFor(['loadeddata', 'canplay'], () => video.readyState >= 2, pending.signal)
      const target = Math.min(this.range.from + time, this.range.to)
      if (Math.abs(video.currentTime - target) > 0.001 || video.ended || video.seeking) {
        // Register before assigning currentTime, including fast cached seeks.
        const rewound = this.waitFor(
          ['seeked', 'loadeddata', 'canplay'],
          () => !video.seeking && Math.abs(video.currentTime - target) < 0.02 && video.readyState >= 2,
          pending.signal,
        )
        video.currentTime = target
        await rewound
      }
      if (generation !== this.generation) return
      const tail = time >= this.duration
      if (!this.paused && !tail) await video.play()
      if (generation !== this.generation) return
      if (this.paused) video.pause()
      this.phase = tail ? 'tail' : 'playing'
      video.style.opacity = '1'
      this.onChange()
    } catch (err) {
      if (generation !== this.generation || pending.signal.aborted) return
      const name = (err as { name?: string }).name
      // Pausing (including hiding the tab) can interrupt an in-flight play().
      // Keep the prepared first frame resumable rather than stuck in loading.
      if (name === 'AbortError') {
        this.phase = 'playing'
        video.style.opacity = '1'
        this.onChange()
        return
      }
      this.phase = name === 'NotAllowedError' ? 'ready' : 'error'
      this.paused = true
      this.onChange()
    }
  }

  async resume(): Promise<void> {
    this.paused = false
    if (this.phase === 'ready' || this.phase === 'error') return this.start()
    if (this.phase === 'playing') {
      try { await this.video.play() } catch { this.paused = true }
    }
    this.onChange()
  }

  pause() {
    this.paused = true
    this.video.pause()
    this.onChange()
  }

  /** Advance the clock by `seconds` of wall time; `finishTime` is when the loop restarts. */
  advance(seconds: number, finishTime: number) {
    if (this.paused) return
    if (this.phase === 'playing' && !this.video.seeking) {
      this.time = Math.max(0, this.video.currentTime - this.range.from)
      if (this.video.ended || this.video.currentTime >= this.range.to - 0.001) {
        this.video.pause()
        this.time = Math.min(this.time, this.duration)
        this.phase = 'tail'
      }
    } else if (this.phase === 'tail') {
      this.time += seconds * this.range.rate
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

  /** Stop for good (reduced motion, unmount): cancels a pending load. */
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
