# Infotainment benchmark: results

Twin-2K-500 Mega-Study `infotainment` (300 US adults rated 18 news-post cards, 1–7 likelihood to share). See README.md for metric definitions. `ref-*` rows are published Mega-Study twin predictions (reference only); `oracle-*`, `random-*` and `null-*` are code-generated sanity arms.

## val: 60 people, 7 segments with n ≥ 25, 7 real winners (0 differ from the overall winner), 1 real segment gaps

### Segment level

| Arm | Source | Winner acc. (real) | Overall ρ | Card r | Card ρ | Mean MAE | Gap sign (real) | Gap r (key) | Gap scale | Missing |
|---|---|---|---|---|---|---|---|---|---|---|
| null-train-mean | segment | 100% <sub>[100%, 100%]</sub> | 0.87 | 0.94 <sub>[0.92, 0.95]</sub> | 0.86 <sub>[0.82, 0.89]</sub> | 0.30 <sub>[0.24, 0.37]</sub> | 0% | – | 0.00 | 0 |
| oracle-segment | segment | 100% <sub>[100%, 100%]</sub> | 1.00 | 1.00 <sub>[1.00, 1.00]</sub> | 1.00 <sub>[1.00, 1.00]</sub> | 0.00 <sub>[0.00, 0.00]</sub> | 100% | 1.00 | 1.00 | 0 |
| oracle-twin | twins | 100% <sub>[100%, 100%]</sub> | 1.00 | 1.00 <sub>[1.00, 1.00]</sub> | 1.00 <sub>[1.00, 1.00]</sub> | 0.00 <sub>[0.00, 0.00]</sub> | 100% | 1.00 | 1.00 | 0 |
| random-segment | segment | 43% <sub>[14%, 86%]</sub> | -0.15 | -0.03 <sub>[-0.17, 0.11]</sub> | -0.10 <sub>[-0.25, 0.05]</sub> | 1.83 <sub>[1.53, 2.17]</sub> | 100% | 0.19 | 3.63 | 0 |
| random-twin | twins | 0% <sub>[0%, 0%]</sub> | -0.38 | -0.11 <sub>[-0.24, -0.00]</sub> | -0.26 <sub>[-0.36, -0.15]</sub> | 1.44 <sub>[1.36, 1.53]</sub> | 100% | -0.02 | 0.34 | 0 |
| ref-gemini3pro-full-persona | twins | 100% <sub>[100%, 100%]</sub> | 0.75 | 0.84 <sub>[0.81, 0.86]</sub> | 0.73 <sub>[0.69, 0.76]</sub> | 0.54 <sub>[0.48, 0.60]</sub> | 100% | 0.43 | 0.71 | 0 |
| ref-gpt41-demographics-only | twins | 100% <sub>[100%, 100%]</sub> | 0.78 | 0.74 <sub>[0.71, 0.76]</sub> | 0.77 <sub>[0.74, 0.80]</sub> | 0.64 <sub>[0.57, 0.72]</sub> | 100% | 0.63 | 1.07 | 0 |
| ref-gpt41-empty-persona | twins | 100% <sub>[100%, 100%]</sub> | 0.42 | 0.30 <sub>[0.26, 0.35]</sub> | 0.40 <sub>[0.36, 0.44]</sub> | 1.58 <sub>[1.53, 1.65]</sub> | 0% | -0.61 | -0.14 | 0 |
| ref-gpt41-full-persona | twins | 100% <sub>[100%, 100%]</sub> | 0.64 | 0.57 <sub>[0.52, 0.62]</sub> | 0.61 <sub>[0.57, 0.66]</sub> | 0.61 <sub>[0.54, 0.69]</sub> | 100% | 0.68 | 0.73 | 0 |
| ref-gpt41-persona-summary | twins | 100% <sub>[100%, 100%]</sub> | 0.71 | 0.71 <sub>[0.69, 0.73]</sub> | 0.72 <sub>[0.69, 0.76]</sub> | 0.54 <sub>[0.48, 0.61]</sub> | 100% | 0.48 | 1.15 | 0 |
| ref-gpt5-full-persona | twins | 100% <sub>[100%, 100%]</sub> | 0.32 | 0.40 <sub>[0.37, 0.42]</sub> | 0.35 <sub>[0.30, 0.40]</sub> | 1.26 <sub>[1.18, 1.37]</sub> | 100% | -0.14 | 0.26 | 0 |
| sonnet-persona-demo | twins | 100% <sub>[100%, 100%]</sub> | 0.80 | 0.89 <sub>[0.88, 0.91]</sub> | 0.80 <sub>[0.76, 0.84]</sub> | 0.33 <sub>[0.27, 0.39]</sub> | 100% | -0.04 | 0.45 | 0 |
| vanilla-opus-high | segment | 100% <sub>[100%, 100%]</sub> | 0.77 | 0.78 <sub>[0.72, 0.83]</sub> | 0.70 <sub>[0.66, 0.74]</sub> | 0.52 <sub>[0.47, 0.59]</sub> | 100% | 0.52 | 0.35 | 0 |

