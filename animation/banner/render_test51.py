"""Render the test51 home-banner clip at 3x from the original AVI.

Same frames and tone curve as the 22 October clip-*.mp4 (render_media.py), over
a larger region: the full frame height instead of a 292 x 200 window. The detail
is enlarged before the contrast mapping, as in render_test04.py, so the browser
no longer stretches a small picture, and the round schlieren window fades out
just inside its edge. Requires FFmpeg, numpy, Pillow and scipy. The original AVI
is not modified. Run with --ffmpeg /path/to/ffmpeg if it is not on PATH.
"""

import argparse
import json
from pathlib import Path
import subprocess

import numpy as np
from PIL import Image
from scipy.ndimage import binary_fill_holes, binary_opening, distance_transform_edt, gaussian_filter

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "animation/26_07_19-test51-13kPa-2_H2-1_O2-17_Ar-3kPaC2H4start-0.2usec-0.5MFPS-10ns-256Fr-0p-2c_contrast_50.00-sig.avi"
# The 22 October clip was 292 x 200 at (48, 16), AVI frames 2..190, found by
# matching it against every frame and offset of the AVI.
OCT22_CROP = {"x": 48, "y": 16, "width": 292, "height": 200}
CROP = {"x": 20, "y": 0, "width": 360, "height": 250}
START, END, FPS = 2, 191, 15
POSTER_FRAME = START + 60
RENDER_SCALE = 3
DENOISE = "nlmeans=s=5:p=5:r=11,hqdn3d=1.5:1.5:2.5:2.5"
ASSET = "test51"


def upscale_field(field, scale):
    if scale == 1:
        return field
    return np.asarray(Image.fromarray(field.astype(np.float32)).resize(
        (field.shape[1] * scale, field.shape[0] * scale), Image.Resampling.BICUBIC))


def schlieren_window(frames):
    """The round schlieren window: a 0/1 mask, and a fade over its last few pixels.

    Outside the window the AVI is flat, brighter grey with no noise.
    """
    texture = (frames - gaussian_filter(frames.astype(np.float32), (0, 3, 3))).std(axis=0)
    inside = gaussian_filter(texture, 2) > 0.5 * np.median(texture)
    inside = binary_fill_holes(binary_opening(inside, iterations=2))
    return inside.astype(np.float32), np.clip((distance_transform_edt(inside) - 3) / 6, 0, 1)


def signal(frame, inside, fade, scale):
    # The 22 October mapping: local schlieren detail against a 5 px background,
    # a small noise floor, then a gentle curve. The background averages only
    # pixels inside the window, so its edge against the grey outside does not
    # read as detail. The magnitude is enlarged before the curve, which sharpens
    # edges; enlarging the signed detail instead would open hairline gaps where
    # it crosses zero inside each wave line.
    frame = frame.astype(np.float32)
    background = gaussian_filter(frame * inside, 5) / np.maximum(gaussian_filter(inside, 5), 1e-3)
    magnitude = np.abs(frame - background) * inside
    magnitude = np.maximum(upscale_field(magnitude, scale), 0)
    return np.clip((magnitude - 2.5) / 48, 0, 1) ** 0.9 * fade


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=SOURCE)
    parser.add_argument("--ffmpeg", default="ffmpeg")
    parser.add_argument("--scale", type=int, choices=range(1, 5), default=RENDER_SCALE)
    args = parser.parse_args()
    output = ROOT / "site/public/banner"
    output.mkdir(parents=True, exist_ok=True)
    w, h = CROP["width"], CROP["height"]

    crop = f'crop={w}:{h}:{CROP["x"]}:{CROP["y"]}'
    decoded = subprocess.run([
        args.ffmpeg, "-v", "error", "-i", str(args.source), "-an",
        "-vf", f"trim=start_frame={START}:end_frame={END},setpts=PTS-STARTPTS,{crop},format=gray",
        "-vsync", "passthrough", "-pix_fmt", "gray", "-f", "rawvideo", "-",
    ], check=True, capture_output=True).stdout
    frames = np.frombuffer(decoded, np.uint8).reshape(-1, h, w)
    if len(frames) != END - START:
        raise ValueError(f"Expected {END - START} frames, got {len(frames)}")
    denoised = subprocess.run([
        args.ffmpeg, "-v", "error", "-f", "rawvideo", "-pix_fmt", "gray", "-s", f"{w}x{h}", "-r", str(FPS),
        "-i", "-", "-vf", DENOISE, "-pix_fmt", "gray", "-f", "rawvideo", "-",
    ], input=frames.tobytes(), capture_output=True, check=True).stdout
    frames = np.frombuffer(denoised, np.uint8).reshape(frames.shape)
    inside, fade = schlieren_window(frames)
    fade = np.clip(upscale_field(fade, args.scale), 0, 1)

    palettes = {"dark": ([20, 29, 46], [220, 230, 245]), "light": ([255, 255, 255], [19, 32, 58])}
    for theme, (bg, ink) in palettes.items():
        bg, ink = np.array(bg), np.array(ink)
        destination = output / f"{ASSET}-{theme}.mp4"
        # Publish each complete file together with its poster, never a partial MP4.
        pending = output / f".{ASSET}-{theme}.pending.mp4"
        encoder = subprocess.Popen([
            args.ffmpeg, "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
            "-s", f"{w * args.scale}x{h * args.scale}", "-r", str(FPS), "-i", "-", "-an",
            "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p",
            "-g", str(FPS), "-movflags", "+faststart", str(pending),
        ], stdin=subprocess.PIPE)
        poster = None
        for index, frame in enumerate(frames):
            rgb = np.rint(bg + signal(frame, inside, fade, args.scale)[..., None] * (ink - bg)).astype(np.uint8)
            encoder.stdin.write(rgb.tobytes())
            if index == POSTER_FRAME - START:
                poster = Image.fromarray(rgb)
        encoder.stdin.close()
        if encoder.wait() != 0:
            pending.unlink(missing_ok=True)
            raise RuntimeError(f"Could not encode {theme} footage")
        pending.replace(destination)
        poster.save(destination.with_suffix(".png"))

    metadata = {
        "source": str(args.source.relative_to(ROOT)),
        "source_frame_start_inclusive": START, "source_frame_end_exclusive": END,
        "crop": CROP, "asset": ASSET,
        "oct22_crop": OCT22_CROP,
        "oct22_crop_and_frames": "Recovered by normalized cross-correlation of the 22 October clip-grey.mp4 against the AVI; frames 16 onward match one-to-one.",
        "render": {
            "width": w * args.scale, "height": h * args.scale, "scale": args.scale,
            "antialiasing": "Bicubic enlargement of the detail magnitude before the contrast curve; no frame interpolation or sharpening.",
            "window": "Footage fades to the background over 3 to 9 px inside the round schlieren window's edge.",
            "geometry": f"The banner's front trajectory is in {w} x {h} crop pixels (site/src/components/banner/test51/drawing.ts).",
        },
        "denoise": DENOISE,
        "tone_mapping": "As on 22 October: |frame - gaussian(frame, 5)|, minus 2.5, over 48, to the power 0.9, into the site's light and dark palettes.",
        "frames": len(frames), "playback_fps": FPS, "duration_seconds": len(frames) / FPS,
        "capture_fps_from_filename": 500000, "poster_source_frame": POSTER_FRAME,
        "note": "Decorative banner footage; not measurement data. The original AVI is unchanged.",
    }
    (Path(__file__).parent / "test51-processing.json").write_text(json.dumps(metadata, indent=2) + "\n")
    print(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()
