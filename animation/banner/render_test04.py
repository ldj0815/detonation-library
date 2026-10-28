"""Render full-frame media for the interactive banner editor and homepage.

Requires FFmpeg, numpy, Pillow and scipy. The original footage is not modified.
Run from any directory with --ffmpeg /path/to/ffmpeg if it is not on PATH.
"""

import argparse
import json
from pathlib import Path
import subprocess

import numpy as np
from PIL import Image
from scipy.ndimage import distance_transform_edt, gaussian_filter

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "animation/Processed Shimadzu videos/test04_2MHz_2H2-O2-12Ar_15kPa/test04_2MHz_2H2-O2-12Ar_15kPa.avi"
CROP = {"x": 0, "y": 0, "width": 628, "height": 480}
ASSET = "test04-full"
START, END, FPS = 0, 249, 15
POSTER_FRAME = 150
RENDER_SCALE = 3
SENSOR_DOT = {"x": 304, "y": 216}


def repair_sensor_dot(frames):
    """Repair only the confirmed intermittent zero-valued pixel, before denoising."""
    frames = frames.copy()
    x, y = SENSOR_DOT["x"], SENSOR_DOT["y"]
    bad = frames[:, y, x] == 0
    # Interpolate along the most consistent opposing neighbours, preserving a
    # wave edge better than averaging across it. Healthy samples stay untouched.
    pairs = [((0, -1), (0, 1)), ((-1, 0), (1, 0)), ((-1, -1), (1, 1)), ((-1, 1), (1, -1))]
    neighbours = np.array([[frames[:, y + ay, x + ax], frames[:, y + by, x + bx]]
                           for (ay, ax), (by, bx) in pairs], dtype=np.float32)
    direction = np.argmin(np.abs(neighbours[:, 0] - neighbours[:, 1]), axis=0)
    estimates = neighbours.mean(axis=1)[direction, np.arange(len(frames))]
    frames[bad, y, x] = np.rint(estimates[bad]).astype(np.uint8)
    return frames, np.flatnonzero(bad).tolist()


def smoothstep(value):
    value = np.clip(value, 0, 1)
    return value * value * (3 - 2 * value)


def background_model(frames):
    # Calibrate on identically denoised, pre-wave footage. A raw reference with
    # a different blur leaves stationary grain and scratches in the subtraction.
    reference = gaussian_filter(np.median(frames[8:32], axis=0).astype(np.float32), 0.45)
    pre_wave = gaussian_filter(frames[8:32].astype(np.float32), (0, 0.45, 0.45)) - reference
    pre_wave -= gaussian_filter(pre_wave, (0, 5, 5))
    noise = gaussian_filter(np.percentile(np.abs(pre_wave), 97, axis=0), 1)
    noise_floor = np.clip(noise + 1, 3.5, 7)
    aperture = np.clip((distance_transform_edt(reference > 15) - 3) / 5, 0, 1)
    return reference, noise_floor, aperture


def upscale_field(field, scale):
    if scale == 1:
        return field
    return np.asarray(Image.fromarray(field.astype(np.float32)).resize(
        (field.shape[1] * scale, field.shape[0] * scale), Image.Resampling.BICUBIC))


