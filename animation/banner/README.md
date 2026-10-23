# Transverse-wave banner study

This folder contains the original standalone header study and the media renderer
for the production React banner in `site/src/components/banner/`.

## Current production footage: test04

The production banner uses the uncompressed `test04_2MHz_2H2-O2-12Ar_15kPa.avi`.
The raw version keeps more highlight detail and gives a cleaner processed
background than the supplied contrast exports. Frames 86–248 use the middle
horizontal third of the original 628 × 480 recording: a 628 × 160 strip at
(0, 160), centered on the original y = 240 line, without padding. The result
plays at 15 fps for 10.87 seconds; capture was at 2 MHz. The banner displays a
centered window into this strip using `object-fit: cover`.

`render_test04.py` produces the `test04-center` light and dark MP4s and still images in
`site/public/banner/`. It subtracts a pre-wave background, denoises the footage,
and maps it to the site's theme colors. To regenerate, use Python with numpy,
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
