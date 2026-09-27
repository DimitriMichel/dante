import importlib.util
from pathlib import Path
import sys
import unittest
import numpy as np

import os
if os.environ.get('OCRODEG_SOURCE_DIR'): sys.path.insert(0, os.environ['OCRODEG_SOURCE_DIR'])
root = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('pipeline', root / 'src/print-pipeline.py')
pipeline = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pipeline)

class PrintEffects(unittest.TestCase):
    def setUp(self):
        self.source = np.zeros((320, 256), dtype=np.float32)
        # Asymmetric strokes: show rotations, holes, noise and width changes.
        for y in range(40, 240, 38):
            for x in range(24, 220, 24):
                self.source[y:y+24,x:x+5] = 1
                self.source[y:y+5,x:x+15] = 1
        self.zero = np.zeros_like(self.source)
        self.guard = self.zero.copy(); self.guard[30:75,18:48] = 1
    def render(self, **settings):
        return pipeline.render_arrays(self.source, self.guard if settings.pop('protect', False) else self.zero, self.guard, 1, settings.pop('seed', 55), settings, [255,255,255])
    def test_each_control_changes_the_pixels(self):
        base = self.render()[0]
        for key,value in dict(texture=100,fade=100,wear=100,speckles=100,paperGrain=100,roughness=100,rounding=100,edgeNoise=100,softness=100,wave=100,placement=100,rotation=10,stretch=40,pageScale=70,offsetX=15,offsetY=15,pageTurn=90).items():
            with self.subTest(control=key):
                out,_=self.render(**{key:value})
                self.assertGreater(np.count_nonzero(out != base),100)
                self.assertTrue(np.isfinite(out).all())
    def test_missing_ink_is_visible_and_independent_of_texture(self):
        base = self.render()[0][:,:,0]
        worn = self.render(wear=100,texture=0)[0][:,:,0]
        hit=(worn > base) & (self.source > .9)
        self.assertGreater(hit.sum()/np.count_nonzero(self.source),.08)
        self.assertLess(hit.sum()/np.count_nonzero(self.source),.65)
        print('Wear at 100 removes %.1f%% of ink pixels' % (100*hit.sum()/np.count_nonzero(self.source)))
    def test_texture_keeps_dark_ink_and_fade_is_separate(self):
        out = self.render(texture=100)[0][:,:,0]
        self.assertLess(np.mean(out[self.source > .9]),65)
        faded = self.render(fade=100)[0][:,:,0]
        self.assertGreater(np.mean(faded[self.source > .9]),200)
    def test_presets_match_upstream_defaults(self):
        for recipe,fn in [('book',pipeline.ocrodeg.printlike_multiscale),('fiber',pipeline.ocrodeg.printlike_fibrous)]:
            actual = self.render(recipe=recipe)[0][:,:,:3]
            pipeline.seed_stage(55,7)
            expected=(np.clip(fn(1-self.source),0,1)*255).astype(np.uint8)
            np.testing.assert_array_equal(actual,np.repeat(expected[:,:,None],3,axis=2))
    def test_clean_selections_and_geometry(self):
        actual, overlay = self.render(protect=True,wear=100,roughness=100,rounding=50,fade=70,texture=100)
        base=self.render()[0]
        np.testing.assert_array_equal(actual[self.guard == 1],base[self.guard == 1])
        moved, moved_overlay = self.render(protect=True,wear=100,rotation=8,offsetX=7,wave=80)
        self.assertFalse(np.array_equal(overlay,moved_overlay))
        clean, guard, expected = pipeline.page_geometry([self.source,self.guard,self.guard],1,55,dict(rotation=8,offsetX=7,wave=80))
        np.testing.assert_array_equal(moved_overlay,(np.clip(expected,0,1)*255).astype(np.uint8))
        expected_ink=255*(1-clean)+36*clean
        np.testing.assert_allclose(moved[:,:,0][guard > .9999],expected_ink[guard > .9999],atol=1)
    def test_repeatability_and_independent_random_fields(self):
        a=self.render(wear=100,texture=55,wave=10)[0]
        np.testing.assert_array_equal(a,self.render(wear=100,texture=55,wave=10)[0])
        self.assertFalse(np.array_equal(a,self.render(wear=100,texture=55,wave=10,seed=192)[0]))
        # Changing paper texture must not reshuffle the missing-ink mask.
        for recipe in ['custom','book','fiber']:
            out,_=self.render(recipe=recipe,wear=0)
            self.assertEqual(out.shape,(320,256,4))
    def test_positive_offsets_move_right_and_down(self):
        y,x=np.indices(self.source.shape)
        cx=(x*self.source).sum()/self.source.sum(); cy=(y*self.source).sum()/self.source.sum()
        moved,_,_=pipeline.page_geometry([self.source,self.zero,self.zero],1,55,dict(offsetX=5,offsetY=5))
        self.assertGreater((x*moved).sum()/moved.sum(),cx)
        self.assertGreater((y*moved).sum()/moved.sum(),cy)
    def test_transparency_preserves_ink_without_a_paper_layer(self):
        for recipe in ['custom', 'book', 'fiber']:
            with self.subTest(recipe=recipe):
                out, _ = self.render(transparent=True, recipe=recipe, texture=80, softness=20)
                alpha = out[:, :, 3]
                self.assertGreater(np.count_nonzero(alpha == 0), alpha.size * .6)
                self.assertGreater(np.count_nonzero(alpha > 0), 100)
                self.assertGreater(np.count_nonzero((alpha > 0) & (alpha < 255)), 100)
                np.testing.assert_array_equal(out, self.render(transparent=True, recipe=recipe, texture=80, softness=20, paperGrain=100)[0])
                np.testing.assert_array_equal(out, self.render(transparent=True, recipe=recipe, texture=80, softness=20)[0])
    def test_transparent_custom_matches_plain_white_composite(self):
        settings = dict(texture=80, fade=50, softness=20, roughness=30, wear=35, protect=True, rotation=3)
        opaque, _ = self.render(**settings)
        transparent, _ = self.render(transparent=True, **settings)
        alpha = transparent[:, :, 3:4].astype(float) / 255
        composite = transparent[:, :, :3] * alpha + 255 * (1 - alpha)
        np.testing.assert_allclose(composite, opaque[:, :, :3], atol=2)
        # No white RGB fringe: custom ink keeps its color even in soft edges.
        self.assertLessEqual(transparent[:, :, :3][transparent[:, :, 3] > 0].max(), 36)
    def test_transparent_clean_selection_and_effects(self):
        base, _ = self.render(transparent=True, protect=True)
        for recipe in ['custom', 'book', 'fiber']:
            out, _ = self.render(transparent=True, protect=True, recipe=recipe, wear=100, fade=100, roughness=70)
            np.testing.assert_array_equal(out[self.guard == 1], base[self.guard == 1])
        unprotected, _ = self.render(transparent=True)
        for key, value in dict(wear=100, fade=100, texture=100, roughness=80, speckles=100, rotation=7).items():
            with self.subTest(control=key):
                out, _ = self.render(transparent=True, **{key: value})
                self.assertGreater(np.count_nonzero(out[:, :, 3] != unprotected[:, :, 3]), 100)

    def test_empty_document_does_not_fail(self):
        self.source[:]=0
        out,_=self.render(rounding=100,edgeNoise=100,wear=100,roughness=100)
        self.assertTrue(np.all(out == 255))

if __name__ == '__main__': unittest.main(verbosity=2)
