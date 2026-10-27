# Infotainment benchmark: ground truth summary (scorer-only, never put this in a prompt)

Segments are scored in a split only when n ≥ 25. "Real" = 95% bootstrap CI excludes 0 and Benjamini–Hochberg q < 0.1 within the split. Families: winner tests; key gap tests (level, contrast:lean:, contrast:content:); exploratory gap tests (every other card/contrast). The "all" section pools every split and is a reference only (never scored).

| Segment | Description | n train | n val | n test | n all |
|---|---|---|---|---|---|
| all | US adults | 120 | 60 | 120 | 300 |
| party-rep | US adults who identify as Republicans | 40 | (20) | 41 | 101 |
| party-dem | US adults who identify as Democrats | 44 | (22) | 42 | 108 |
| party-ind | US adults who identify as Independents | 34 | (17) | 35 | 86 |
| ideo-con | US adults whose political views are conservative or very conservative | 46 | (22) | 38 | 106 |
| ideo-mod | US adults whose political views are moderate | 28 | (16) | 40 | 84 |
| ideo-lib | US adults whose political views are liberal or very liberal | 46 | (22) | 42 | 110 |
| age-18-49 | US adults aged 18 to 49 | 49 | (23) | 46 | 118 |
| age-50plus | US adults aged 50 or older | 71 | 37 | 74 | 182 |
| sex-male | US adult men | 68 | 33 | 64 | 165 |
| sex-female | US adult women | 52 | 27 | 56 | 135 |
| edu-degree | US adults with a four-year college degree or more | 43 | 34 | 63 | 140 |
| edu-nodegree | US adults without a four-year college degree | 77 | 26 | 57 | 160 |
| inc-under50k | US adults with family income under $50,000 a year | 54 | (20) | 41 | 115 |
| inc-50-100k | US adults with family income of $50,000 to $100,000 a year | 39 | (20) | 38 | 97 |
| inc-100kplus | US adults with family income of $100,000 a year or more | 27 | (20) | 41 | 88 |
| race-white | White US adults | 88 | 42 | 87 | 217 |
| race-nonwhite | US adults who are Black, Asian, Hispanic or another non-White race | 32 | (18) | 33 | 83 |

Parenthesized n: too small, not scored in that split.

## train (120 people)

Overall ranking (all 120): c11 3.63, c02 3.48, c05 3.38, c06 3.22, c14 3.09, c12 2.77, c16 2.74, c15 2.64, c07 2.57, c13 2.55, c03 2.45, c10 2.41, c09 2.29, c17 2.21, c01 2.17, c08 2.17, c18 2.16, c04 2.15

### Real winners (20 of 162 segment × choice-set tests)

