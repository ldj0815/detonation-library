import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { DEFAULT_BANNER_SETTINGS, parseBannerSettings, type BannerSettings } from '../components/banner/settings'
import type { BannerTimeline } from '../components/banner/HeroBanner'
import CropPicker from '../components/banner/CropPicker'
import { CLIP } from '../components/banner/clip'
import { resolvedTheme } from '../lib/theme'
import './banner-editor.css'

const DRAFT_KEY = 'detonation-banner-editor-v1'
type Group = 'video' | 'animation' | 'layout'
function readDraft() {
  try { const value = localStorage.getItem(DRAFT_KEY); if (value) return parseBannerSettings(JSON.parse(value)) } catch { /* use project settings */ }
  return DEFAULT_BANNER_SETTINGS
}
function Numeric({ label, id, value, min, max, step = 1, unit = '', onChange }: {
  label: string; id: string; value: number; min: number; max: number; step?: number; unit?: string; onChange(value: number): void
}) {
  return <div className="be-field">
    <div className="be-field-top"><label htmlFor={id}>{label}</label><div><input aria-label={`${label} value`} type="number" value={Math.round(value * 100) / 100} min={min} max={max} step={step}
      onChange={e => { if (e.target.value !== '') onChange(Number(e.target.value)) }} /><span>{unit}</span></div></div>
    <input id={id} type="range" value={value} min={min} max={max} step={step} onChange={e => onChange(Number(e.target.value))} />
  </div>
}

