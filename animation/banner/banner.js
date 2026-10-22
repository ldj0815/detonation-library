import { BannerPlayback } from './playback.js'

const CLIP = { w: 292, h: 200, fps: 15, x0: 328.5784, v: -2.937155, duration: 12.6 }
const FEATHER = 0.08
const TRACE_LIFETIME = 2
const MARGIN = 40
const site = document.getElementById('site')
const band = document.getElementById('band')
const canvas = document.getElementById('foil')
const video = document.getElementById('clip')
const still = document.getElementById('still')
const ctx = canvas.getContext('2d')
const status = document.getElementById('status')
const pauseButton = document.getElementById('pause')
const params = new URLSearchParams(location.search)
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)')
let reducedMotion = motionPreference.matches
let theme = params.get('theme') === 'light' ? 'light' : 'dark'
let treatment = params.get('treatment') === 'grey' ? 'grey' : 'matched'
let traceRGB = '244,207,53'
let cellFrac = 0.3
let W = 0, H = 0, dpr = 1, scale = 1, vw = 0, videoLeft = 0, videoOrigin = 0, speed = 1
let frontX = Infinity, previousX = Infinity, simulationTime = 0
let points = [], segments = [], flashes = []
let seed = 11
let resumeAfterVisibility = false
let lastFrame = performance.now()

function random() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }

function seedPoints() {
  const width = Math.max(60, H * cellFrac)
  const count = Math.max(2, Math.round(H / width))
  seed = 11
  points = []
  for (let i = 0; i < count; i++) {
    const y = H * (i + 0.5) / count + (random() - 0.5) * 0.3 * width
    const y2 = y + H / (2 * count) + (random() - 0.5) * 0.3 * width
    for (const [position, dir, family] of [[y, 1, 0], [y2, -1, 1]]) {
      const clamped = Math.max(1, Math.min(H - 1, position))
      points.push({ y: clamped, py: clamped, dir, family, energy: 0.4 + 0.6 * random(), k: 0.9 + 0.2 * random() })
    }
  }
}

function resetDrawing() {
  frontX = previousX = Infinity
  simulationTime = 0
  segments = []; flashes = []
  seedPoints()
  ctx.clearRect(0, 0, canvas.width, canvas.height)
}

function updateControls() {
  pauseButton.textContent = reducedMotion ? 'Play animation' : player.paused ? 'Play' : 'Pause'
  pauseButton.setAttribute('aria-pressed', String(!reducedMotion && !player.paused))
  document.querySelectorAll('[data-t]').forEach(button => {
    const selected = button.dataset.t === theme
    button.classList.toggle('on', selected)
    button.setAttribute('aria-pressed', String(selected))
  })
  document.querySelectorAll('[data-treatment]').forEach(button => {
    const selected = button.dataset.treatment === treatment
    button.classList.toggle('on', selected)
    button.setAttribute('aria-pressed', String(selected))
  })
}

const player = new BannerPlayback(video, { onReset: resetDrawing, onChange: updateControls })
video.muted = true

function layout() {
  const rect = band.getBoundingClientRect()
  W = rect.width; H = rect.height
  dpr = Math.min(2, window.devicePixelRatio || 1)
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr)
  // Each visual occupies half the band. Match the video's object-fit: cover crop.
  const clipRect = document.querySelector('.clipbox').getBoundingClientRect()
  vw = clipRect.width
  scale = Math.max(clipRect.height / CLIP.h, vw / CLIP.w)
  videoLeft = clipRect.left - rect.left
  videoOrigin = videoLeft - (CLIP.w * scale - vw) / 2
  speed = Math.abs(CLIP.v) * CLIP.fps * scale
  resetDrawing()
}

function setAppearance() {
  site.dataset.theme = theme
  site.dataset.treatment = treatment
  const traceHex = getComputedStyle(site).getPropertyValue('--mark').trim().slice(1)
  traceRGB = [0, 2, 4].map(index => parseInt(traceHex.slice(index, index + 2), 16)).join(',')
  const name = treatment === 'grey' ? 'grey' : theme
  const poster = `media/poster-${name}.png`
  video.poster = poster
  still.src = poster
  still.hidden = !reducedMotion
  params.set('theme', theme)
  params.set('treatment', treatment)
  history.replaceState(null, '', `?${params}`)
  if (reducedMotion) player.stop()
  else void player.start(`media/clip-${name}.mp4`)
  updateControls()
}

function stepPoints(x, time) {
  const width = Math.max(60, H * cellFrac), length = width * 1.7
  const dx = previousX - x
  for (const p of points) {
    p.py = p.y
    p.y += p.dir * dx / 1.7 * p.k * (0.55 + 0.6 * p.energy)
    p.energy *= Math.exp(-dx / (0.45 * length))
    if (p.y < 0) { p.y = -p.y; p.dir = 1; p.energy = 1 }
    if (p.y > H) { p.y = 2 * H - p.y; p.dir = -1; p.energy = 1 }
    segments.push({ x1: previousX, y1: p.py, x2: x, y2: p.y, time, energy: p.energy })
  }
  for (const a of points) if (a.family === 0) for (const b of points) if (b.family === 1) {
    if ((a.py - b.py) * (a.y - b.y) < 0 && Math.abs(a.py - b.py) < width) {
      flashes.push({ x, y: (a.y + b.y) / 2, time })
      a.energy = b.energy = 1
    }
  }
  previousX = x
}

