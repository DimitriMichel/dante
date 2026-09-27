"""Browser composition of the pinned ocrodeg effects. No plotting dependency."""
import json
import random
import sys
import types
import numpy as np
import scipy.ndimage as ndi

pylab = types.ModuleType('pylab')
pylab.rand, pylab.randn = np.random.rand, np.random.randn
sys.modules['pylab'] = pylab
import ocrodeg


def seed_stage(seed, stage):
    value = (int(seed) + stage * 1000003) & 0xffffffff
    np.random.seed(value)
    random.seed(value)


def distort(image, noise):
    # Upstream adds coordinates to its displacement argument in place.
    return np.clip(ocrodeg.distort_with_noise(image, noise.copy(), order=1), 0, 1)


def turn_to_fit(image, angle):
    if not angle:
        return image
    h, w = image.shape
    turned = np.rot90(image, -angle // 90)
    if turned.shape == image.shape:
        return turned.copy()
    ratio = min(h / turned.shape[0], w / turned.shape[1])
    fitted = ndi.zoom(turned, ratio, order=1)
    out = np.zeros_like(image)
    fh, fw = min(h, fitted.shape[0]), min(w, fitted.shape[1])
    top, left = (h - fh) // 2, (w - fw) // 2
    out[top:top + fh, left:left + fw] = fitted[:fh, :fw]
    return out


def page_geometry(images, scale, seed, s):
    images = [turn_to_fit(image, s.get('pageTurn', 0)) for image in images]
    amount = s.get('placement', 0) / 100
    seed_stage(seed, 1)
    params = ocrodeg.random_transform(translation=(-.04 * amount, .04 * amount), rotation=(-5 * amount, 5 * amount), scale=(-.04 * amount, .04 * amount), aniso=(-.08 * amount, .08 * amount))
    params['angle'] += np.deg2rad(s.get('rotation', 0))
    params['scale'] *= s.get('pageScale', 100) / 100
    params['aniso'] /= 1 + s.get('stretch', 0) / 100
    # ocrodeg operates on array axes (row, column), hence y before x.
    params['translation'] = (params['translation'][0] - s.get('offsetY', 0) / 100, params['translation'][1] - s.get('offsetX', 0) / 100)
    if amount or any(s.get(key, 0) for key in ['rotation', 'stretch', 'offsetX', 'offsetY']) or s.get('pageScale', 100) != 100:
        images = [np.clip(ocrodeg.transform_image(image, **params, order=1), 0, 1) for image in images]
    if s.get('wave', 0):
        seed_stage(seed, 2)
        noise = ocrodeg.noise_distort1d(images[0].shape, sigma=max(1, 70 * scale), magnitude=28 * scale * s['wave'] / 100)
        images = [distort(image, noise) for image in images]
    return images


def render_arrays(source, guard, selection, scale, seed, s, paper_rgb):
    h, w = source.shape
    clean, guard, selection = page_geometry([source, guard, selection], scale, seed, s)
    coverage = clean.copy()
    if s.get('roughness', 0):
        seed_stage(seed, 3)
        noise = ocrodeg.bounded_gaussian_noise((h, w), sigma=max(.6, 1.5 * scale), maxdelta=5 * scale * s['roughness'] / 100)
        coverage = distort(coverage, noise)
    if (s.get('rounding', 0) or s.get('edgeNoise', 0)) and np.ptp(coverage) > 1e-6:
        seed_stage(seed, 4)
        sigma = max(.05, 4 * scale * s.get('rounding', 0) / 100)
        coverage = 1 - ocrodeg.binary_blur(1 - coverage, sigma, noise=.35 * s.get('edgeNoise', 0) / 100)
    if s.get('softness', 0):
        coverage = ndi.gaussian_filter(coverage, 2.5 * scale * s['softness'] / 100)
    if s.get('wear', 0) and np.max(coverage) > 0:
        seed_stage(seed, 5)
        density = max(1 / (w * h), .045 * (s['wear'] / 100) ** 1.3 / scale ** 2)
        holes = ocrodeg.random_blobs((h, w), density, size=max(.8, 3 * scale))
        coverage *= 1 - holes
    if s.get('speckles', 0):
        seed_stage(seed, 6)
        density = max(1 / (w * h), .0015 * (s['speckles'] / 100) ** 1.2 / scale ** 2)
        spots = ocrodeg.random_blobs((h, w), density, size=max(.8, 2 * scale))
        coverage = np.maximum(coverage, spots)

    paper_color = np.asarray(paper_rgb, dtype=np.float32)
    ink_color = np.array([36, 33, 29], dtype=np.float32)
    recipe = s.get('recipe', 'custom')
    if recipe in ('book', 'fiber'):
        # Call the complete original preset, with its default blur and blotches.
        seed_stage(seed, 7)
        preset = ocrodeg.printlike_multiscale if recipe == 'book' else ocrodeg.printlike_fibrous
        printed = preset(1 - coverage)
        rgb = printed[:, :, None] * paper_color
        paper_tone = np.ones((h, w), dtype=np.float32)
        protected_paper = paper_color
        if np.any(guard):
            # The same seed on an empty sheet reproduces the preset's paper
            # underneath protected letters without a rectangular clean patch.
            seed_stage(seed, 7)
            protected_paper = preset(np.ones_like(coverage))[:, :, None] * paper_color
    else:
        scales = [max(1, n * scale) for n in [1, 5, 10, 50]]
        paper_tone = np.ones((h, w), dtype=np.float32)
        if s.get('paperGrain', 0):
            seed_stage(seed, 8)
            if s.get('paperStyle') == 'multiscale':
                paper = ocrodeg.make_multiscale_noise_uniform((h, w), srange=(max(1, scale), max(1, 100 * scale)), limits=(.5, 1))
            else:
                paper = ocrodeg.make_multiscale_noise((h, w), scales, weights=[1, .3, .5, .3], limits=(.7, 1))
                paper -= ocrodeg.make_fibrous_image((h, w), nfibers=min(2000, max(1, round(300 * w * h / (720 * 900 * scale ** 2)))), l=max(1, round(500 * scale)), a=.01, limits=(0, .25), blur=.5 * scale)
            paper_tone += (np.clip(paper, 0, 1) - 1) * s['paperGrain'] / 100
        # Texture changes local density only; most of the ink stays dark.
        ink_tone = np.zeros((h, w), dtype=np.float32)
        if s.get('texture', 0):
            seed_stage(seed, 9)
            noise = ocrodeg.make_multiscale_noise((h, w), [max(1, scale), max(1, 3 * scale), max(1, 12 * scale)])
            ink_tone = np.clip((noise - .45) / .55, 0, 1) ** 2 * .5 * s['texture'] / 100
        paper = paper_tone[:, :, None] * paper_color
        protected_paper = paper
        ink = ink_color + (paper_color - ink_color) * ink_tone[:, :, None]
        rgb = paper * (1 - coverage[:, :, None]) + ink * coverage[:, :, None]
    if s.get('fade', 0):
        fade = .85 * s['fade'] / 100 * coverage[:, :, None]
        rgb = rgb * (1 - fade) + paper_color * fade
    # Clean selections follow page movement, but retain their original letter shapes.
    protected = protected_paper * (1 - clean[:, :, None]) + ink_color * clean[:, :, None]
    rgb = rgb * (1 - guard[:, :, None]) + protected * guard[:, :, None]
    out = np.empty((h, w, 4), dtype=np.uint8)
    out[:, :, :3] = np.clip(np.nan_to_num(rgb), 0, 255).astype(np.uint8)
    out[:, :, 3] = 255
    return out, (np.clip(selection, 0, 1) * 255).astype(np.uint8)


def make_print(pixels, protected, selected, width, height, scale, seed, settings, paper_rgb):
    source = np.asarray(pixels.to_py(), dtype=np.uint8).reshape(height, width, 4)
    coverage = 1 - source[:, :, 0].astype(np.float32) / 255
    guard = np.asarray(protected.to_py(), dtype=np.uint8).reshape(height, width).astype(np.float32) / 255
    selection = np.asarray(selected.to_py(), dtype=np.uint8).reshape(height, width).astype(np.float32) / 255
    out, overlay = render_arrays(coverage, guard, selection, scale, seed, json.loads(settings), paper_rgb.to_py())
    return out.ravel(), overlay.ravel()
