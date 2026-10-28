import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import Icon from '../Icon'
import { resolvedTheme } from '../../lib/theme'
import './rde-header.css'

function subscribeTheme(notify: () => void) {
  const observer = new MutationObserver(notify)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  const scheme = window.matchMedia('(prefers-color-scheme: dark)')
  scheme.addEventListener('change', notify)
  return () => { observer.disconnect(); scheme.removeEventListener('change', notify) }
}

const motionQuery = '(prefers-reduced-motion: reduce)'
function subscribeMotion(notify: () => void) {
  const motion = window.matchMedia(motionQuery)
  motion.addEventListener('change', notify)
  return () => motion.removeEventListener('change', notify)
}
const reducedMotion = () => window.matchMedia(motionQuery).matches

interface Props { description: string; meta?: ReactNode; tabs: ReactNode }

export default function RdeHeader({ description, meta, tabs }: Props) {
  const theme = useSyncExternalStore(subscribeTheme, resolvedTheme, () => 'light')
  const reduce = useSyncExternalStore(subscribeMotion, reducedMotion, () => true)
  const [motionRequested, setMotionRequested] = useState(false)
  const [userPaused, setUserPaused] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [failed, setFailed] = useState(false)
  const video = useRef<HTMLVideoElement>(null)
  const animate = !reduce || motionRequested
  const media = `${import.meta.env.BASE_URL}banner/rde-test6-${theme}`
  const source = animate ? `${media}.mp4?v=1` : undefined

  useEffect(() => {
    const element = video.current
    if (!element) return
    const sync = () => {
      if (document.hidden || !animate || userPaused) element.pause()
      else void element.play().catch(() => { /* The visible Play button retries autoplay. */ })
    }
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => { document.removeEventListener('visibilitychange', sync); element.pause() }
  }, [source, animate, userPaused])

  const toggle = () => {
    if (playing) { setUserPaused(true); video.current?.pause() }
    else {
      setMotionRequested(true)
      setUserPaused(false)
      void video.current?.play().catch(() => { /* A new source starts through the effect. */ })
    }
  }

  return <header className="rde-header">
    <div className="rde-header-stage">
      <div className="rde-header-media" aria-hidden="true">
        <img src={`${media}.png?v=1`} alt="" />
        <video ref={video} src={source} poster={`${media}.png?v=1`} muted playsInline loop preload={animate ? 'auto' : 'none'}
          hidden={!animate || failed} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
          onLoadStart={() => setFailed(false)} onError={() => { setPlaying(false); setFailed(true) }} />
      </div>
      <div className="container-x relative">
        <div className="rde-header-inner">
          <div>
            <h1 className="text-[28px] md:text-[34px] font-semibold leading-[1.12] max-w-[22ch]">Rotating detonation engines</h1>
            <p className="mt-3 text-[14px] md:text-[15px] text-ink-2 leading-relaxed max-w-[58ch]">{description}</p>
            {meta && <div className="mt-4 text-[12.5px] md:text-[13px] text-ink-2">{meta}</div>}
          </div>
        </div>
      </div>
      <div className="rde-header-caption">
        <button type="button" className="btn btn-ghost btn-sm w-[28px] px-0" onClick={toggle}
          aria-label={playing ? 'Pause RDE video' : 'Play RDE video'} title={playing ? 'Pause' : 'Play'}>
          <Icon name={playing ? 'pause' : 'play'} size={13} />
        </button>
        <span>RDE · Test 6.1</span>
      </div>
    </div>
    <div className="rde-header-tabs"><div className="container-x">{tabs}</div></div>
  </header>
}
