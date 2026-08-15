#!/usr/bin/env python3
import importlib.util
import unittest
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("build_calendar", ROOT / "scripts" / "build_calendar.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class WeekOccupancyTest(unittest.TestCase):
    def test_counts_unique_weekdays_like_megainternet(self):
        bucket = {}
        for day in (date(2026, 8, 10), date(2026, 8, 11), date(2026, 8, 12), date(2026, 8, 13), date(2026, 8, 14)):
            mod.add_day(bucket, day, "дизайн")
        self.assertEqual(mod.finalize_weeks(bucket), {"2026-08-10": "5"})

    def test_partial_week_counts_occupied_days_only(self):
        bucket = {}
        mod.add_day(bucket, date(2026, 8, 3), "дизайн")
        mod.add_day(bucket, date(2026, 8, 4), "дизайн")
        self.assertEqual(mod.finalize_weeks(bucket), {"2026-08-03": "2"})

    def test_vacation_week_stays_otpusk(self):
        bucket = {}
        mod.add_day(bucket, date(2026, 8, 17), "отпуск")
        mod.add_day(bucket, date(2026, 8, 18), "отпуск")
        mod.add_day(bucket, date(2026, 8, 19), "отпуск")
        self.assertEqual(mod.finalize_weeks(bucket), {"2026-08-17": "отпуск"})

    def test_mixed_week_counts_work_days(self):
        bucket = {}
        mod.add_day(bucket, date(2026, 8, 17), "SA")
        mod.add_day(bucket, date(2026, 8, 18), "SA")
        mod.add_day(bucket, date(2026, 8, 19), "отпуск")
        self.assertEqual(mod.finalize_weeks(bucket), {"2026-08-17": "2"})

    def test_skips_weekends(self):
        bucket = {}
        mod.add_day(bucket, date(2026, 8, 14), "FE")
        mod.add_day(bucket, date(2026, 8, 15), "FE")
        mod.add_day(bucket, date(2026, 8, 16), "FE")
        self.assertEqual(mod.finalize_weeks(bucket), {"2026-08-10": "1"})

    def test_occupancy_cell_normalizes_notes(self):
        self.assertEqual(mod.occupancy_cell("2"), "2")
        self.assertEqual(mod.occupancy_cell("3 на ресайзы"), "3")
        self.assertEqual(mod.occupancy_cell("отпуск"), "отпуск")
        self.assertEqual(mod.occupancy_cell("отпуск Лера"), "отпуск")
        self.assertEqual(mod.occupancy_cell("старт РК 21.09"), "1")


if __name__ == "__main__":
    unittest.main()
