import { useEffect, useRef, useState } from 'react'
import HeroBanner, { type BannerControls } from '../components/banner/HeroBanner'
import HomeHeroContent from '../components/banner/HomeHeroContent'
import { DEFAULT_BANNER_SETTINGS, parseBannerSettings } from '../components/banner/settings'
import { applyTheme } from '../lib/theme'

/** Same-origin preview has its own viewport, so mobile and desktop are accurate. */
export default function BannerPreview() {
  const [settings, setSettings] = useState(DEFAULT_BANNER_SETTINGS)
  const [showText, setShowText] = useState(true)
  const controls = useRef<BannerControls>(null)
  const commandId = useRef(0)
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== window.parent) return
      const message = event.data
      if (message?.type === 'banner-settings') {
        try { setSettings(parseBannerSettings(message.settings)) } catch { return }
        setShowText(message.showText !== false)
        if ((message.theme === 'dark' || message.theme === 'light') && document.documentElement.getAttribute('data-theme') !== message.theme) applyTheme(message.theme)
      } else if (message?.type === 'banner-command') {
        if (typeof message.commandId === 'number') commandId.current = message.commandId
        if (message.command === 'seek' && typeof message.time === 'number' && Number.isFinite(message.time)) controls.current?.seek(message.time)
        if (message.command === 'toggle') controls.current?.toggle()
        if (message.command === 'restart') controls.current?.restart()
      }
    }
    window.addEventListener('message', receive)
    window.parent.postMessage({ type: 'banner-ready' }, location.origin)
    return () => window.removeEventListener('message', receive)
  }, [])
  return <>
    <div style={{ padding: '14px 24px', background: 'var(--surface)', borderBottom: '1px solid var(--line)', fontWeight: 600 }}>◈ &nbsp; Detonation Science and Technology Library</div>
    <HeroBanner settings={settings} controls={controls} forceMotion onTimeline={timeline => {
      window.parent.postMessage({ type: 'banner-timeline', ...timeline, commandId: commandId.current, height: Math.ceil(document.querySelector('.banner')?.getBoundingClientRect().bottom ?? 520) }, location.origin)
    }}><div style={{ visibility: showText ? 'visible' : 'hidden' }}><HomeHeroContent preview /></div></HeroBanner>
  </>
}
