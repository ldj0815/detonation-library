"""Make banner media from Claude's cropped, lightly denoised grey PNG frames.

Usage: python render_media.py --frames /path/to/dn --ffmpeg /path/to/ffmpeg
The crop and frame timing stay unchanged; all variants contain 189 frames at 15 fps.
"""

import argparse
import json
from pathlib import Path
import subprocess
import tempfile

import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--frames", type=Path, required=True)
    parser.add_argument("--ffmpeg", default="ffmpeg")
    args = parser.parse_args()
    out = Path(__file__).parent / "media"
    out.mkdir(exist_ok=True)

    def ffmpeg(*command):
        subprocess.run([args.ffmpeg, "-hide_banner", "-loglevel", "error", "-y", *map(str, command)], check=True)

    def encode(source, target):
        ffmpeg("-framerate", "15", "-i", source, "-an", "-c:v", "libx264",
               "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p", "-g", "15",
               "-movflags", "+faststart", target)

    with tempfile.TemporaryDirectory(prefix="banner-denoise-") as temp:
        temp = Path(temp)
        grey_dir = temp / "grey"
        grey_dir.mkdir()
        # Spatial patch averaging removes grain without averaging moving wave positions.
        # A mild temporal pass suppresses remaining flicker, with a low threshold at edges.
        ffmpeg("-framerate", "15", "-i", args.frames / "f%03d.png",
               "-vf", "nlmeans=s=5:p=5:r=11,hqdn3d=1.5:1.5:2.5:2.5",
               grey_dir / "f%03d.png")
        paths = sorted(grey_dir.glob("f*.png"))
        frames = [np.asarray(Image.open(p).convert("L"), dtype=np.float32) for p in paths]
        encode(grey_dir / "f%03d.png", out / "clip-grey.mp4")
        Image.open(paths[60]).save(out / "poster-grey.png")
        palettes = {"dark": ([20, 29, 46], [220, 230, 245]),
                    "light": ([255, 255, 255], [19, 32, 58])}
        for name, (bg, ink) in palettes.items():
            folder = temp / name
            folder.mkdir()
            bg, ink = np.array(bg), np.array(ink)
            for index, frame in enumerate(frames):
                # Remove the remaining low-contrast noise floor before recolouring.
                # Remove slow illumination changes too; retain local schlieren edges.
                background = gaussian_filter(frame, 5)
                signal = np.clip((np.abs(frame - background) - 2.5) / 48, 0, 1) ** 0.9
                rgb = np.rint(bg + signal[..., None] * (ink - bg)).astype(np.uint8)
                result = Image.fromarray(rgb)
                result.save(folder / f"f{index + 1:03d}.png")
                if index == 60:
                    result.save(out / f"poster-{name}.png")
            encode(folder / "f%03d.png", out / f"clip-{name}.mp4")
        before = np.asarray(Image.open(args.frames / "f001.png").convert("L"), dtype=float)
        after = frames[0]
        roi = np.s_[30:170, 30:260]
        noise = lambda im: float(np.std((im - gaussian_filter(im, 2))[roi]))
        metrics = {"frames": len(frames), "fps": 15, "duration_seconds": len(frames) / 15,
                   "flat_region_high_frequency_rms_before": noise(before),
                   "flat_region_high_frequency_rms_after": noise(after)}
        (out / "processing.json").write_text(json.dumps(metrics, indent=2) + "\n")
        print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()
