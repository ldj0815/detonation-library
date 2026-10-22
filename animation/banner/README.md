# Transverse-wave banner study

This continues Claude's v4/v5 header prototype. It is a standalone review page;
the production React homepage has not been changed or deployed.

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
