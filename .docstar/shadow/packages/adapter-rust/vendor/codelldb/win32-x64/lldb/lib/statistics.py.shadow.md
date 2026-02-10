# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/statistics.py
@source-hash: 5845851a5833a143
@generated: 2026-02-09T18:13:20Z

## Primary Purpose
Complete implementation of Python's statistics module providing descriptive statistics functions for central tendency, spread, and relationships between datasets. This is part of LLDB's Python runtime environment within a Rust adapter package.

## Core Public Functions

### Central Tendency (L468-786)
- `mean(data)` (L468): Arithmetic mean with high-precision fraction-based calculation
- `fmean(data, weights=None)` (L490): Fast float-based mean with optional weighting
- `geometric_mean(data)` (L526): Geometric mean using log-exp transformation
- `harmonic_mean(data, weights=None)` (L545): Harmonic mean with weight support
- `median(data)` (L601): Standard median with interpolation for even counts
- `median_low/high(data)` (L625,L647): Lower/upper median variants
- `median_grouped(data, interval=1.0)` (L666): Grouped data median estimation
- `mode(data)` (L738): Most frequent value using Counter
- `multimode(data)` (L768): All most frequent values as list
- `quantiles(data, n=4, method='exclusive')` (L825): Quantile calculation with R6/R7 methods

### Spread Measures (L874-1006)
- `variance(data, xbar=None)` (L874): Sample variance
- `pvariance(data, mu=None)` (L918): Population variance
- `stdev(data, xbar=None)` (L959): Sample standard deviation with precise square root
- `pstdev(data, mu=None)` (L977): Population standard deviation

### Bivariate Statistics (L1015-1149)
- `covariance(x, y)` (L1015): Sample covariance between two variables
- `correlation(x, y, method='linear')` (L1043): Pearson/Spearman correlation
- `linear_regression(x, y, proportional=False)` (L1094): Simple linear regression returning namedtuple

## Core Classes

### StatisticsError (L148-149)
Custom ValueError subclass for statistics-specific errors.

### NormalDist (L1236-1454)
Complete normal distribution implementation with:
- Construction: `__init__(mu=0.0, sigma=1.0)` (L1246)
- Factory: `from_samples(cls, data)` (L1253)
- Sampling: `samples(n, seed=None)` (L1258)
- Distribution functions: `pdf(x)` (L1264), `cdf(x)` (L1272), `inv_cdf(p)` (L1278)
- Analysis: `quantiles(n=4)` (L1292), `overlap(other)` (L1303), `zscore(x)` (L1337)
- Arithmetic operations: `__add__`, `__sub__`, `__mul__`, `__truediv__` (L1377-1419)

## Private Utilities (L152-464)

### High-Precision Arithmetic
- `_sum(data)` (L154): Exact sum using fractions to avoid floating-point errors
- `_ss(data, c=None)` (L208): Sum of squares with mean calculation in single pass
- `_exact_ratio(x)` (L287): Convert numbers to exact numerator/denominator pairs
- `_convert(value, T)` (L333): Type conversion with overflow handling

### Mathematical Helpers
- `_float_sqrt_of_frac(n, m)` (L425): Correctly rounded float square root of fraction
- `_decimal_sqrt_of_frac(n, m)` (L438): Correctly rounded Decimal square root
- `_integer_sqrt_of_frac_rto(n, m)` (L413): Integer square root with round-to-odd
- `_normal_dist_inv_cdf(p, mu, sigma)` (L1155): Inverse normal CDF using Wichura approximation

### Type System
- `_coerce(T, S)` (L256): Type coercion rules for mixed arithmetic
- `_isfinite(x)` (L249): Finite check supporting both Decimal and float
- `_fail_neg(values, errmsg)` (L351): Iterator rejecting negative values

### Data Processing
- `_rank(data, key=None, reverse=False, ties='average', start=1)` (L359): Ranking with tie handling
- `_mean_stdev(data)` (L995): Combined mean and stdev calculation

## Key Dependencies
- Uses `fractions.Fraction` and `decimal.Decimal` for exact arithmetic
- Leverages `math.fsum`, `math.sumprod` for high-precision floating-point operations
- Imports optimized `_normal_dist_inv_cdf` from C extension if available (L1230-1233)

## Architecture Notes
- Single-pass algorithms where possible (e.g., `_ss` for variance)
- Extensive type coercion system supporting int, float, Fraction, Decimal
- Graceful handling of edge cases (empty data, infinite/NaN values)
- Performance optimization through cached operations and C extension fallbacks