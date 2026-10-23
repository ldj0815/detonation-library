"""Render the centered test04 collision from the uncompressed Shimadzu AVI.

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
CROP = {"x": 190, "y": -22, "width": 280, "height": 200}
ASSET = "test04-wide"
START, END, FPS = 86, 211, 15
COLLISION_FRAME = 150


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=SOURCE)
    parser.add_argument("--ffmpeg", default="ffmpeg")
    args = parser.parse_args()
    output = ROOT / "site/public/banner"
    output.mkdir(parents=True, exist_ok=True)

    def decode(filters):
        data = subprocess.run([args.ffmpeg, "-v", "error", "-i", str(args.source),
                               "-vf", filters, "-fps_mode", "passthrough", "-pix_fmt", "gray", "-f", "rawvideo", "-"],
                              check=True, capture_output=True).stdout
        return np.frombuffer(data, dtype=np.uint8).reshape(-1, CROP["height"], CROP["width"])

    # A small margin above the source keeps the near-top collision centered
    # in the wider view. Its empty pixels map to the exact theme background.
    top = max(0, -CROP["y"])
    crop = f'pad=iw:ih+{top}:0:{top},crop={CROP["width"]}:{CROP["height"]}:{CROP["x"]}:{CROP["y"] + top}'
    baseline = np.median(decode(f"trim=start_frame=8:end_frame=32,{crop}"), axis=0)
    baseline = gaussian_filter(baseline.astype(np.float32), 0.7)
    # Keep the circular window rim out of the decorative treatment.
    aperture = np.clip((distance_transform_edt(baseline > 15) - 3) / 5, 0, 1)
    frames = decode(f"trim=start_frame={START}:end_frame={END},setpts=PTS-STARTPTS,{crop},"
                    "format=gray,nlmeans=s=3.5:p=5:r=11,hqdn3d=1.1:1.1:1.6:1.6")
    if len(frames) != END - START:
        raise ValueError(f"Expected {END - START} frames, got {len(frames)}")
    palettes = {"dark": ([20, 29, 46], [220, 230, 245]), "light": ([255, 255, 255], [19, 32, 58])}
    for theme, (bg, ink) in palettes.items():
        bg, ink = np.array(bg), np.array(ink)
        encoder = subprocess.Popen([
            args.ffmpeg, "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
            "-s", f'{CROP["width"]}x{CROP["height"]}', "-r", str(FPS), "-i", "-", "-an",
            "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p",
            "-g", str(FPS), "-movflags", "+faststart", str(output / f"{ASSET}-{theme}.mp4")
        ], stdin=subprocess.PIPE)
        for index, frame in enumerate(frames):
            # The raw source preserves highlights that the high-contrast exports clip.
            # Subtract a pre-wave reference to suppress stationary texture, then remove
            # slow illumination changes and a small residual noise floor.
            delta = gaussian_filter(frame.astype(np.float32), 0.45) - baseline
            signal = np.clip((np.abs(delta - gaussian_filter(delta, 5)) - 2.5) / 27, 0, 1) ** 0.9
            rgb = np.rint(bg + (signal * aperture)[..., None] * (ink - bg)).astype(np.uint8)
            encoder.stdin.write(rgb.tobytes())
            if index == COLLISION_FRAME - START:
                Image.fromarray(rgb).save(output / f"{ASSET}-{theme}.png")
        encoder.stdin.close()
        if encoder.wait() != 0:
            raise RuntimeError(f"Could not encode {theme} footage")

    metadata = {
        "source": str(args.source.relative_to(ROOT)),
        "selection": "Uncompressed raw AVI; cleaner background and fewer clipped highlights than the supplied contrast variants.",
        "source_frame_start_inclusive": START, "source_frame_end_exclusive": END,
        "crop": CROP, "top_padding_pixels": top, "asset": ASSET,
        "frames": len(frames), "playback_fps": FPS,
        "duration_seconds": len(frames) / FPS, "capture_fps_from_filename": 2000000,
        "collision_source_frame": COLLISION_FRAME,
        "collision_crop_position_approx": {"x": 140, "y": 99},
        "note": "Visual calibration for banner continuity; not measurement data. See site/src/components/banner/clip.ts for trajectory anchors."
    }
    (Path(__file__).parent / "test04-processing.json").write_text(json.dumps(metadata, indent=2) + "\n")
    print(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()