function advanceDrawing() {
  const time = player.time
  // Fixed spatial substeps keep collisions and curves stable at 15 fps or after a delayed frame.
  const x = videoOrigin + (CLIP.x0 + CLIP.v * CLIP.fps * time) * scale
  if (!Number.isFinite(previousX)) previousX = Math.min(W + 2, x)
  const distance = previousX - x
  if (distance > 0 && x < W + 2) {
    const fromX = previousX, fromTime = simulationTime
    const count = Math.max(1, Math.ceil(distance / 1.5))
    for (let i = 1; i <= count; i++) {
      stepPoints(fromX - distance * i / count, fromTime + (time - fromTime) * i / count)
    }
  }
  frontX = x
  simulationTime = time
  segments = segments.filter(s => time - s.time < TRACE_LIFETIME)
  flashes = flashes.filter(f => time - f.time < 0.6)
}

function draw() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, W, H)
  const rgb = theme === 'dark' ? '220,230,245' : '19,32,58'
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  for (const s of segments) {
    const life = Math.max(0, 1 - (simulationTime - s.time) / TRACE_LIFETIME)
    const fade = life * life * (3 - 2 * life)
    ctx.strokeStyle = `rgba(${traceRGB},${(0.55 + 0.4 * s.energy) * fade})`
    ctx.lineWidth = 1.2 + 0.8 * s.energy
    ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke()
  }
  for (const f of flashes) {
    const age = simulationTime - f.time
    const radius = 6 + 18 * age
    const gradient = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, radius)
    gradient.addColorStop(0, `rgba(${rgb},${0.4 * Math.max(0, 1 - age / 0.6)})`)
    gradient.addColorStop(1, `rgba(${rgb},0)`)
    ctx.fillStyle = gradient
    ctx.beginPath(); ctx.arc(f.x, f.y, radius, 0, Math.PI * 2); ctx.fill()
  }
  // Only transverse waves: there is deliberately no continuous front-wave path.
  if (frontX < W + 2 && frontX > -MARGIN) {
    const width = Math.max(60, H * cellFrac)
    for (const p of points) {
      const length = (0.45 + 0.5 * p.energy) * width
      const ex = frontX + length * 1.7 / Math.hypot(1.7, 1)
      const ey = p.y + p.dir * length / Math.hypot(1.7, 1)
      const gradient = ctx.createLinearGradient(frontX, p.y, ex, ey)
      gradient.addColorStop(0, `rgba(${rgb},${0.25 + 0.35 * p.energy})`)
      gradient.addColorStop(1, `rgba(${rgb},0)`)
      ctx.strokeStyle = gradient; ctx.lineWidth = 1.2
      ctx.beginPath(); ctx.moveTo(frontX, p.y)
      // Reflect the old bend across the endpoint chord. The bulge now follows
      // p.dir (the transverse propagation direction) while both endpoints stay put.
      const controlX = frontX + 0.3 * length
      const chordY = p.y + (ey - p.y) * (controlX - frontX) / (ex - frontX)
      const controlY = 2 * chordY - (p.y + p.dir * 0.08 * length)
      ctx.quadraticCurveTo(controlX, controlY, ex, ey); ctx.stroke()
    }
  }
  // Complement the video's narrow horizontal mask; don't draw a second wave over the footage.
  ctx.globalCompositeOperation = 'destination-in'
  const mask = ctx.createLinearGradient(videoLeft, 0, videoLeft + vw * FEATHER, 0)
  mask.addColorStop(0, '#000'); mask.addColorStop(1, 'transparent')
  ctx.fillStyle = mask; ctx.fillRect(0, 0, W, H)
  ctx.globalCompositeOperation = 'source-over'
}

function tick(now) {
  const seconds = Math.min(0.1, Math.max(0, (now - lastFrame) / 1000))
  lastFrame = now
  if (!document.hidden && !reducedMotion) {
    const leaveTime = (videoOrigin + CLIP.x0 * scale + MARGIN) / speed
    player.advance(seconds, Math.max(CLIP.duration, leaveTime + TRACE_LIFETIME))
    if (['playing', 'tail'].includes(player.phase)) advanceDrawing()
    draw()
  }
  const label = reducedMotion ? 'Still image · reduced motion' : player.phase === 'error' ? 'Video unavailable · try Replay'
    : player.phase === 'loading' ? 'Preparing video…' : player.paused ? 'Paused'
    : player.phase === 'ready' ? 'Press Play to start' : 'Playing · steady speed'
  if (status.textContent !== label) status.textContent = label
  requestAnimationFrame(tick)
}

document.getElementById('themeseg').addEventListener('click', event => {
  const button = event.target.closest('button')
  if (button && button.dataset.t !== theme) { theme = button.dataset.t; setAppearance() }
})
document.getElementById('treatmentseg').addEventListener('click', event => {
  const button = event.target.closest('button')
  if (button && button.dataset.treatment !== treatment) { treatment = button.dataset.treatment; setAppearance() }
})
document.getElementById('cell').addEventListener('input', event => {
  cellFrac = Number(event.target.value)
  document.getElementById('cellv').textContent = `${cellFrac.toFixed(2)} × height`
  resetDrawing()
})
pauseButton.addEventListener('click', () => {
  if (reducedMotion) { reducedMotion = false; player.paused = false; setAppearance() }
  else if (player.paused) void player.resume()
  else player.pause()
})
document.getElementById('replay').addEventListener('click', () => {
  reducedMotion = false; player.paused = false; setAppearance()
})
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    resumeAfterVisibility = !player.paused && !reducedMotion
    player.pause()
  } else {
    lastFrame = performance.now()
    if (resumeAfterVisibility) void player.resume()
  }
})
motionPreference.addEventListener('change', event => {
  reducedMotion = event.matches
  setAppearance()
})
new ResizeObserver(layout).observe(band)
layout()
setAppearance()
requestAnimationFrame(tick)