| Segment | Choice set | Winner | Runner-up | Diff [95% CI] | q |
|---|---|---|---|---|---|
| all | attr:headline | Two Elderly Men Sneak Out Of Nursing Home To Attend Heavy Metal Festival | Kansas Man Asks Judge To Allow Him To Have Sword Fight With Ex-Wife | +0.66 [+0.37, +0.94] | 0.001 |
| all | attr:content | Informative | Entertaining | +0.10 [+0.04, +0.16] | 0.016 |
| all | posts:h1 | c13 | c09 | +0.26 [+0.06, +0.47] | 0.097 |
| party-dem | attr:headline | Two Elderly Men Sneak Out Of Nursing Home To Attend Heavy Metal Festival | Kansas Man Asks Judge To Allow Him To Have Sword Fight With Ex-Wife | +0.85 [+0.29, +1.46] | 0.045 |
| party-dem | attr:content | Informative | Entertaining | +0.14 [+0.05, +0.24] | 0.052 |
| party-ind | attr:headline | Two Elderly Men Sneak Out Of Nursing Home To Attend Heavy Metal Festival | Kansas Man Asks Judge To Allow Him To Have Sword Fight With Ex-Wife | +0.69 [+0.23, +1.20] | 0.052 |
| ideo-con | attr:content | Informative | Entertaining | +0.11 [+0.03, +0.19] | 0.057 |
| ideo-con | attr:lean | Conservative | Liberal | +0.40 [+0.17, +0.73] | 0.057 |
| ideo-lib | attr:headline | Two Elderly Men Sneak Out Of Nursing Home To Attend Heavy Metal Festival | Kansas Man Asks Judge To Allow Him To Have Sword Fight With Ex-Wife | +1.11 [+0.59, +1.65] | 0.002 |
| ideo-lib | attr:content | Informative | Entertaining | +0.11 [+0.03, +0.19] | 0.069 |
| age-50plus | attr:headline | Two Elderly Men Sneak Out Of Nursing Home To Attend Heavy Metal Festival | Kansas Man Asks Judge To Allow Him To Have Sword Fight With Ex-Wife | +1.00 [+0.64, +1.37] | 0.000 |
| age-50plus | attr:content | Informative | Entertaining | +0.11 [+0.04, +0.18] | 0.028 |
| sex-male | attr:content | Informative | Entertaining | +0.15 [+0.08, +0.24] | 0.006 |
| sex-female | attr:headline | Two Elderly Men Sneak Out Of Nursing Home To Attend Heavy Metal Festival | Applications To Become Japanese Billionaire Yusaku Maezawa's Girlfriend Have Topped 20,000 | +0.77 [+0.32, +1.21] | 0.012 |
| edu-degree | attr:headline | Two Elderly Men Sneak Out Of Nursing Home To Attend Heavy Metal Festival | Kansas Man Asks Judge To Allow Him To Have Sword Fight With Ex-Wife | +0.70 [+0.23, +1.22] | 0.057 |
| edu-nodegree | attr:headline | Two Elderly Men Sneak Out Of Nursing Home To Attend Heavy Metal Festival | Kansas Man Asks Judge To Allow Him To Have Sword Fight With Ex-Wife | +0.64 [+0.28, +1.01] | 0.012 |
| edu-nodegree | attr:content | Informative | Entertaining | +0.12 [+0.04, +0.20] | 0.055 |
| inc-50-100k | attr:headline | Two Elderly Men Sneak Out Of Nursing Home To Attend Heavy Metal Festival | Kansas Man Asks Judge To Allow Him To Have Sword Fight With Ex-Wife | +0.98 [+0.46, +1.53] | 0.008 |
| race-white | attr:headline | Two Elderly Men Sneak Out Of Nursing Home To Attend Heavy Metal Festival | Kansas Man Asks Judge To Allow Him To Have Sword Fight With Ex-Wife | +0.68 [+0.34, +1.05] | 0.006 |
| race-white | attr:content | Informative | Entertaining | +0.10 [+0.05, +0.17] | 0.012 |

### Real segment gaps (2/21 key, 1/231 exploratory)

| Segment A − B | Family | Quantity | Gap [95% CI] | p | q |
|---|---|---|---|---|---|
| party-rep − party-dem | key | Political lean: Liberal minus Conservative | -0.51 [-0.92, -0.20] | 0.005 | 0.050 |
| ideo-con − ideo-lib | key | Political lean: Liberal minus Conservative | -0.54 [-0.89, -0.25] | 0.001 | 0.022 |
| ideo-con − ideo-lib | exploratory | card:c01 | +1.22 [+0.67, +1.72] | 0.000 | 0.001 |

Key gaps with unadjusted p < 0.05 that did not survive correction: age-18-49 − age-50plus level +0.53 (p 0.036); sex-male − sex-female contrast:content:informative-entertaining +0.13 (p 0.031)

## val (60 people)

Overall ranking (all 60): c02 3.85, c05 3.75, c11 3.73, c06 3.37, c14 3.15, c07 2.58, c12 2.50, c15 2.38, c13 2.35, c16 2.33, c01 2.23, c04 2.18, c09 2.10, c03 2.05, c18 2.03, c10 2.00, c17 1.93, c08 1.78

### Real winners (7 of 63 segment × choice-set tests)

