"""Run: python -m unittest test_pipeline  (from pipeline/). Checks the maths and the CRS; needs no downloaded data."""
import unittest

import numpy as np

import pipeline as p


class PipelineTests(unittest.TestCase):
    def test_crs_is_moon_not_earth(self):
        self.assertIn("1737400", p.MOON_POLAR.to_proj4())
        # 1 degree of latitude on the Moon is 30.3 km (Earth: 111 km)
        x, y = p.TO_POLAR.transform(0.0, -89.0)
        self.assertAlmostEqual(np.hypot(x, y) / 1000, 30.32, delta=0.05)

    def test_pole_and_longitude(self):
        self.assertAlmostEqual(np.hypot(*p.TO_POLAR.transform(10.0, -90.0)), 0.0, places=3)
        x, y = p.TO_POLAR.transform(90.0, -89.0)  # 90E is +x in south polar stereographic with lon_0=0 up (+y)
        self.assertGreater(x, 0)
        self.assertAlmostEqual(y, 0.0, delta=1)

    def test_slope_of_tilted_plane(self):
        cell = 80.0
        z = np.fromfunction(lambda i, j: j * cell * np.tan(np.radians(10)), (30, 30))
        s = p.slope_deg(z, cell)
        self.assertAlmostEqual(float(np.median(s)), 10.0, places=3)
        self.assertAlmostEqual(float(np.median(p.roughness_deg(s))), 0.0, places=3)  # a plane has no slope variation

    def test_roughness_detects_bumps(self):
        rng = np.random.default_rng(0)
        z = rng.normal(0, 20, (40, 40))
        self.assertGreater(float(np.median(p.roughness_deg(p.slope_deg(z, 80.0)))), 1.0)

    def test_median_requires_coverage(self):
        a = np.full((10, 10), np.nan)
        a[:2] = 5.0
        inside = np.ones_like(a, dtype=bool)
        self.assertIsNone(p.median_in(a, inside)[0])  # only 20% valid -> null, never a number from thin data
        self.assertEqual(p.median_in(np.full((10, 10), 5.0), inside)[0], 5.0)

    def test_config_sane(self):
        ids = [s["siteId"] for s in p.CFG["sites"]]
        self.assertEqual(len(ids), len(set(ids)))
        for s in p.CFG["sites"]:
            self.assertTrue(-90 <= s["lat"] <= -80, s["name"])


if __name__ == "__main__":
    unittest.main()