export default function BannerEditor() {
  const [draft, setDraft] = useState(readDraft)
  const draftRef = useRef(draft)
  const [saved, setSaved] = useState(DEFAULT_BANNER_SETTINGS)
  const [theme, setTheme] = useState<'light' | 'dark'>(resolvedTheme)
  const [showText, setShowText] = useState(true)
  const [viewport, setViewport] = useState(1280)
  const [stageWidth, setStageWidth] = useState(900)
  const [previewHeight, setPreviewHeight] = useState(520)
  const [timeline, setTimeline] = useState<BannerTimeline>({ time: 0, finish: 18, mediaDuration: CLIP.duration, paused: false, phase: 'loading' })
  const clock = useRef({ time: 0, finish: 18 })
  const sequence = useRef(0)
  const [message, setMessage] = useState('Your draft is saved in this browser. Save to project when ready.')
  const [error, setError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [token, setToken] = useState('')
  const [, redrawHistory] = useState(0)
  const history = useRef<{ past: BannerSettings[]; future: BannerSettings[]; last: number; key: string }>({ past: [], future: [], last: 0, key: '' })
  const iframe = useRef<HTMLIFrameElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const importInput = useRef<HTMLInputElement>(null)
  const themeRef = useRef(theme), textRef = useRef(showText)
  const send = (data: unknown) => iframe.current?.contentWindow?.postMessage(data, location.origin)
  const syncPreview = () => send({ type: 'banner-settings', settings: draftRef.current, theme: themeRef.current, showText: textRef.current })
  const command = (name: string, time?: number) => {
    if (name === 'seek' || name === 'restart') sequence.current++
    if (name === 'restart') clock.current.time = 0
    send({ type: 'banner-command', command: name, time, commandId: sequence.current })
  }
  const seek = (time: number) => {
    const value = Math.min(clock.current.finish, Math.max(0, time))
    clock.current.time = value
    setTimeline(previous => ({ ...previous, time: value, paused: true }))
    command('seek', value)
  }

  function change(value: BannerSettings, separate = false) {
    try {
      const next = parseBannerSettings(value), h = history.current, now = performance.now()
      if (JSON.stringify(next) === JSON.stringify(draftRef.current)) return
      const key = (['video', 'animation', 'layout'] as const).flatMap(group => Object.keys(next[group]).filter(k =>
        (next[group] as unknown as Record<string, unknown>)[k] !== (draftRef.current[group] as unknown as Record<string, unknown>)[k]).map(k => `${group}.${k}`)).join(',')
      if (separate || key !== h.key || now - h.last > 400) h.past = [...h.past.slice(-79), draftRef.current]
      h.last = now; h.key = key; h.future = []
      draftRef.current = next; setDraft(next); redrawHistory(n => n + 1); setError(false)
      setMessage('Draft updated. Save to project when ready.')
    } catch (e) { setError(true); setMessage(e instanceof Error ? e.message : 'Could not update settings.') }
  }
  function undo(redo = false) {
    const h = history.current, source = redo ? h.future : h.past, previous = source.pop()
    if (!previous) return
    ;(redo ? h.past : h.future).push(draftRef.current)
    h.last = 0; draftRef.current = previous; setDraft(previous); redrawHistory(n => n + 1)
  }
  const tweak = (group: Group, key: string, value: number | string | boolean) => change({ ...draftRef.current, [group]: { ...draftRef.current[group], [key]: value } })
  const field = (group: Group, key: string, label: string, min: number, max: number, step = 1, unit = '') => <Numeric key={`${group}-${key}`} id={`be-${group}-${key}`} label={label}
    value={(draft[group] as unknown as Record<string, number>)[key]} min={min} max={max} step={step} unit={unit} onChange={value => tweak(group, key, value)} />
  const status = (text: string, failed = false) => { setMessage(text); setError(failed) }

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== iframe.current?.contentWindow) return
      if (event.data?.type === 'banner-ready') { sequence.current = 0; syncPreview() }
      if (event.data?.type === 'banner-timeline') {
        if ((event.data.commandId ?? 0) < sequence.current) return
        clock.current = { time: event.data.time, finish: event.data.finish }
        setTimeline(event.data)
        if (Number.isFinite(event.data.height)) setPreviewHeight(Math.max(240, Math.min(1100, event.data.height)))
      }
    }
    window.addEventListener('message', receive)
    const observer = new ResizeObserver(entries => setStageWidth(Math.floor(entries[0].contentRect.width)))
    if (stage.current) observer.observe(stage.current)
    const controller = new AbortController()
    void fetch(`${import.meta.env.BASE_URL}__banner-editor/status`, { signal: controller.signal }).then(async response => {
      if (!response.ok) return
      const value = await response.json()
      if (typeof value.token === 'string') setToken(value.token)
    }).catch(() => {})
    return () => { controller.abort(); observer.disconnect(); window.removeEventListener('message', receive) }
    // The message listener reads current values through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    themeRef.current = theme; textRef.current = showText
    syncPreview()
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)) } catch { /* download still works */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, theme, showText])

  async function saveProject() {
    setSaving(true)
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}__banner-editor/settings`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Banner-Editor-Token': token }, body: JSON.stringify(draftRef.current),
      })
      const value = await response.json()
      if (!response.ok) throw new Error(value.error || 'Could not save to the project.')
      setSaved(parseBannerSettings(value.settings))
      status('Saved to project. The local homepage now uses these settings. The live site has not changed.')
    } catch (e) { status(e instanceof Error ? e.message : 'Could not save to the project.', true) }
    finally { setSaving(false) }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([`${JSON.stringify(draftRef.current, null, 2)}\n`], { type: 'application/json' }))
    const link = document.createElement('a'); link.href = url; link.download = 'banner-settings.json'; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    status('Settings downloaded. You can import them here later.')
  }
  async function importSettings(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    try { change(parseBannerSettings(JSON.parse(await file.text())), true); status(`Imported ${file.name}. Save to project to apply it.`) }
    catch (e) { status(e instanceof Error ? e.message : 'Could not read this settings file.', true) }
    event.target.value = ''
  }
  function preset(name: string) {
    const crop = name === 'full' ? { cropX: 0, cropY: 0, cropWidth: 628, cropHeight: 480 }
      : name === 'upper' ? { cropX: 190, cropY: 0, cropWidth: 280, cropHeight: 160 }
        : { cropX: 0, cropY: 160, cropWidth: 628, cropHeight: 160 }
    change({ ...draftRef.current, video: { ...draftRef.current.video, ...crop, zoom: 1 } }, true)
  }
  const scale = Math.min(1, stageWidth / viewport)
  const sourceFrame = Math.min(draft.video.endFrame - 1, draft.video.startFrame + Math.floor(timeline.time * CLIP.fps))
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)
  const videoOnly = draft.layout.videoWidth === 100

  return <div className="banner-editor">
    <header className="be-header">
      <div><Link to="/" className="be-back">← Local website</Link><h1>Banner studio <span>LOCAL</span></h1></div>
      <div className="be-actions">
        <button className="btn btn-secondary" onClick={() => undo()} disabled={!history.current.past.length}>Undo</button>
        <button className="btn btn-secondary" onClick={() => undo(true)} disabled={!history.current.future.length}>Redo</button>
        <button className="btn btn-secondary" onClick={() => change(DEFAULT_BANNER_SETTINGS, true)}>Reset to saved</button>
        <button className="btn btn-primary" disabled={!token || saving || !dirty} onClick={() => void saveProject()}>{saving ? 'Saving…' : dirty ? 'Save to project' : 'Saved to project'}</button>
      </div>
    </header>
    <div className="be-status" role="status" data-error={error}>{message}</div>
    <div className="be-workspace">
      <div className="be-main">
        <section className="be-card">
          <div className="be-card-head"><div><h2>Live banner</h2><p>Changes appear immediately. Pause or scrub to compare a single frame.</p></div>
            <div className="be-switches">
              <button aria-label="Light preview" aria-pressed={theme === 'light'} onClick={() => setTheme('light')}>Light</button><button aria-label="Dark preview" aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>Dark</button>
              <select aria-label="Preview viewport" value={viewport} onChange={e => setViewport(Number(e.target.value))}><option value={1280}>Desktop · 1280</option><option value={390}>Phone · 390</option></select>
            </div>
          </div>
          <div className="be-stage" ref={stage}><div style={{ height: previewHeight * scale, width: viewport * scale, margin: 'auto' }}>
            <iframe ref={iframe} title="Banner live preview" src={`${import.meta.env.BASE_URL}#/banner-preview`} onLoad={syncPreview}
              style={{ width: viewport, height: previewHeight, transform: `scale(${scale})`, transformOrigin: 'top left', border: 0, display: 'block' }} />
          </div></div>
          <div className="be-transport">
            <div className="be-transport-row"><div className="be-play-buttons">
              <button className="btn btn-primary" onClick={() => command('toggle')} disabled={timeline.phase === 'loading'}>{timeline.paused ? 'Play' : 'Pause'}</button>
              <button className="btn btn-secondary" onClick={() => command('restart')}>Restart</button>
              <button className="btn btn-ghost" aria-label="Previous frame" onClick={() => seek(clock.current.time - 1 / CLIP.fps)}>−1 frame</button>
              <button className="btn btn-ghost" aria-label="Next frame" onClick={() => seek(clock.current.time + 1 / CLIP.fps)}>+1 frame</button>
            </div><label className="be-check"><input type="checkbox" checked={showText} onChange={e => setShowText(e.target.checked)} /> Text overlay</label></div>
            <div className="be-scrub"><input aria-label="Preview time" type="range" min="0" max={Math.max(0.1, timeline.finish)} step={1 / CLIP.fps} value={timeline.time} onChange={e => seek(Number(e.target.value))} onKeyDown={e => {
              const t = clock.current.time
              const targets: Record<string, number> = { Home: 0, End: clock.current.finish, ArrowLeft: t - 1 / CLIP.fps, ArrowRight: t + 1 / CLIP.fps, PageUp: t + 1, PageDown: t - 1 }
              if (e.key in targets) { e.preventDefault(); seek(targets[e.key]) }
            }} />
              {!videoOnly && <span style={{ left: `${Math.min(100, timeline.mediaDuration / timeline.finish * 100)}%` }} title="Video ends here; drawn waves continue" />}</div>
            <div className="be-time"><span>{timeline.time.toFixed(2)} s · Frame {sourceFrame}</span><span>{timeline.phase === 'error' ? 'Video could not load. Restart to retry.' : videoOnly ? 'Video only' : timeline.time >= timeline.mediaDuration ? 'Drawn continuation' : 'Video + animation'} · {timeline.finish.toFixed(1)} s loop</span></div>
          </div>
        </section>
        <section className="be-card be-source-card">
          <div><div className="be-card-head"><div><h2>Original recording</h2><p>Drag the frame to move the crop. Drag its lower-right handle to resize.</p></div></div>
            <CropPicker settings={draft} time={timeline.time} onChange={value => change(value)} />
            <div className="be-presets"><button onClick={() => preset('center')}>Center strip</button><button onClick={() => preset('full')}>Full frame</button><button onClick={() => preset('upper')}>Upper collision</button></div>
          </div>
          <div className="be-source-notes"><h3>Your editing workspace</h3><p>The yellow frame shows the selected part of the 628 × 480 recording. The banner takes a centered view into it; zoom and the video share control how much is visible.</p>
            {!videoOnly && <p>Cell dimensions use the recording’s pixels. Larger cells are allowed to extend outside the banner.</p>}
            <p><strong>Save to project</strong> updates the local homepage. Publishing the live website is a separate step.</p>
            <div className="be-file-actions"><button className="btn btn-secondary" onClick={download}>Download settings</button><button className="btn btn-secondary" onClick={() => importInput.current?.click()}>Import settings</button>
              <input ref={importInput} type="file" accept=".json,application/json" hidden onChange={e => void importSettings(e)} /></div>
          </div>
        </section>
      </div>
      <aside className="be-controls" aria-label="Banner controls">
        <label className="be-select">Banner composition<select aria-label="Banner composition" value={videoOnly ? 'video' : 'split'} onChange={e => tweak('layout', 'videoWidth', e.target.value === 'video' ? 100 : 50)}><option value="video">Full-width video</option><option value="split">Animation + video</option></select></label>
        <details open><summary>Video framing</summary><div className="be-detail-body">
          <label className="be-select">Treatment<select aria-label="Treatment" value={draft.video.treatment} onChange={e => tweak('video', 'treatment', e.target.value)}><option value="matched">Theme matched</option><option value="grey">Original grey background</option></select></label>
          {field('video', 'cropX', 'Crop left', 0, 628 - draft.video.cropWidth, 1, 'px')}
          {field('video', 'cropY', 'Crop top', 0, 480 - draft.video.cropHeight, 1, 'px')}
          {field('video', 'cropWidth', 'Crop width', 24, 628 - draft.video.cropX, 1, 'px')}
          {field('video', 'cropHeight', 'Crop height', 24, 480 - draft.video.cropY, 1, 'px')}
          {field('video', 'zoom', 'Video zoom', 0.4, 3, 0.01, '×')}
          {field('video', 'opacity', 'Video opacity', 0, 1, 0.01)}
          {field('video', 'soften', 'Video softening', 0, 3, 0.1, 'px')}
        </div></details>
        {!videoOnly && <><details open><summary>Diamond cell</summary><div className="be-detail-body">
          {field('animation', 'cellWidth', 'Cell width', 40, 2000, 1, 'px')}
          {field('animation', 'cellHeight', 'Cell height', 20, 1400, 1, 'px')}
          {field('animation', 'centerY', 'Cell vertical center', -480, 960, 1, 'px')}
          {field('animation', 'anchorX', 'Cell horizontal phase', -1000, 1600, 1, 'px')}
        </div></details>
        <details open><summary>Transverse waves</summary><div className="be-detail-body">
          {field('animation', 'curvature', 'Wave curvature', -0.7, 0.9, 0.01)}
          {field('animation', 'waveLength', 'Wave tail length', 0.05, 1.5, 0.01)}
          {field('animation', 'waveOpacity', 'Wave opacity', 0, 1, 0.01)}
          {field('animation', 'waveWidth', 'Wave line width', 0.3, 5, 0.1, 'px')}
          <label className="be-check"><input type="checkbox" checked={draft.animation.waveColor === 'auto'} onChange={e => tweak('animation', 'waveColor', e.target.checked ? 'auto' : '#e8edf5')} /> Theme wave colour</label>
          {draft.animation.waveColor !== 'auto' && <input aria-label="Wave colour" type="color" value={draft.animation.waveColor} onChange={e => tweak('animation', 'waveColor', e.target.value)} />}
        </div></details>
        <details open><summary>Traces</summary><div className="be-detail-body">
          {field('animation', 'traceLifetime', 'Trace lifetime', 0, 10, 0.1, 's')}
          {field('animation', 'traceOpacity', 'Trace opacity', 0, 1, 0.01)}
          {field('animation', 'traceWidth', 'Trace line width', 0.3, 5, 0.1, 'px')}
          <label className="be-check"><input type="checkbox" checked={draft.animation.traceColor === 'auto'} onChange={e => tweak('animation', 'traceColor', e.target.checked ? 'auto' : '#ffd200')} /> Theme yellow traces</label>
          {draft.animation.traceColor !== 'auto' && <input aria-label="Trace colour" type="color" value={draft.animation.traceColor} onChange={e => tweak('animation', 'traceColor', e.target.value)} />}
        </div></details>
        </>}
        <details><summary>Playback{!videoOnly && ' & fade'}</summary><div className="be-detail-body">
          {field('video', 'startFrame', 'First frame', 0, draft.video.endFrame - 1)}
          {field('video', 'endFrame', 'End frame (exclusive)', draft.video.startFrame + 1, 249)}
          {field('video', 'rate', 'Playback speed', 0.25, 2, 0.05, '×')}
          {!videoOnly && <><label className="be-check"><input type="checkbox" checked={draft.video.fade} onChange={e => tweak('video', 'fade', e.target.checked)} /> Fade video after handoff</label>
          {field('video', 'linger', 'Video linger', 0, 5, 0.1, 's')}
          {field('video', 'fadeDuration', 'Video fade duration', 0, 5, 0.1, 's')}</>}
        </div></details>
        <details><summary>Layout & blend</summary><div className="be-detail-body">
          {!videoOnly && <>{field('layout', 'videoWidth', 'Video share', 15, 99, 1, '%')}
          {field('layout', 'feather', 'Horizontal blend', 0, 40, 0.5, '%')}</>}
          {field('layout', 'verticalFeather', 'Top and bottom blend', 0, 30, 0.5, '%')}
          {field('layout', 'height', 'Banner height (0 = auto)', 0, 800, 10, 'px')}
        </div></details>
      </aside>
    </div>
  </div>
}