| Segment | Choice set | Winner | Runner-up | Diff [95% CI] | q |
|---|---|---|---|---|---|
| all | attr:headline | Two Elderly Men Sneak Out Of Nursing Home To Attend Heavy Metal Festival | Kansas Man Asks Judge To Allow Him To Have Sword Fight With Ex-Wife | +1.11 [+0.69, +1.57] | 0.000 |
| age-50plus | attr:headline | Two Elderly Men Sneak Out Of Nursing Home To Attend Heavy Metal Festival | Kansas Man Asks Judge To Allow Him To Have Sword Fight With Ex-Wife | +1.40 [+0.82, +2.03] | 0.000 |
| sex-male | attr:headline | Two Elderly Men Sneak Out Of Nursing Home To Attend Heavy Metal Festival | Kansas Man Asks Judge To Allow Him To Have Sword Fight With Ex-Wife | +0.64 [+0.18, +1.15] | 0.085 |
| sex-female | attr:headline | Two Elderly Men Sneak Out Of Nursing Home To Attend Heavy Metal Festival | Kansas Man Asks Judge To Allow Him To Have Sword Fight With Ex-Wife | +1.68 [+1.00, +2.46] | 0.000 |
| edu-degree | attr:headline | Two Elderly Men Sneak Out Of Nursing Home To Attend Heavy Metal Festival | Kansas Man Asks Judge To Allow Him To Have Sword Fight With Ex-Wife | +0.81 [+0.34, +1.37] | 0.016 |
| edu-nodegree | attr:headline | Two Elderly Men Sneak Out Of Nursing Home To Attend Heavy Metal Festival | Kansas Man Asks Judge To Allow Him To Have Sword Fight With Ex-Wife | +1.50 [+0.73, +2.31] | 0.002 |
| race-white | attr:headline | Two Elderly Men Sneak Out Of Nursing Home To Attend Heavy Metal Festival | Kansas Man Asks Judge To Allow Him To Have Sword Fight With Ex-Wife | +1.27 [+0.75, +1.84] | 0.000 |

### Real segment gaps (1/6 key, 0/66 exploratory)

| Segment A − B | Family | Quantity | Gap [95% CI] | p | q |
|---|---|---|---|---|---|
| edu-degree − edu-nodegree | key | Political lean: Liberal minus Conservative | +0.57 [+0.15, +1.05] | 0.015 | 0.088 |

## test (120 people)

Overall ranking (all 120): c11 3.68, c02 3.64, c05 3.56, c06 3.52, c14 3.39, c12 2.81, c15 2.69, c13 2.67, c16 2.66, c04 2.56, c10 2.55, c07 2.50, c03 2.45, c18 2.43, c09 2.38, c01 2.33, c17 2.23, c08 2.11

### Real winners (22 of 162 segment × choice-set tests)

