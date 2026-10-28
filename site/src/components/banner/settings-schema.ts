// Factory fallback for imported partial settings; independent of the saved project file.
const saved = {
  "version": 1,
  "video": {
    "cropX": 0, "cropY": 160, "cropWidth": 628, "cropHeight": 160,
    "startFrame": 86, "endFrame": 249, "zoom": 1,
    "treatment": "matched", "opacity": 1, "soften": 0,
    "rate": 1, "fade": true, "linger": 0.4, "fadeDuration": 1.5
  },
  "animation": {
    "cellWidth": 512, "cellHeight": 366, "anchorX": 551, "centerY": 240,
    "curvature": 0.3, "waveLength": 0.6, "waveOpacity": 1, "waveWidth": 1.2,
    "traceLifetime": 2, "traceOpacity": 1, "traceWidth": 1.2,
    "traceColor": "auto", "waveColor": "auto"
  },
  "layout": { "videoWidth": 100, "feather": 8, "verticalFeather": 5, "height": 0 }
}

export interface BannerSettings {
  version: 1
  video: {
    cropX: number; cropY: number; cropWidth: number; cropHeight: number
    startFrame: number; endFrame: number; zoom: number
    treatment: 'matched' | 'grey'; opacity: number; soften: number
    rate: number; fade: boolean; linger: number; fadeDuration: number
  }
  animation: {
    cellWidth: number; cellHeight: number; anchorX: number; centerY: number
    curvature: number; waveLength: number; waveOpacity: number; waveWidth: number
    traceLifetime: number; traceOpacity: number; traceWidth: number
    traceColor: string; waveColor: string
  }
  layout: { videoWidth: number; feather: number; verticalFeather: number; height: number }
}

const record = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {}
const number = (v: unknown, fallback: number, min: number, max: number) => {
  if (v === undefined) return Math.min(max, Math.max(min, fallback))
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error('Settings contain an invalid number.')
  return Math.min(max, Math.max(min, v))
}
const colour = (v: unknown) => {
  if (v === undefined || v === 'auto') return 'auto'
  if (typeof v !== 'string' || !/^#[0-9a-f]{6}$/i.test(v)) throw new Error('Choose a valid six-digit colour.')
  return v
}

/** Shared by browser import and the local save endpoint. Only known fields survive. */
export function parseBannerSettings(value: unknown): BannerSettings {
  const root = record(value)
  if (root.version !== 1) throw new Error('This is not a version 1 banner settings file.')
  const v = record(root.video), a = record(root.animation), l = record(root.layout)
  const d = saved
  const cropWidth = number(v.cropWidth, d.video.cropWidth, 24, 628)
  const cropHeight = number(v.cropHeight, d.video.cropHeight, 24, 480)
  const startFrame = Math.round(number(v.startFrame, d.video.startFrame, 0, 248))
  if (v.treatment !== undefined && v.treatment !== 'matched' && v.treatment !== 'grey') throw new Error('Unknown video treatment.')
  if (v.fade !== undefined && typeof v.fade !== 'boolean') throw new Error('The video fade setting must be on or off.')
  return {
    version: 1,
    video: {
      cropWidth, cropHeight,
      cropX: number(v.cropX, d.video.cropX, 0, 628 - cropWidth),
      cropY: number(v.cropY, d.video.cropY, 0, 480 - cropHeight),
      startFrame, endFrame: Math.round(number(v.endFrame, d.video.endFrame, startFrame + 1, 249)),
      zoom: number(v.zoom, d.video.zoom, 0.4, 3),
      treatment: v.treatment === 'grey' ? 'grey' : 'matched',
      opacity: number(v.opacity, d.video.opacity, 0, 1), soften: number(v.soften, d.video.soften, 0, 3),
      rate: number(v.rate, d.video.rate, 0.25, 2), fade: v.fade === undefined ? d.video.fade : v.fade as boolean,
      linger: number(v.linger, d.video.linger, 0, 5), fadeDuration: number(v.fadeDuration, d.video.fadeDuration, 0, 5),
    },
    animation: {
      cellWidth: number(a.cellWidth, d.animation.cellWidth, 40, 2000),
      cellHeight: number(a.cellHeight, d.animation.cellHeight, 20, 1400),
      anchorX: number(a.anchorX, d.animation.anchorX, -1000, 1600),
      centerY: number(a.centerY, d.animation.centerY, -480, 960),
      curvature: number(a.curvature, d.animation.curvature, -0.7, 0.9),
      waveLength: number(a.waveLength, d.animation.waveLength, 0.05, 1.5),
      waveOpacity: number(a.waveOpacity, d.animation.waveOpacity, 0, 1),
      waveWidth: number(a.waveWidth, d.animation.waveWidth, 0.3, 5),
      traceLifetime: number(a.traceLifetime, d.animation.traceLifetime, 0, 10),
      traceOpacity: number(a.traceOpacity, d.animation.traceOpacity, 0, 1),
      traceWidth: number(a.traceWidth, d.animation.traceWidth, 0.3, 5),
      traceColor: colour(a.traceColor), waveColor: colour(a.waveColor),
    },
    layout: {
      videoWidth: number(l.videoWidth, d.layout.videoWidth, 15, 100),
      feather: number(l.feather, d.layout.feather, 0, 40),
      verticalFeather: number(l.verticalFeather, d.layout.verticalFeather, 0, 30),
      height: number(l.height, d.layout.height, 0, 800),
    },
  }
}

