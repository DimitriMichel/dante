"""Impression's selection-aware composition using the upstream ocrodeg module."""
import random
import sys
import types
import numpy as np
import scipy.ndimage as ndi

# ocrodeg only uses pylab's NumPy random aliases; no plotting is needed in a worker.
pylab = types.ModuleType("pylab")
pylab.rand = np.random.rand
pylab.randn = np.random.randn
sys.modules["pylab"] = pylab
import ocrodeg


def make_print(pixels, protected, width, height, scale, seed, texture, paper_grain, wear, style, paper_rgb):
    source = np.asarray(pixels.to_py(), dtype=np.uint8).reshape(height, width, 4)
    coverage = 1.0 - source[:, :, 0].astype(np.float32) / 255.0
    guard = np.asarray(protected.to_py(), dtype=np.uint8).reshape(height, width).astype(np.float32) / 255.0
    amount = texture / 100.0
    np.random.seed(int(seed) & 0xffffffff)
    random.seed(int(seed) & 0xffffffff)

    if style == "fibrous":
        scales = [max(1.0, n * scale) for n in [1, 5, 10, 50]]
        paper = ocrodeg.make_multiscale_noise((height, width), scales, weights=[1.0, 0.3, 0.5, 0.3], limits=(0.7, 1.0))
        fiber_count = min(2000, max(1, round(300 * width * height / (720 * 900 * scale * scale))))
        paper -= ocrodeg.make_fibrous_image((height, width), nfibers=fiber_count, l=round(300 * scale), a=0.01, limits=(0.0, 0.25), blur=0.5 * scale)
        ink = ocrodeg.make_multiscale_noise((height, width), scales, limits=(0.0, 0.5))
    else:
        paper = ocrodeg.make_multiscale_noise_uniform((height, width), srange=(max(1.0, scale), max(1.0, 100 * scale)), limits=(0.5, 1.0))
        ink = ocrodeg.make_multiscale_noise_uniform((height, width), srange=(max(1.0, scale), max(1.0, 100 * scale)), limits=(0.0, 0.5))

    # Ink/paper texture stays separate from the glyph mask, so clean selections
    # keep their outlines and solid ink without erasing the paper behind them.
    impression = coverage
    density = (wear / 100.0) * 0.000008 / (scale * scale)
    if density > 0:
        density = max(density, 1.0 / (width * height))
        impression = ocrodeg.random_blotches(coverage, density * 3, density, fgscale=2.2 * scale, bgscale=1.4 * scale)
    impression = ndi.gaussian_filter(impression, 0.45 * scale)
    ink_alpha = coverage + (impression - coverage) * amount * (1.0 - guard)
    ink_alpha = np.clip(ink_alpha, 0, 1)
    paper_tone = 1.0 + (np.clip(paper, 0, 1) - 1.0) * (paper_grain / 100.0)
    ink_tone = np.clip(ink, 0, 1) * amount * (1.0 - guard)
    paper_color = np.array(paper_rgb.to_py(), dtype=np.float32)
    ink_color = np.array([36, 33, 29], dtype=np.float32)
    result = np.empty((height, width, 4), dtype=np.uint8)
    for channel in range(3):
        light = paper_color[channel] * paper_tone
        dark = ink_color[channel] + (paper_color[channel] - ink_color[channel]) * ink_tone
        result[:, :, channel] = np.clip(light * (1 - ink_alpha) + dark * ink_alpha, 0, 255).astype(np.uint8)
    result[:, :, 3] = 255
    return result.ravel()
