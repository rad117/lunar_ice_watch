# Demo CSV files

Upload these on the **Upload** page during a presentation. Every radar, thermal and hazard value here is
made up for demonstration. The crater names are real, and the coordinates are approximate.

| File | What it shows | Expected result |
|------|---------------|-----------------|
| `1_high_confidence_candidates.csv` | Four strong, cold, low-hazard sites | 4 × ICE-SUPPORTED-HIGH |
| `2_mixed_survey_all_outcomes.csv` | One row for each way the evidence engine can decide | HIGH, MODERATE, 2 × UNLIKELY, 2 × INCONCLUSIVE |
| `3_rejected_missing_column.csv` | A file with no `thermalTemp` column | Rejected with a clear error, nothing is saved |

Why each row in file 2 gets its result:

| Row | Result | Reason |
|-----|--------|--------|
| Survey 01 | ICE-SUPPORTED-HIGH | CPR 1.42 and hazard 20%, cold enough, nothing flagged |
| Survey 02 | ICE-SUPPORTED-MODERATE | Good radar, but hazard 44% is too high for HIGH |
| Survey 03 | ICE-UNLIKELY | Strong radar, but -142 °C is too warm: the thermal gate overrides radar |
| Survey 04 | INCONCLUSIVE | Fresh ejecta (`altFlag`) could explain the radar signal |
| Survey 05 | INCONCLUSIVE | Radar too weak (CPR 0.61) |
| Survey 06 | ICE-UNLIKELY | Warm, so the thermal gate fails |

The thermal gate passes below -190 °C.

**After the demo:** run `npm run reset-demo` with `MONGODB_URI` set to remove uploaded sites and return to the
4 kept sites. With `npm run demo`, just stop the server: its data is in memory only.