| Segment | Choice set | Winner | Runner-up | Diff [95% CI] | q |
|---|---|---|---|---|---|
| all | attr:headline | Two Elderly Men Sneak Out Of Nursing Home To Attend Heavy Metal Festival | Kansas Man Asks Judge To Allow Him To Have Sword Fight With Ex-Wife | +0.87 [+0.58, +1.17] | 0.000 |
| all | attr:likes | 2000 | 200 | +0.11 [+0.04, +0.19] | 0.046 |
| party-rep | attr:likes | 2000 | 200 | +0.20 [+0.06, +0.35] | 0.051 |
| party-dem | attr:headline | Two Elderly Men Sneak Out Of Nursing Home To Attend Heavy Metal Festival | Kansas Man Asks Judge To Allow Him To Have Sword Fight With Ex-Wife | +0.88 [+0.46, +1.32] | 0.001 |
| party-ind | attr:headline | Two Elderly Men Sneak Out Of Nursing Home To Attend Heavy Metal Festival | Kansas Man Asks Judge To Allow Him To Have Sword Fight With Ex-Wife | +1.16 [+0.59, +1.77] | 0.001 |
| ideo-con | attr:likes | 2000 | 200 | +0.26 [+0.11, +0.43] | 0.013 |
| ideo-con | posts:h3 | c10 | c03 | +0.45 [+0.16, +0.76] | 0.037 |
| ideo-mod | attr:headline | Two Elderly Men Sneak Out Of Nursing Home To Attend Heavy Metal Festival | Kansas Man Asks Judge To Allow Him To Have Sword Fight With Ex-Wife | +1.08 [+0.58, +1.65] | 0.001 |
| ideo-lib | attr:headline | Two Elderly Men Sneak Out Of Nursing Home To Attend Heavy Metal Festival | Kansas Man Asks Judge To Allow Him To Have Sword Fight With Ex-Wife | +0.95 [+0.49, +1.47] | 0.001 |
| age-18-49 | attr:headline | Two Elderly Men Sneak Out Of Nursing Home To Attend Heavy Metal Festival | Kansas Man Asks Judge To Allow Him To Have Sword Fight With Ex-Wife | +0.50 [+0.11, +0.92] | 0.096 |
| age-50plus | attr:headline | Two Elderly Men Sneak Out Of Nursing Home To Attend Heavy Metal Festival | Kansas Man Asks Judge To Allow Him To Have Sword Fight With Ex-Wife | +1.11 [+0.72, +1.50] | 0.000 |
| sex-male | attr:headline | Two Elderly Men Sneak Out Of Nursing Home To Attend Heavy Metal Festival | Kansas Man Asks Judge To Allow Him To Have Sword Fight With Ex-Wife | +0.83 [+0.46, +1.22] | 0.001 |
| sex-female | attr:headline | Two Elderly Men Sneak Out Of Nursing Home To Attend Heavy Metal Festival | Kansas Man Asks Judge To Allow Him To Have Sword Fight With Ex-Wife | +0.93 [+0.55, +1.38] | 0.000 |
| edu-degree | attr:headline | Two Elderly Men Sneak Out Of Nursing Home To Attend Heavy Metal Festival | Authorities Scramble To Find Stolen Solid Gold Toilet | +0.66 [+0.38, +0.97] | 0.000 |
| edu-degree | attr:likes | 2000 | 200 | +0.14 [+0.05, +0.22] | 0.027 |
| edu-nodegree | attr:headline | Two Elderly Men Sneak Out Of Nursing Home To Attend Heavy Metal Festival | Kansas Man Asks Judge To Allow Him To Have Sword Fight With Ex-Wife | +1.03 [+0.54, +1.52] | 0.001 |
| inc-under50k | attr:headline | Two Elderly Men Sneak Out Of Nursing Home To Attend Heavy Metal Festival | Kansas Man Asks Judge To Allow Him To Have Sword Fight With Ex-Wife | +1.07 [+0.57, +1.63] | 0.001 |
| inc-50-100k | attr:headline | Two Elderly Men Sneak Out Of Nursing Home To Attend Heavy Metal Festival | Kansas Man Asks Judge To Allow Him To Have Sword Fight With Ex-Wife | +0.67 [+0.21, +1.14] | 0.051 |
| inc-50-100k | attr:source | BBC News | PBS News | +0.14 [+0.05, +0.25] | 0.030 |
| inc-100kplus | attr:headline | Two Elderly Men Sneak Out Of Nursing Home To Attend Heavy Metal Festival | Applications To Become Japanese Billionaire Yusaku Maezawa's Girlfriend Have Topped 20,000 | +0.72 [+0.31, +1.16] | 0.013 |
| inc-100kplus | attr:likes | 2000 | 200 | +0.16 [+0.04, +0.28] | 0.076 |
| race-white | attr:headline | Two Elderly Men Sneak Out Of Nursing Home To Attend Heavy Metal Festival | Kansas Man Asks Judge To Allow Him To Have Sword Fight With Ex-Wife | +1.00 [+0.69, +1.36] | 0.000 |

### Real segment gaps (2/21 key, 0/231 exploratory)

| Segment A − B | Family | Quantity | Gap [95% CI] | p | q |
|---|---|---|---|---|---|
| party-rep − party-dem | key | Political lean: Liberal minus Conservative | -0.28 [-0.50, -0.09] | 0.008 | 0.082 |
| ideo-con − ideo-lib | key | Political lean: Liberal minus Conservative | -0.31 [-0.53, -0.11] | 0.004 | 0.082 |

## Full sample (reference only, not scored) (300 people)

Overall ranking (all 300): c11 3.67, c02 3.62, c05 3.52, c06 3.37, c14 3.22, c12 2.73, c16 2.63, c15 2.61, c13 2.56, c07 2.54, c10 2.38, c03 2.37, c04 2.32, c09 2.29, c01 2.24, c18 2.24, c17 2.16, c08 2.07

### Real winners (56 of 162 segment × choice-set tests)

