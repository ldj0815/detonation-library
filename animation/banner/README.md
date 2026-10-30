# Transverse-wave banner study

This folder contains the original standalone header study and the media renderer
for the production React banner in `site/src/components/banner/`.

## Interactive local editor

Double-click `Open Banner Editor.command` in the repository root, or run
`npm run banner:edit` from `site/`. Open <http://localhost:5174/#/banner-editor>.
Keep the editor's terminal window open while working.

The editor uses the same banner renderer as the homepage. It includes:

- Light and dark previews, plus accurate desktop and phone viewports.
- Pause, restart, frame stepping and a timeline that includes the drawn tail.
- A draggable crop on the full original recording, crop presets, zoom, opacity,
  softening, and theme-matched or original-grey footage.
- Cell dimensions and position, wave curvature and length, colours, line widths,
  trace lifetime, video share, feathering, trim and playback speed.
- Undo/redo, browser draft recovery, and settings import/download.

**Save to project** writes `site/src/components/banner/settings.json`; the local
homepage immediately uses it. It does not commit or publish. The editor and save
endpoint run only in the local development server and are excluded from the
production website. The endpoint accepts only validated settings for this fixed
file, from the same localhost origin with a session token.

The recording is prepared once at full resolution, so editing its crop does not
require rendering new videos. A draft stays in that browser until saved, reset,
or replaced with an imported settings file. The timeline's yellow marker is the
end of the video segment; animation can continue past it. Arrow keys step one
frame, Page Up/Down move one second, and Home/End jump to the loop's ends.

## Current production footage: test04

The production banner uses the uncompressed `test04_2MHz_2H2-O2-12Ar_15kPa.avi`.
The raw version keeps more highlight detail and gives a cleaner processed
background than the supplied contrast exports. The full 628 × 480 recording,
frames 0–248, is prepared at 15 fps (16.6 seconds). Capture was at 2 MHz. The
saved settings currently select frames 86–248 and a 628 × 160 strip at (0, 160),
centered on the original y = 240 line. The video and drawing use the same crop
and scale; a centered window into the selected area fills the video panel.

`render_test04.py` produces the `test04-full` light, dark and grey MP4s and still images in
`site/public/banner/`. It subtracts a pre-wave background, denoises the footage,
and maps it to the site's theme colors. The background reference now uses the
same denoising and smoothing as the footage, avoiding residual stationary texture.
A gentle, adaptive cleanup suppresses weak blotches while protecting coherent
wave edges. It leaves strong contrast intact and adds no temporal averaging.
The encoded footage and posters are supersampled 3× to 1884 × 1440. Signed
schlieren detail is interpolated before contrast mapping to reduce stair steps
and dotted contours; simply enlarging a finished frame does not fix those.
This smooths the rendering without creating additional captured detail. Crop,
zoom, positioning and all editor dimensions still use the original 628 × 480
coordinates, so the selected region stays identical. No frame interpolation or
extra sharpening is used. The intermittent black sensor pixel at (304, 216) is
repaired only when it reads zero, before denoising, by interpolating along the
most consistent pair of immediate neighbours. Healthy samples are untouched.
The grey treatment retains its existing denoising,
with the same bicubic enlargement. To regenerate, use Python with numpy,
Pillow and scipy, and pass `--ffmpeg /path/to/ffmpeg` if needed. The original
source files stay local and are not included in the website deployment.

`test04-processing.json` records the crop and frame selection. The visual
trajectory anchors in `site/src/components/banner/clip.ts` align the animation's
front position with the footage. The left drawing uses an idealized, single row
of diamond cells: two mirrored transverse waves with equal speeds and no random
variation. The illustrative cell is 512 × 366 source pixels, scaled with the
video rather than fitted to the banner. Both its width and height may extend
outside the banner; the banner clips them naturally. Yellow traces disappear
after two seconds, so only the recent part remains visible at any moment.
These are decorative visual calibrations, not measurement data. The production
banner preserves the half-and-half layout and existing pause behavior.

## Original standalone study

The review page below retains the earlier footage and grey-background alternative;
use the React development server in `site/` to review the current production banner.

From the repository root, serve it with:

```sh
python3 -m http.server 5180 --bind 127.0.0.1 --directory animation/banner
```

- Theme matched: <http://127.0.0.1:5180/?theme=dark&treatment=matched>
- Grey background: <http://127.0.0.1:5180/?theme=dark&treatment=grey>