Chance winner accuracy: 25%.

### Real segment gaps: truth vs predicted (A minus B)

| Arm | edu-degree − edu-nodegree contrast:lean:liberal-conservative |
|---|---|
| *truth* | +0.57 <sub>[+0.15, +1.05]</sub> |
| null-train-mean | +0.00 |
| oracle-segment | +0.57 |
| oracle-twin | +0.57 |
| random-segment | +2.07 |
| random-twin | +0.19 |
| ref-gemini3pro-full-persona | +0.41 |
| ref-gpt41-demographics-only | +0.61 |
| ref-gpt41-empty-persona | -0.08 |
| ref-gpt41-full-persona | +0.41 |
| ref-gpt41-persona-summary | +0.66 |
| ref-gpt5-full-persona | +0.15 |
| sonnet-persona-demo | +0.25 |
| vanilla-opus-high | +0.20 |

### Individual level (twin task)

| Arm | MAE | Within-person r | Pooled r | SD ratio (pred/true) |
|---|---|---|---|---|
| null-train-mean | 1.52 <sub>[1.39, 1.65]</sub> | 0.48 <sub>[0.37, 0.58]</sub> (n=50) | 0.34 | 0.26 |
| oracle-twin | 0.00 <sub>[0.00, 0.00]</sub> | 1.00 <sub>[1.00, 1.00]</sub> (n=50) | 1.00 | 1.00 |
| random-twin | 2.49 <sub>[2.36, 2.62]</sub> | -0.00 <sub>[-0.07, 0.06]</sub> (n=50) | -0.01 | 1.04 |
| ref-gemini3pro-full-persona | 1.56 <sub>[1.34, 1.82]</sub> | 0.41 <sub>[0.34, 0.49]</sub> (n=46) | 0.22 | 0.86 |
| ref-gpt41-demographics-only | 1.69 <sub>[1.55, 1.84]</sub> | 0.32 <sub>[0.24, 0.39]</sub> (n=50) | 0.20 | 0.64 |
| ref-gpt41-empty-persona | 2.15 <sub>[1.99, 2.31]</sub> | 0.14 <sub>[0.07, 0.21]</sub> (n=50) | 0.12 | 0.63 |
| ref-gpt41-full-persona | 1.59 <sub>[1.45, 1.73]</sub> | 0.27 <sub>[0.20, 0.34]</sub> (n=50) | 0.25 | 0.57 |
| ref-gpt41-persona-summary | 1.59 <sub>[1.45, 1.73]</sub> | 0.32 <sub>[0.24, 0.39]</sub> (n=50) | 0.25 | 0.62 |
| ref-gpt5-full-persona | 1.98 <sub>[1.82, 2.13]</sub> | 0.22 <sub>[0.14, 0.29]</sub> (n=50) | 0.20 | 0.80 |
| sonnet-persona-demo | 1.52 <sub>[1.38, 1.68]</sub> | 0.43 <sub>[0.35, 0.50]</sub> (n=50) | 0.21 | 0.54 |

## test: 120 people, 18 segments with n ≥ 25, 22 real winners (0 differ from the overall winner), 2 real segment gaps

### Segment level