| Segment | Choice set | Winner | Runner-up | Diff [95% CI] | q |
|---|---|---|---|---|---|
| all | attr:headline | Two Elderly Men Sneak Out Of Nursing Home To Attend Heavy Metal Festival | Kansas Man Asks Judge To Allow Him To Have Sword Fight With Ex-Wife | +0.84 [+0.64, +1.03] | 0.000 |
| all | attr:content | Informative | Entertaining | +0.06 [+0.02, +0.10] | 0.021 |
| all | attr:likes | 2000 | 200 | +0.09 [+0.04, +0.14] | 0.003 |
| all | posts:h1 | c13 | c04 | +0.24 [+0.11, +0.38] | 0.005 |
| party-rep | attr:headline | Two Elderly Men Sneak Out Of Nursing Home To Attend Heavy Metal Festival | Kansas Man Asks Judge To Allow Him To Have Sword Fight With Ex-Wife | +0.57 [+0.27, +0.90] | 0.003 |
| party-rep | attr:source | BBC News | PBS News | +0.11 [+0.02, +0.20] | 0.063 |
| party-rep | attr:lean | Conservative | Liberal | +0.34 [+0.19, +0.52] | 0.001 |
| party-dem | attr:headline | Two Elderly Men Sneak Out Of Nursing Home To Attend Heavy Metal Festival | Kansas Man Asks Judge To Allow Him To Have Sword Fight With Ex-Wife | +0.86 [+0.55, +1.16] | 0.000 |
| party-dem | attr:content | Informative | Entertaining | +0.08 [+0.02, +0.14] | 0.057 |
| party-dem | attr:lean | Liberal | Conservative | +0.15 [+0.05, +0.27] | 0.034 |
| party-dem | posts:h2 | c02 | c11 | +0.25 [+0.06, +0.45] | 0.047 |
| party-dem | posts:h4 | c12 | c15 | +0.15 [+0.02, +0.28] | 0.063 |
| party-ind | attr:headline | Two Elderly Men Sneak Out Of Nursing Home To Attend Heavy Metal Festival | Kansas Man Asks Judge To Allow Him To Have Sword Fight With Ex-Wife | +1.10 [+0.78, +1.50] | 0.000 |
| party-ind | attr:likes | 2000 | 200 | +0.11 [+0.02, +0.21] | 0.086 |
| ideo-con | attr:headline | Two Elderly Men Sneak Out Of Nursing Home To Attend Heavy Metal Festival | Kansas Man Asks Judge To Allow Him To Have Sword Fight With Ex-Wife | +0.61 [+0.32, +0.91] | 0.001 |
| ideo-con | attr:source | BBC News | PBS News | +0.10 [+0.02, +0.19] | 0.063 |
| ideo-con | attr:lean | Conservative | Liberal | +0.35 [+0.21, +0.53] | 0.000 |
| ideo-mod | attr:headline | Two Elderly Men Sneak Out Of Nursing Home To Attend Heavy Metal Festival | Kansas Man Asks Judge To Allow Him To Have Sword Fight With Ex-Wife | +0.92 [+0.55, +1.29] | 0.000 |
| ideo-mod | posts:h1 | c13 | c18 | +0.25 [+0.06, +0.45] | 0.049 |
| ideo-lib | attr:headline | Two Elderly Men Sneak Out Of Nursing Home To Attend Heavy Metal Festival | Kansas Man Asks Judge To Allow Him To Have Sword Fight With Ex-Wife | +0.99 [+0.67, +1.32] | 0.000 |
| ideo-lib | attr:lean | Liberal | Conservative | +0.16 [+0.07, +0.28] | 0.017 |
| ideo-lib | posts:h2 | c02 | c06 | +0.27 [+0.10, +0.47] | 0.024 |
| ideo-lib | posts:h4 | c12 | c15 | +0.14 [+0.02, +0.26] | 0.086 |
| age-18-49 | attr:headline | Two Elderly Men Sneak Out Of Nursing Home To Attend Heavy Metal Festival | Kansas Man Asks Judge To Allow Him To Have Sword Fight With Ex-Wife | +0.39 [+0.13, +0.67] | 0.023 |
| age-18-49 | attr:content | Informative | Entertaining | +0.07 [+0.01, +0.13] | 0.094 |
| age-18-49 | attr:likes | 2000 | 200 | +0.11 [+0.03, +0.19] | 0.033 |
| age-50plus | attr:headline | Two Elderly Men Sneak Out Of Nursing Home To Attend Heavy Metal Festival | Kansas Man Asks Judge To Allow Him To Have Sword Fight With Ex-Wife | +1.12 [+0.88, +1.38] | 0.000 |
| age-50plus | attr:lean | Conservative | Liberal | +0.10 [+0.03, +0.18] | 0.024 |
| age-50plus | attr:likes | 2000 | 200 | +0.07 [+0.02, +0.14] | 0.060 |
| age-50plus | posts:h1 | c13 | c18 | +0.23 [+0.10, +0.36] | 0.005 |
| sex-male | attr:headline | Two Elderly Men Sneak Out Of Nursing Home To Attend Heavy Metal Festival | Kansas Man Asks Judge To Allow Him To Have Sword Fight With Ex-Wife | +0.67 [+0.42, +0.94] | 0.000 |
| sex-male | attr:content | Informative | Entertaining | +0.09 [+0.04, +0.15] | 0.010 |
| sex-male | attr:likes | 2000 | 200 | +0.07 [+0.01, +0.14] | 0.086 |
| sex-male | posts:h1 | c13 | c09 | +0.22 [+0.07, +0.38] | 0.029 |
| sex-female | attr:headline | Two Elderly Men Sneak Out Of Nursing Home To Attend Heavy Metal Festival | Kansas Man Asks Judge To Allow Him To Have Sword Fight With Ex-Wife | +1.04 [+0.77, +1.32] | 0.000 |
| sex-female | attr:likes | 2000 | 200 | +0.11 [+0.04, +0.19] | 0.023 |
| edu-degree | attr:headline | Two Elderly Men Sneak Out Of Nursing Home To Attend Heavy Metal Festival | Kansas Man Asks Judge To Allow Him To Have Sword Fight With Ex-Wife | +0.74 [+0.50, +0.98] | 0.000 |
| edu-degree | attr:likes | 2000 | 200 | +0.10 [+0.04, +0.16] | 0.012 |
| edu-nodegree | attr:headline | Two Elderly Men Sneak Out Of Nursing Home To Attend Heavy Metal Festival | Kansas Man Asks Judge To Allow Him To Have Sword Fight With Ex-Wife | +0.92 [+0.64, +1.20] | 0.000 |
| edu-nodegree | attr:content | Informative | Entertaining | +0.08 [+0.02, +0.14] | 0.033 |
| edu-nodegree | attr:likes | 2000 | 200 | +0.08 [+0.01, +0.15] | 0.080 |
| edu-nodegree | posts:h1 | c13 | c09 | +0.26 [+0.10, +0.43] | 0.014 |
| inc-under50k | attr:headline | Two Elderly Men Sneak Out Of Nursing Home To Attend Heavy Metal Festival | Kansas Man Asks Judge To Allow Him To Have Sword Fight With Ex-Wife | +0.76 [+0.46, +1.06] | 0.000 |
| inc-under50k | attr:content | Informative | Entertaining | +0.08 [+0.02, +0.14] | 0.051 |
| inc-under50k | posts:h1 | c13 | c01 | +0.25 [+0.05, +0.47] | 0.068 |
| inc-50-100k | attr:headline | Two Elderly Men Sneak Out Of Nursing Home To Attend Heavy Metal Festival | Kansas Man Asks Judge To Allow Him To Have Sword Fight With Ex-Wife | +0.94 [+0.62, +1.28] | 0.000 |
| inc-50-100k | attr:likes | 2000 | 200 | +0.10 [+0.01, +0.19] | 0.079 |
| inc-100kplus | attr:headline | Two Elderly Men Sneak Out Of Nursing Home To Attend Heavy Metal Festival | Kansas Man Asks Judge To Allow Him To Have Sword Fight With Ex-Wife | +0.83 [+0.51, +1.17] | 0.000 |
| inc-100kplus | attr:likes | 2000 | 200 | +0.13 [+0.05, +0.22] | 0.014 |
| race-white | attr:headline | Two Elderly Men Sneak Out Of Nursing Home To Attend Heavy Metal Festival | Kansas Man Asks Judge To Allow Him To Have Sword Fight With Ex-Wife | +0.92 [+0.71, +1.14] | 0.000 |
| race-white | attr:content | Informative | Entertaining | +0.07 [+0.02, +0.11] | 0.024 |
| race-white | attr:lean | Conservative | Liberal | +0.12 [+0.04, +0.21] | 0.034 |
| race-white | attr:likes | 2000 | 200 | +0.06 [+0.01, +0.12] | 0.060 |
| race-white | posts:h1 | c13 | c09 | +0.27 [+0.13, +0.41] | 0.001 |
| race-nonwhite | attr:headline | Two Elderly Men Sneak Out Of Nursing Home To Attend Heavy Metal Festival | Kansas Man Asks Judge To Allow Him To Have Sword Fight With Ex-Wife | +0.61 [+0.29, +0.94] | 0.002 |
| race-nonwhite | attr:likes | 2000 | 200 | +0.15 [+0.05, +0.26] | 0.025 |

