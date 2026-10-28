import { useEffect, useImperativeHandle, useRef, useState, type CSSProperties, type ReactNode, type Ref } from 'react'
import Icon from '../Icon'
import { BannerPlayback, type Phase } from './playback'
import { CLIP, FoilDrawing } from './drawing'
import { DEFAULT_BANNER_SETTINGS, type BannerSettings } from './settings'
import { resolvedTheme } from '../../lib/theme'

const CAPTION = '2H₂ + O₂ + 12Ar, 15 kPa · schlieren · 2 000 000 fps · Shimadzu'
export interface BannerTimeline { time: number; finish: number; mediaDuration: number; paused: boolean; phase: Phase }
export interface BannerControls { toggle(): void; restart(): void; seek(time: number): void }
interface Props {
  children: ReactNode
  settings?: BannerSettings
  controls?: Ref<BannerControls>
  onTimeline?: (state: BannerTimeline) => void
  forceMotion?: boolean
}

/** Homepage and editor share this renderer, geometry, media clock and settings. */
export default function HeroBanner({ children, settings = DEFAULT_BANNER_SETTINGS, controls, onTimeline, forceMotion = false }: Props) {
  const bandRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const clipRef = useRef<HTMLDivElement>(null)
  const stillRef = useRef<HTMLImageElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const initial = useRef({ settings, forceMotion })
  const timelineRef = useRef(onTimeline)
  const updateRef = useRef<(next: BannerSettings) => void>(() => {})
  const commands = useRef<BannerControls>({ toggle() {}, restart() {}, seek() {} })
  const [control, setControl] = useState<'play' | 'pause' | 'none'>('none')
  useImperativeHandle(controls, () => ({
    toggle: () => commands.current.toggle(), restart: () => commands.current.restart(), seek: time => commands.current.seek(time),
  }), [])
  useEffect(() => { timelineRef.current = onTimeline }, [onTimeline])

  useEffect(() => {
    const band = bandRef.current, canvas = canvasRef.current, clipbox = clipRef.current
    const still = stillRef.current, video = videoRef.current
    if (!band || !canvas || !clipbox || !still || !video) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let current = initial.current.settings
    const base = import.meta.env.BASE_URL
    const drawing = new FoilDrawing()
    drawing.configure(current)
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const scheme = window.matchMedia('(prefers-color-scheme: dark)')
    let reducedMotion = !initial.current.forceMotion && motion.matches
    let raf = 0, lastFrame = performance.now(), lastReport = 0
    let resumeAfterVisibility = false
    const range = () => ({ from: current.video.startFrame / CLIP.fps, to: current.video.endFrame / CLIP.fps, rate: current.video.rate })
    const player = new BannerPlayback(video, {
      onReset: () => drawing.reset(),
      onChange: () => syncControl(),
    }, range())
    const videoOnly = () => current.layout.videoWidth === 100
    const finishTime = () => videoOnly() ? player.duration : Math.max(player.duration, drawing.leaveTime() + current.animation.traceLifetime)

    function syncControl() {
      if (reducedMotion || player.phase === 'ready' || player.phase === 'error' || player.paused) setControl('play')
      else if (['playing', 'tail', 'fading'].includes(player.phase)) setControl('pause')
      else setControl('none')
    }
    function colours() {
      const styles = getComputedStyle(band!)
      const a = current.animation
      drawing.setColours(a.waveColor === 'auto' ? styles.getPropertyValue('--ink') : a.waveColor,
        a.traceColor === 'auto' ? styles.getPropertyValue('--mark') : a.traceColor)
    }
    function layout() {
      const rect = band!.getBoundingClientRect(), clipRect = clipbox!.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas!.width = Math.round(rect.width * dpr)
      canvas!.height = Math.round(rect.height * dpr)
      drawing.layout(rect, clipRect, dpr)
      const g = drawing.geometry
      for (const media of [video!, still!]) {
        Object.assign(media.style, {
          width: `${CLIP.w * g.scale}px`, height: `${CLIP.h * g.scale}px`,
          left: `${g.videoOrigin - g.videoLeft}px`, top: `${g.videoOriginY - (clipRect.top - rect.top)}px`,
          objectFit: 'fill', filter: `blur(${current.video.soften}px)`,
        })
      }
      still!.style.opacity = String(current.video.opacity)
      const h = videoOnly() ? 0 : current.layout.feather, v = current.layout.verticalFeather
      const mask = `linear-gradient(90deg, transparent 0%, #000 ${h}%, #000 100%), linear-gradient(180deg, transparent 0%, #000 ${v}%, #000 ${100 - v}%, transparent 100%)`
      clipbox!.style.maskImage = mask
      clipbox!.style.webkitMaskImage = mask
      if (!videoOnly()) {
        drawing.advance(player.time)
        drawing.draw(ctx!)
      }
    }
    function setAppearance() {
      colours()
      const treatment = current.video.treatment === 'grey' ? 'grey' : resolvedTheme()
      const source = `${base}banner/${CLIP.asset}-${treatment}`
      video!.poster = `${source}.png?v=${CLIP.revision}`
      still!.src = `${source}.png?v=${CLIP.revision}`
      still!.hidden = !reducedMotion
      if (reducedMotion) player.stop()
      else void player.start(`${source}.mp4?v=${CLIP.revision}`)
    }
    function tick(now: number) {
      const seconds = Math.min(0.1, Math.max(0, (now - lastFrame) / 1000))
      lastFrame = now
      if (!document.hidden && !reducedMotion) {
        player.advance(seconds, finishTime())
        if (player.phase === 'playing' || player.phase === 'tail') {
          if (!videoOnly()) drawing.advance(player.time)
          const v = current.video
          const elapsed = player.time - drawing.clipExitTime() - v.linger
          const fade = videoOnly() || !v.fade || elapsed <= 0 ? 1 : v.fadeDuration === 0 ? 0 : Math.max(0, 1 - elapsed / v.fadeDuration)
          video!.style.opacity = String(v.opacity * fade)
        }
        if (!videoOnly()) drawing.draw(ctx!)
      }
      if (now - lastReport > 90) {
        lastReport = now
        timelineRef.current?.({ time: player.time, finish: finishTime(), mediaDuration: player.duration, paused: player.paused, phase: player.phase })
      }
      raf = requestAnimationFrame(tick)
    }
    commands.current = {
      toggle() {
        if (reducedMotion) { reducedMotion = false; player.paused = false; setAppearance() }
        else if (player.paused) void player.resume()
        else player.pause()
      },
      restart() { reducedMotion = false; player.paused = false; void player.start() },
      seek(time) { reducedMotion = false; still!.hidden = true; player.pause(); void player.seek(Math.min(finishTime(), time)) },
    }
    updateRef.current = next => {
      if (next === current) return
      const sourceChanged = next.video.treatment !== current.video.treatment
      current = next
      drawing.configure(next)
      colours()
      layout()
      void player.configure(range())
      if (sourceChanged) setAppearance()
    }
    const onVisibility = () => {
      if (document.hidden) { resumeAfterVisibility = !player.paused && !reducedMotion; player.pause() }
      else { lastFrame = performance.now(); if (resumeAfterVisibility) void player.resume() }
    }
    const onMotion = (e: MediaQueryListEvent) => {
      if (initial.current.forceMotion) return
      reducedMotion = e.matches; setAppearance()
    }
    const resize = new ResizeObserver(layout)
    resize.observe(band)
    const themeAttr = new MutationObserver(setAppearance)
    themeAttr.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    scheme.addEventListener('change', setAppearance)
    motion.addEventListener('change', onMotion)
    document.addEventListener('visibilitychange', onVisibility)
    video.style.transition = 'none'
    layout()
    raf = requestAnimationFrame(now => { setAppearance(); tick(now) })
    return () => {
      cancelAnimationFrame(raf); resize.disconnect(); themeAttr.disconnect()
      scheme.removeEventListener('change', setAppearance); motion.removeEventListener('change', onMotion)
      document.removeEventListener('visibilitychange', onVisibility)
      updateRef.current = () => {}
      player.stop(); video.removeAttribute('src'); video.load()
    }
  }, [])
  useEffect(() => updateRef.current(settings), [settings])

  return (
    <section ref={bandRef} className={`banner${settings.layout.videoWidth === 100 ? ' banner-video-only' : ''}`} style={{ '--banner-video-width': `${settings.layout.videoWidth}%`, height: settings.layout.height || undefined } as CSSProperties}>
      <canvas ref={canvasRef} className="banner-canvas" hidden={settings.layout.videoWidth === 100} aria-hidden="true" />
      <div ref={clipRef} className="banner-clip">
        <img ref={stillRef} alt="Schlieren image from the test04 recording" hidden />
        <video ref={videoRef} muted playsInline preload="auto" aria-hidden="true" />
      </div>
      <div className="container-x relative"><div className="banner-inner py-14 md:py-20">{children}</div></div>
      <div className="banner-foot">
        {control !== 'none' && <button type="button" onClick={() => commands.current.toggle()} className="btn btn-ghost btn-sm w-[28px] px-0"
          aria-label={control === 'play' ? 'Play the banner animation' : 'Pause the banner animation'} title={control === 'play' ? 'Play' : 'Pause'}>
          <Icon name={control === 'play' ? 'play' : 'pause'} size={13} />
        </button>}
        <span className="banner-cap">{CAPTION}</span>
      </div>
    </section>
  )
}
