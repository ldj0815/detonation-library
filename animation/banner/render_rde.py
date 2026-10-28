"""Prepare theme-matched RDE header footage without cropping the engine."""

import argparse
import json
from pathlib import Path
import subprocess

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "animation/2026-07-29_test6.1_RDE.m4v"
WIDTH, HEIGHT, SCALE, FPS = 256, 184, 3, 10
POSTER_FRAME = 75
ASSET = "rde-test6"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ffmpeg", default="ffmpeg")
    args = parser.parse_args()
    output = ROOT / "site/public/banner"
    output.mkdir(parents=True, exist_ok=True)
    decoded = subprocess.run([
        args.ffmpeg, "-v", "error", "-i", str(SOURCE), "-an",
        "-vf", "fps=10,format=gray,hqdn3d=0.6:0.6:0.8:0.8", "-pix_fmt", "gray", "-f", "rawvideo", "-",
    ], check=True, capture_output=True).stdout
    frames = np.frombuffer(decoded, np.uint8).reshape(-1, HEIGHT, WIDTH)
    palettes = {"light": ([255, 255, 255], [19, 32, 58]), "dark": ([20, 29, 46], [220, 230, 245])}
    for theme, (background, ink) in palettes.items():
        bg, ink = np.array(background), np.array(ink)
        destination = output / f"{ASSET}-{theme}.mp4"
        # Publish each complete file together with its poster, never a partial MP4.
        pending = output / f".{ASSET}-{theme}.pending.mp4"
        poster = None
        encoder = subprocess.Popen([
            args.ffmpeg, "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
            "-s", f"{WIDTH * SCALE}x{HEIGHT * SCALE}", "-r", str(FPS), "-i", "-", "-an",
            "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
            "-g", str(FPS), "-movflags", "+faststart", str(pending),
        ], stdin=subprocess.PIPE)
        for index, frame in enumerate(frames):
            # Interpolate before tone mapping, without sharpening or synthetic frames.
            enlarged = np.asarray(Image.fromarray(frame.astype(np.float32)).resize(
                (WIDTH * SCALE, HEIGHT * SCALE), Image.Resampling.BICUBIC))
            signal = np.clip((enlarged - 10) / 235, 0, 1) ** 1.1
            rgb = np.rint(bg + signal[..., None] * (ink - bg)).astype(np.uint8)
            encoder.stdin.write(rgb.tobytes())
            if index == POSTER_FRAME:
                poster = Image.fromarray(rgb)
        encoder.stdin.close()
        if encoder.wait() != 0:
            pending.unlink(missing_ok=True)
            raise RuntimeError(f"Could not encode {theme} RDE footage")
        pending.replace(destination)
        if poster:
            poster.save(destination.with_suffix('.png'))

    metadata = {
        "source": str(SOURCE.relative_to(ROOT)), "asset": ASSET,
        "original_size": {"width": WIDTH, "height": HEIGHT},
        "render_size": {"width": WIDTH * SCALE, "height": HEIGHT * SCALE},
        "frames": len(frames), "playback_fps": FPS, "duration_seconds": len(frames) / FPS,
        "poster_frame": POSTER_FRAME,
        "framing": "Full frame; the header contains the whole engine and plume without cropping.",
        "processing": "Mild noise reduction, bicubic 3x enlargement before tone mapping, site light and dark palettes. No frame interpolation or sharpening.",
        "note": "Decorative header footage. Playback frame rate does not identify the camera capture rate. Original M4V unchanged.",
    }
    (Path(__file__).parent / "rde-processing.json").write_text(json.dumps(metadata, indent=2) + "\n")
    print(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()
