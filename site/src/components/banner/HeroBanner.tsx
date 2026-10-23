import { useEffect, useRef, useState, type ReactNode } from 'react'
import Icon from '../Icon'
import { BannerPlayback } from './playback'
import { CLIP, FoilDrawing, TRACE_LIFETIME } from './drawing'
import { resolvedTheme } from '../../lib/theme'

const CAPTION = '2H₂ + O₂ + 12Ar, 15 kPa · schlieren · 2 000 000 fps · Shimadzu'
/** Seconds the footage stays after its front has left it, and how long it takes to fade. */
const CLIP_LINGER = 0.4
const CLIP_FADE = 1.5

interface Props {
  children: ReactNode
}

/**
 * The landing-page banner: the schlieren clip of a detonation on the right,
 * drawn transverse waves that continue its front across the left, and the
 * page's own text on top. One version of the clip per theme, so the footage
 * and the band share a background. Honours reduced motion and hidden tabs.
 */
export default function HeroBanner({ children }: Props) {
  const bandRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const clipRef = useRef<HTMLDivElement>(null)
  const stillRef = useRef<HTMLImageElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const toggleRef = useRef<() => void>(() => {})
  // What the one control offers: play, pause, or nothing while loading.
  const [control, setControl] = useState<'play' | 'pause' | 'none'>('none')

  useEffect(() => {
    const band = bandRef.current, canvas = canvasRef.current, clipbox = clipRef.current
    const still = stillRef.current, video = videoRef.current
    if (!band || !canvas || !clipbox || !still || !video) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const base = import.meta.env.BASE_URL
    const drawing = new FoilDrawing()
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const scheme = window.matchMedia('(prefers-color-scheme: dark)')
    let reducedMotion = motion.matches
    let raf = 0
    let lastFrame = performance.now()
    let resumeAfterVisibility = false

    const player = new BannerPlayback(video, {
      onReset: () => { drawing.reset(); video.style.transitionDuration = '' },
      onChange: () => syncControl(),
    })

    function syncControl() {
      if (reducedMotion || player.phase === 'ready' || player.paused) setControl('play')
      else if (player.phase === 'playing' || player.phase === 'tail' || player.phase === 'fading') setControl('pause')
      else setControl('none')
    }

    function layout() {
      const rect = band!.getBoundingClientRect()
      const clipRect = clipbox!.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas!.width = Math.round(rect.width * dpr)
      canvas!.height = Math.round(rect.height * dpr)
      drawing.layout(rect, clipRect, dpr)
    }

    function setAppearance() {
      const theme = resolvedTheme()
      const styles = getComputedStyle(band!)
      drawing.setColours(styles.getPropertyValue('--ink'), styles.getPropertyValue('--mark'))
      const poster = `${base}banner/${CLIP.asset}-${theme}.png`
      video!.poster = poster
      still!.src = poster
      still!.hidden = !reducedMotion
      if (reducedMotion) player.stop()
      else void player.start(`${base}banner/${CLIP.asset}-${theme}.mp4`)
    }

    function tick(now: number) {
      const seconds = Math.min(0.1, Math.max(0, (now - lastFrame) / 1000))
      lastFrame = now
      if (!document.hidden && !reducedMotion) {
        player.advance(seconds, Math.max(CLIP.duration, drawing.leaveTime() + TRACE_LIFETIME))
        if (player.phase === 'playing' || player.phase === 'tail') {
          drawing.advance(player.time)
          // Once the front has left the footage, let the footage go: the drawn
          // waves carry the motion from here.
          if (player.time > drawing.clipExitTime() + CLIP_LINGER && video!.style.opacity !== '0') {
            video!.style.transitionDuration = `${CLIP_FADE}s`
            video!.style.opacity = '0'
          }
        }
        drawing.draw(ctx!)
      }
      raf = requestAnimationFrame(tick)
    }

    toggleRef.current = () => {
      if (reducedMotion) { reducedMotion = false; player.paused = false; setAppearance() }
      else if (player.paused) void player.resume()
      else player.pause()
    }

    const onVisibility = () => {
      if (document.hidden) {
        resumeAfterVisibility = !player.paused && !reducedMotion
        player.pause()
      } else {
        lastFrame = performance.now()
        if (resumeAfterVisibility) void player.resume()
      }
    }
    const onMotion = (e: MediaQueryListEvent) => { reducedMotion = e.matches; setAppearance() }
    const onTheme = () => setAppearance()

    const resize = new ResizeObserver(layout)
    resize.observe(band)
    const themeAttr = new MutationObserver(onTheme)
    themeAttr.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    scheme.addEventListener('change', onTheme)
    motion.addEventListener('change', onMotion)
    document.addEventListener('visibilitychange', onVisibility)

    layout()
    // Start on the next frame: the layout above has to settle first.
    raf = requestAnimationFrame(now => { setAppearance(); tick(now) })

    return () => {
      cancelAnimationFrame(raf)
      resize.disconnect()
      themeAttr.disconnect()
      scheme.removeEventListener('change', onTheme)
      motion.removeEventListener('change', onMotion)
      document.removeEventListener('visibilitychange', onVisibility)
      player.stop()
      video.removeAttribute('src')
      video.load()
    }
  }, [])

  return (
    <section ref={bandRef} className="banner">
      <canvas ref={canvasRef} className="banner-canvas" aria-hidden="true" />
      <div ref={clipRef} className="banner-clip">
        <img ref={stillRef} alt="Schlieren image of the centered transverse-wave collision in test04" hidden />
        <video ref={videoRef} muted playsInline preload="auto" aria-hidden="true" />
      </div>
      <div className="container-x relative">
        <div className="banner-inner py-14 md:py-20">{children}</div>
      </div>
      <div className="banner-foot">
        {control !== 'none' && (
          <button
            type="button"
            onClick={() => toggleRef.current()}
            className="btn btn-ghost btn-sm w-[28px] px-0"
            aria-label={control === 'play' ? 'Play the banner animation' : 'Pause the banner animation'}
            title={control === 'play' ? 'Play' : 'Pause'}
          >
            <Icon name={control === 'play' ? 'play' : 'pause'} size={13} />
          </button>
        )}
        <span className="banner-cap">{CAPTION}</span>
      </div>
    </section>
  )
}