### Real segment gaps (2/21 key, 19/231 exploratory)

| Segment A − B | Family | Quantity | Gap [95% CI] | p | q |
|---|---|---|---|---|---|
| party-rep − party-dem | key | Political lean: Liberal minus Conservative | -0.49 [-0.70, -0.30] | 0.000 | 0.000 |
| ideo-con − ideo-lib | key | Political lean: Liberal minus Conservative | -0.52 [-0.73, -0.33] | 0.000 | 0.000 |
| party-rep − party-dem | exploratory | card:c01 | +0.84 [+0.42, +1.28] | 0.000 | 0.010 |
| party-rep − party-dem | exploratory | card:c13 | +0.71 [+0.22, +1.20] | 0.005 | 0.086 |
| ideo-con − ideo-lib | exploratory | card:c01 | +0.95 [+0.54, +1.33] | 0.000 | 0.001 |
| ideo-con − ideo-lib | exploratory | card:c07 | +0.76 [+0.28, +1.21] | 0.001 | 0.038 |
| ideo-con − ideo-lib | exploratory | card:c09 | +0.70 [+0.27, +1.15] | 0.002 | 0.043 |
| ideo-con − ideo-lib | exploratory | card:c13 | +0.82 [+0.37, +1.28] | 0.000 | 0.023 |
| ideo-con − ideo-lib | exploratory | card:c16 | +0.69 [+0.21, +1.18] | 0.006 | 0.086 |
| age-18-49 − age-50plus | exploratory | Headline: Two Elderly Men Sneak Out Of Nursing Home To Attend Heavy Metal Festival minus Authorities Scramble To Find Stolen Solid Gold Toilet | -0.62 [-0.98, -0.24] | 0.001 | 0.038 |
| age-18-49 − age-50plus | exploratory | Headline: Kansas Man Asks Judge To Allow Him To Have Sword Fight With Ex-Wife minus Two Elderly Men Sneak Out Of Nursing Home To Attend Heavy Metal Festival | +0.73 [+0.39, +1.09] | 0.000 | 0.006 |
| age-18-49 − age-50plus | exploratory | Headline: Kansas Man Asks Judge To Allow Him To Have Sword Fight With Ex-Wife minus Applications To Become Japanese Billionaire Yusaku Maezawa's Girlfriend Have Topped 20,000 | +0.43 [+0.11, +0.74] | 0.007 | 0.091 |
| age-18-49 − age-50plus | exploratory | card:c01 | +0.59 [+0.20, +0.97] | 0.003 | 0.068 |
| age-18-49 − age-50plus | exploratory | card:c04 | +0.55 [+0.16, +0.95] | 0.007 | 0.086 |
| age-18-49 − age-50plus | exploratory | card:c09 | +0.58 [+0.19, +0.97] | 0.004 | 0.083 |
| age-18-49 − age-50plus | exploratory | card:c12 | +0.72 [+0.29, +1.18] | 0.001 | 0.038 |
| age-18-49 − age-50plus | exploratory | card:c15 | +0.67 [+0.25, +1.10] | 0.002 | 0.043 |
| age-18-49 − age-50plus | exploratory | card:c16 | +0.74 [+0.31, +1.18] | 0.001 | 0.038 |
| edu-degree − edu-nodegree | exploratory | Headline: Two Elderly Men Sneak Out Of Nursing Home To Attend Heavy Metal Festival minus Authorities Scramble To Find Stolen Solid Gold Toilet | -0.53 [-0.91, -0.16] | 0.006 | 0.086 |
| inc-under50k − inc-100kplus | exploratory | Number of likes: 2000 minus 20 | -0.19 [-0.33, -0.06] | 0.005 | 0.086 |
| inc-under50k − inc-100kplus | exploratory | card:c10 | -0.67 [-1.14, -0.17] | 0.007 | 0.086 |

Key gaps with unadjusted p < 0.05 that did not survive correction: ideo-con − ideo-lib level +0.36 (p 0.049); age-18-49 − age-50plus level +0.32 (p 0.046)