Both support light/dark themes, pause, replay, and reduced-motion preferences.
The selected treatment is theme matched. The animation occupies the left half of
the banner and the video occupies the right half. Desktop text and search controls
fit within the left half. The animation and blend follow the video's actual
position and crop.

## Changes

- Removed the drawn continuous front, keeping transverse waves and their tracks.
- Traces use the theme's yellow `--mark` colour, smoothly reach zero opacity at two
  seconds, and are removed from memory. Transverse waves keep their neutral ink.
- Transverse-wave curves bulge toward their propagation direction, with their
  endpoints preserved and the previous curvature flipped across the endpoint chord.
- Reduced the horizontal blend from 30% to 8% of the video width, and the top/bottom
  feather from 12% to 5%.
- Playback stays at 1×. Animation follows the media clock, then continues at the
  same speed after the footage ends when needed. The video is hidden during the
  rewind and revealed only after the first frame is ready.
- Cancels stale media-load callbacks during theme/treatment changes. Tab hiding
  pauses both media and animation. Failed autoplay exposes a Play control.
- Added spatial denoising and mild temporal filtering to the cropped grey footage.
  Theme-matched versions also suppress slow illumination changes and residual
  low-contrast noise before mapping to the banner palette.

## Media and provenance

The three MP4s are 292 × 200, 189 frames at 15 fps, lasting 12.6 seconds. They have
one-second keyframe spacing and streaming metadata at the beginning of the file.
The grey clip preserves the schlieren grey background; theme-matched clips use
the existing site colours. These processed videos are decorative previews, not
measurement data. The original AVI in `animation/` is preserved.

`render_media.py` uses the already cropped grey PNG sequence (`dn/f001.png` through
`dn/f189.png`) from Claude's supplied session:

```text
/private/tmp/claude-501/-Users-dijialiu-Desktop-Research-Detonation-Database/4831a231-dbb7-4ba7-85bd-aeab1627abb1/scratchpad/anim/dn
```

To regenerate, pass that frame folder (or a preserved copy) using `--frames`, and
an FFmpeg executable using `--ffmpeg`. Python dependencies: numpy, Pillow, scipy.
The generated media is self-contained; the temporary folder is needed only for
regeneration. `media/processing.json` records a flat-field high-frequency noise
comparison, not a measure of wave-detail fidelity.

## Verification

```sh
node --test animation/banner/playback.test.mjs
```

Seven tests cover cold loading, four consecutive loops, rapid source switching,
pause during startup, hidden-tab/tail pausing, reduced motion, and blocked autoplay.
All three MP4 files were decoded successfully. Browser checks covered full-width
and narrow layouts, both video treatments, theme switching, and steady playback.

## RDE page header

The RDE browse page uses `2026-07-29_test6.1_RDE.m4v` in its own header.
`render_rde.py` prepares light and dark `rde-test6` MP4s and posters, keeping the
full frame and the complete 74.9-second clip. The 256 × 184 source is enlarged
3× before theme mapping, with mild denoising and no synthetic frames. The
original recording stays unchanged. Regenerate with Python, numpy and Pillow:

```sh
python animation/banner/render_rde.py --ffmpeg /path/to/ffmpeg
```

`rde-processing.json` records the source and rendering. The engine and plume
stay fully visible to the right of the title on desktop and below it on phones.
The header leaves the text background clear, provides a pause control, pauses
in hidden tabs, and shows a still image for reduced motion until
Play is requested. The category tabs, release metadata and data controls remain
part of the RDE page.

## Home banner: test51 at 3×

The home page plays the test51 recording again, with the drawn transverse waves
of the 22 October banner (`site/src/components/banner/test51/`). `render_test51.py`
renders `test51-light` and `test51-dark` MP4s and posters at 1080 × 750 straight
from the original AVI, over a 360 × 250 region from (20, 0): the full frame height,
wider than the 22 October 292 × 200 window from (48, 16). It keeps that clip's
frames (AVI 2 to 190, 15 fps), denoising and tone curve, but enlarges the detail
3× before the curve instead of letting the browser stretch a small picture. The
background estimate uses only pixels inside the round schlieren window, and the
footage fades out over its last few pixels, so the window's edge does not show.
The drawing's front trajectory moved with the crop (x0 = 356.5784 crop pixels).

```sh
python animation/banner/render_test51.py --ffmpeg /path/to/ffmpeg
```

`test51-processing.json` records the crop, frames and processing. The settings-
driven test04 banner and its editor are unchanged; the editor previews test04.