| Arm | Source | Winner acc. (real) | Overall ρ | Card r | Card ρ | Mean MAE | Gap sign (real) | Gap r (key) | Gap scale | Missing |
|---|---|---|---|---|---|---|---|---|---|---|
| null-train-mean | segment | 95% <sub>[86%, 100%]</sub> | 0.88 | 0.94 <sub>[0.92, 0.95]</sub> | 0.84 <sub>[0.81, 0.87]</sub> | 0.23 <sub>[0.19, 0.27]</sub> | 0% <sub>[0%, 0%]</sub> | – | 0.00 | 0 |
| oracle-segment | segment | 100% <sub>[100%, 100%]</sub> | 1.00 | 1.00 <sub>[1.00, 1.00]</sub> | 1.00 <sub>[1.00, 1.00]</sub> | 0.00 <sub>[0.00, 0.00]</sub> | 100% <sub>[100%, 100%]</sub> | 1.00 | 1.00 | 0 |
| oracle-twin | twins | 100% <sub>[100%, 100%]</sub> | 1.00 | 1.00 <sub>[1.00, 1.00]</sub> | 1.00 <sub>[1.00, 1.00]</sub> | 0.00 <sub>[0.00, 0.00]</sub> | 100% <sub>[100%, 100%]</sub> | 1.00 | 1.00 | 0 |
| random-segment | segment | 41% <sub>[23%, 64%]</sub> | 0.08 | -0.00 <sub>[-0.11, 0.10]</sub> | -0.01 <sub>[-0.12, 0.08]</sub> | 1.72 <sub>[1.58, 1.88]</sub> | 0% <sub>[0%, 0%]</sub> | 0.02 | -1.55 | 0 |
| random-twin | twins | 14% <sub>[0%, 27%]</sub> | -0.24 | -0.14 <sub>[-0.25, -0.03]</sub> | -0.15 <sub>[-0.27, -0.03]</sub> | 1.16 <sub>[1.08, 1.23]</sub> | 100% <sub>[100%, 100%]</sub> | 0.27 | 0.42 | 0 |
| ref-gemini3pro-full-persona | twins | 100% <sub>[100%, 100%]</sub> | 0.84 | 0.82 <sub>[0.79, 0.84]</sub> | 0.82 <sub>[0.78, 0.85]</sub> | 0.74 <sub>[0.68, 0.83]</sub> | 100% <sub>[100%, 100%]</sub> | 0.49 | 7.72 | 0 |
| ref-gpt41-demographics-only | twins | 100% <sub>[100%, 100%]</sub> | 0.90 | 0.71 <sub>[0.65, 0.76]</sub> | 0.75 <sub>[0.68, 0.81]</sub> | 0.54 <sub>[0.45, 0.63]</sub> | 100% <sub>[100%, 100%]</sub> | 0.52 | 13.41 | 0 |
| ref-gpt41-empty-persona | twins | 100% <sub>[100%, 100%]</sub> | 0.65 | 0.49 <sub>[0.47, 0.52]</sub> | 0.60 <sub>[0.57, 0.62]</sub> | 1.34 <sub>[1.28, 1.39]</sub> | 100% <sub>[100%, 100%]</sub> | 0.28 | 0.05 | 0 |
| ref-gpt41-full-persona | twins | 100% <sub>[100%, 100%]</sub> | 0.81 | 0.64 <sub>[0.62, 0.66]</sub> | 0.73 <sub>[0.70, 0.76]</sub> | 0.50 <sub>[0.46, 0.54]</sub> | 100% <sub>[100%, 100%]</sub> | 0.51 | 5.55 | 0 |
| ref-gpt41-persona-summary | twins | 100% <sub>[100%, 100%]</sub> | 0.87 | 0.73 <sub>[0.68, 0.77]</sub> | 0.75 <sub>[0.70, 0.80]</sub> | 0.46 <sub>[0.39, 0.54]</sub> | 100% <sub>[100%, 100%]</sub> | 0.47 | 10.67 | 0 |
| ref-gpt5-full-persona | twins | 100% <sub>[100%, 100%]</sub> | 0.60 | 0.52 <sub>[0.49, 0.55]</sub> | 0.56 <sub>[0.52, 0.60]</sub> | 1.18 <sub>[1.11, 1.26]</sub> | 100% <sub>[100%, 100%]</sub> | 0.48 | 4.63 | 0 |
| sonnet-persona-demo | twins | 100% <sub>[100%, 100%]</sub> | 0.90 | 0.86 <sub>[0.83, 0.89]</sub> | 0.83 <sub>[0.79, 0.87]</sub> | 0.34 <sub>[0.27, 0.43]</sub> | 100% <sub>[100%, 100%]</sub> | 0.40 | 6.66 | 0 |
| vanilla-opus-high | segment | 95% <sub>[86%, 100%]</sub> | 0.93 | 0.83 <sub>[0.79, 0.87]</sub> | 0.82 <sub>[0.77, 0.85]</sub> | 0.33 <sub>[0.29, 0.36]</sub> | 100% <sub>[100%, 100%]</sub> | 0.68 | 3.77 | 0 |