def matched_signal(frame, reference, noise_floor, aperture, scale=1):
    delta = gaussian_filter(frame.astype(np.float32), 0.45) - reference
    detail = delta - gaussian_filter(delta, 5)
    # Protect coherent, thin wave edges while suppressing weak, blotchy texture.
    # The smoothed gradients guide only the attenuation, never blur the image.
    gy, gx = np.gradient(gaussian_filter(detail, 0.65))
    xx = gaussian_filter(gx * gx, 1.3)
    yy = gaussian_filter(gy * gy, 1.3)
    xy = gaussian_filter(gx * gy, 1.3)
    coherence = np.sqrt((xx - yy) ** 2 + 4 * xy * xy) / (xx + yy + 1e-4)
    edges = smoothstep((coherence - 0.35) / 0.45) * smoothstep((np.sqrt(xx + yy) - 0.4) / 1.5)
    # Interpolate the signed schlieren detail BEFORE rectification/thresholding.
    # Enlarging the finished RGB clip cannot fix the dotted zero crossings and
    # stair steps introduced when contrast is mapped on the source pixel grid.
    # All crop coordinates remain in original recording pixels.
    magnitude = np.abs(upscale_field(detail, scale))
    noise_floor = upscale_field(noise_floor, scale)
    edges = np.clip(upscale_field(edges, scale), 0, 1)
    aperture = np.clip(upscale_field(aperture, scale), 0, 1)
    signal = np.clip((magnitude - 2.5) / 27, 0, 1) ** 0.9
    confidence = smoothstep((magnitude - noise_floor) / (noise_floor + 2))
    # Retain a small amount of uncertain detail rather than hard-cut faint waves.
    return signal * (0.2 + 0.8 * np.maximum(confidence, edges)) * aperture


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=SOURCE)
    parser.add_argument("--ffmpeg", default="ffmpeg")
    parser.add_argument("--scale", type=int, choices=range(1, 5), default=RENDER_SCALE,
                        help="Output supersampling factor; source crop coordinates stay unchanged.")
    args = parser.parse_args()
    output = ROOT / "site/public/banner"
    output.mkdir(parents=True, exist_ok=True)

    def decode(filters):
        data = subprocess.run([args.ffmpeg, "-v", "error", "-i", str(args.source),
                               "-vf", filters, "-fps_mode", "passthrough", "-pix_fmt", "gray", "-f", "rawvideo", "-"],
                              check=True, capture_output=True).stdout
        return np.frombuffer(data, dtype=np.uint8).reshape(-1, CROP["height"], CROP["width"])

    # Keep the entire recording so the editor can change the crop instantly.
    crop = f'crop={CROP["width"]}:{CROP["height"]}:{CROP["x"]}:{CROP["y"]}'
    frames = decode(f"trim=start_frame={START}:end_frame={END},setpts=PTS-STARTPTS,{crop},format=gray")
    if len(frames) != END - START:
        raise ValueError(f"Expected {END - START} frames, got {len(frames)}")
    frames, repaired_frames = repair_sensor_dot(frames)
    denoised = subprocess.run([
        args.ffmpeg, "-v", "error", "-f", "rawvideo", "-pix_fmt", "gray",
        "-s", f'{CROP["width"]}x{CROP["height"]}', "-r", str(FPS), "-i", "-",
        "-vf", "nlmeans=s=3.5:p=5:r=11,hqdn3d=1.1:1.1:1.6:1.6",
        "-pix_fmt", "gray", "-f", "rawvideo", "-",
    ], input=frames.tobytes(), capture_output=True, check=True).stdout
    frames = np.frombuffer(denoised, dtype=np.uint8).reshape(frames.shape)
    reference, noise_floor, aperture = background_model(frames)
    palettes = {"dark": ([20, 29, 46], [220, 230, 245]), "light": ([255, 255, 255], [19, 32, 58])}
    palettes["grey"] = ([0, 0, 0], [255, 255, 255])
    for theme, (bg, ink) in palettes.items():
        bg, ink = np.array(bg), np.array(ink)
        encoder = subprocess.Popen([
            args.ffmpeg, "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
            "-s", f'{CROP["width"] * args.scale}x{CROP["height"] * args.scale}', "-r", str(FPS), "-i", "-", "-an",
            "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p",
            "-g", str(FPS), "-movflags", "+faststart", str(output / f"{ASSET}-{theme}.mp4")
        ], stdin=subprocess.PIPE)
        for index, frame in enumerate(frames):
            if theme == "grey":
                grey = np.clip(np.rint(upscale_field(frame, args.scale)), 0, 255).astype(np.uint8)
                rgb = np.repeat(grey[..., None], 3, axis=2)
            else:
                signal = matched_signal(frame, reference, noise_floor, aperture, args.scale)
                rgb = np.rint(bg + signal[..., None] * (ink - bg)).astype(np.uint8)
            encoder.stdin.write(rgb.tobytes())
            if index == POSTER_FRAME - START:
                Image.fromarray(rgb).save(output / f"{ASSET}-{theme}.png")
        encoder.stdin.close()
        if encoder.wait() != 0:
            raise RuntimeError(f"Could not encode {theme} footage")

    metadata = {
        "source": str(args.source.relative_to(ROOT)),
        "selection": "Uncompressed raw AVI; cleaner background and fewer clipped highlights than the supplied contrast variants.",
        "source_frame_start_inclusive": START, "source_frame_end_exclusive": END,
        "crop": CROP, "asset": ASSET,
        "sensor_dot_repair": {
            **SENSOR_DOT, "affected_frames": len(repaired_frames),
            "method": "Interpolate only zero-valued samples from the most consistent opposing immediate neighbours before denoising; healthy samples unchanged."
        },
        "render": {
            "width": CROP["width"] * args.scale, "height": CROP["height"] * args.scale,
            "scale": args.scale,
            "antialiasing": "Bicubic supersampling of signed schlieren detail before nonlinear contrast mapping; no frame interpolation or extra sharpening.",
            "geometry": "Crop, position, zoom and cell calibration remain in original 628 x 480 recording coordinates."
        },
        "frames": len(frames), "playback_fps": FPS,
        "duration_seconds": len(frames) / FPS, "capture_fps_from_filename": 2000000,
        "poster_source_frame": POSTER_FRAME,
        "strip_center_in_original": {"x": 314, "y": 240},
        "illustrative_cell_original_pixels": {"width": 512, "height": 366},
        "theme_cleanup": {
            "revision": "reference-matched-edge-preserving-v1",
            "background_frames": [8, 32],
            "reference": "Median of the identically denoised pre-wave frames; same 0.45 px smoothing as each frame.",
            "residual_cleanup": "Adaptive pre-wave noise floor, gentle attenuation of weak texture, coherent wave-edge protection; no additional temporal filtering.",
            "grey_treatment": "Unchanged; retains the original grey background and existing mild denoising."
        },
        "note": "Visual calibration for banner continuity; not measurement data. See site/src/components/banner/clip.ts for trajectory anchors."
    }
    (Path(__file__).parent / "test04-processing.json").write_text(json.dumps(metadata, indent=2) + "\n")
    print(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()
