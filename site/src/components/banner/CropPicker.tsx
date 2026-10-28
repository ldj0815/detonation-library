import { useEffect, useRef, type PointerEvent } from 'react'
import type { BannerSettings } from './settings'
import { CLIP } from './clip'

interface Props { settings: BannerSettings; time: number; onChange(settings: BannerSettings): void }
export default function CropPicker({ settings, time, onChange }: Props) {
  const video = useRef<HTMLVideoElement>(null)
  const target = Math.min((CLIP.frames - 1) / CLIP.fps, settings.video.startFrame / CLIP.fps + time)
  const drag = useRef<{ x: number; y: number; crop: BannerSettings['video']; resize: boolean } | null>(null)
  const syncFrame = () => {
    const v = video.current
    if (v && v.readyState >= 2 && !v.seeking && Math.abs(v.currentTime - target) > 1 / 30) v.currentTime = target
  }
  useEffect(syncFrame, [target])
  const position = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    return { x: (event.clientX - box.left) * CLIP.w / box.width, y: (event.clientY - box.top) * CLIP.h / box.height }
  }
  const v = settings.video
  return <div className="be-crop" aria-label="Original recording with draggable crop">
    <video ref={video} src={`${import.meta.env.BASE_URL}banner/${CLIP.asset}-grey.mp4?v=${CLIP.revision}`} muted playsInline preload="auto" onLoadedData={syncFrame} onSeeked={syncFrame} />
    <svg viewBox={`0 0 ${CLIP.w} ${CLIP.h}`} aria-label="Drag the crop rectangle to move it; drag its lower-right corner to resize" onPointerDown={event => {
      const point = position(event)
      const resize = (event.target as Element).getAttribute('data-resize') === 'true'
      if (!resize && (point.x < v.cropX || point.x > v.cropX + v.cropWidth || point.y < v.cropY || point.y > v.cropY + v.cropHeight)) return
      event.currentTarget.setPointerCapture(event.pointerId)
      drag.current = { ...point, crop: { ...v }, resize }
    }} onPointerMove={event => {
      if (!drag.current) return
      const p = position(event), d = drag.current, dx = p.x - d.x, dy = p.y - d.y
      const crop = d.resize ? {
        cropWidth: Math.min(CLIP.w - d.crop.cropX, Math.max(24, d.crop.cropWidth + dx)),
        cropHeight: Math.min(CLIP.h - d.crop.cropY, Math.max(24, d.crop.cropHeight + dy)),
      } : {
        cropX: Math.min(CLIP.w - v.cropWidth, Math.max(0, d.crop.cropX + dx)),
        cropY: Math.min(CLIP.h - v.cropHeight, Math.max(0, d.crop.cropY + dy)),
      }
      onChange({ ...settings, video: { ...v, ...crop } })
    }} onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }}>
      <path d={`M0 0H628V480H0Z M${v.cropX} ${v.cropY}h${v.cropWidth}v${v.cropHeight}h${-v.cropWidth}Z`} fill="rgba(0,0,0,.54)" fillRule="evenodd" pointerEvents="none" />
      <rect x={v.cropX} y={v.cropY} width={v.cropWidth} height={v.cropHeight} fill="transparent" stroke="#ffd200" strokeWidth="3" style={{ cursor: 'move' }} />
      <path d={`M${v.cropX + v.cropWidth / 2 - 12} ${v.cropY + v.cropHeight / 2}h24m-12 -12v24`} stroke="#ffd200" strokeWidth="1.5" pointerEvents="none" />
      <rect data-resize="true" x={v.cropX + v.cropWidth - 11} y={v.cropY + v.cropHeight - 11} width="20" height="20" rx="3" fill="#ffd200" style={{ cursor: 'nwse-resize' }} />
    </svg>
  </div>
}