Chance winner accuracy: 27%.

### Real segment gaps: truth vs predicted (A minus B)

| Arm | party-rep − party-dem contrast:lean:liberal-conservative | ideo-con − ideo-lib contrast:lean:liberal-conservative |
|---|---|---|
| *truth* | -0.28 <sub>[-0.50, -0.09]</sub> | -0.31 <sub>[-0.53, -0.11]</sub> |
| null-train-mean | +0.00 | +0.00 |
| oracle-segment | -0.28 | -0.31 |
| oracle-twin | -0.28 | -0.31 |
| random-segment | +0.64 | +0.27 |
| random-twin | -0.11 | -0.13 |
| ref-gemini3pro-full-persona | -2.12 | -2.42 |
| ref-gpt41-demographics-only | -3.79 | -4.10 |
| ref-gpt41-empty-persona | -0.01 | -0.02 |
| ref-gpt41-full-persona | -1.59 | -1.67 |
| ref-gpt41-persona-summary | -3.05 | -3.23 |
| ref-gpt5-full-persona | -1.33 | -1.39 |
| sonnet-persona-demo | -1.88 | -2.04 |
| vanilla-opus-high | -0.97 | -1.25 |

### Individual level (twin task)

| Arm | MAE | Within-person r | Pooled r | SD ratio (pred/true) |
|---|---|---|---|---|
| null-train-mean | 1.55 <sub>[1.43, 1.67]</sub> | 0.43 <sub>[0.35, 0.51]</sub> (n=101) | 0.26 | 0.25 |
| oracle-twin | 0.00 <sub>[0.00, 0.00]</sub> | 1.00 <sub>[1.00, 1.00]</sub> (n=101) | 1.00 | 1.00 |
| random-twin | 2.41 <sub>[2.33, 2.50]</sub> | -0.03 <sub>[-0.07, 0.02]</sub> (n=101) | 0.00 | 1.06 |
| ref-gemini3pro-full-persona | 1.67 <sub>[1.50, 1.86]</sub> | 0.33 <sub>[0.27, 0.39]</sub> (n=96) | 0.18 | 0.83 |
| ref-gpt41-demographics-only | 1.72 <sub>[1.62, 1.83]</sub> | 0.27 <sub>[0.21, 0.32]</sub> (n=101) | 0.16 | 0.64 |
| ref-gpt41-empty-persona | 2.06 <sub>[1.95, 2.18]</sub> | 0.22 <sub>[0.16, 0.27]</sub> (n=101) | 0.12 | 0.64 |
| ref-gpt41-full-persona | 1.53 <sub>[1.43, 1.64]</sub> | 0.26 <sub>[0.21, 0.32]</sub> (n=101) | 0.28 | 0.59 |
| ref-gpt41-persona-summary | 1.60 <sub>[1.50, 1.71]</sub> | 0.28 <sub>[0.22, 0.34]</sub> (n=101) | 0.23 | 0.61 |
| ref-gpt5-full-persona | 1.93 <sub>[1.80, 2.06]</sub> | 0.25 <sub>[0.20, 0.30]</sub> (n=101) | 0.21 | 0.79 |
| sonnet-persona-demo | 1.56 <sub>[1.43, 1.71]</sub> | 0.33 <sub>[0.27, 0.40]</sub> (n=101) | 0.20 | 0.51 |

