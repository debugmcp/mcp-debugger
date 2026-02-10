# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/statistics.py
@source-hash: 5845851a5833a143
@generated: 2026-02-09T18:10:15Z

## Python Standard Library Statistics Module

This is Python's `statistics.py` module, providing a comprehensive set of statistical functions for calculating central tendencies, measures of spread, and statistical relationships.

### Core Purpose
A general-purpose statistics library supporting common statistical operations with high precision arithmetic using exact rational representations internally via fractions.Fraction for intermediate calculations.

### Public API (__all__ exports, L107-128)
- **Central tendency**: `mean`, `fmean`, `geometric_mean`, `harmonic_mean`, `median`, `median_low`, `median_high`, `median_grouped`, `mode`, `multimode`
- **Quantiles**: `quantiles` 
- **Spread measures**: `variance`, `pvariance`, `stdev`, `pstdev`
- **Relationships**: `covariance`, `correlation`, `linear_regression`
- **Distribution**: `NormalDist`
- **Exception**: `StatisticsError`

### Key Private Utilities
- **`_sum(data)` (L154-205)**: High-precision sum returning (type, fraction_sum, count). Groups data by type and uses exact rational arithmetic to avoid floating-point errors.
- **`_ss(data, c=None)` (L208-246)**: Single-pass calculation of sum of squared deviations, mean, and count. Core engine for variance calculations.
- **`_exact_ratio(x)` (L287-330)**: Converts numbers to exact (numerator, denominator) pairs for precise arithmetic.
- **`_coerce(T, S)` (L256-284)**: Type coercion rules for mixed numeric types.

### Central Tendency Functions
- **`mean(data)` (L468-487)**: Sample arithmetic mean using exact fractions internally
- **`fmean(data, weights=None)` (L490-523)**: Fast floating-point mean with optional weights
- **`geometric_mean(data)` (L526-542)**: Geometric mean via exp(mean(log(data)))
- **`harmonic_mean(data, weights=None)` (L545-598)**: Harmonic mean with weight support
- **Median variants (L601-735)**: `median`, `median_low`, `median_high`, `median_grouped` with interpolation

### Mode Functions
- **`mode(data)` (L738-765)**: Single most frequent value
- **`multimode(data)` (L768-785)**: All values with maximum frequency

### Quantiles
- **`quantiles(data, *, n=4, method='exclusive')` (L825-865)**: Divides data into n intervals. Supports 'inclusive' and 'exclusive' methods (R6/R7 statistical conventions).

### Spread Measures
- **`variance(data, xbar=None)` (L874-915)**: Sample variance (n-1 denominator)
- **`pvariance(data, mu=None)` (L918-956)**: Population variance (n denominator) 
- **`stdev(data, xbar=None)` (L959-974)**: Sample standard deviation with precise square root
- **`pstdev(data, mu=None)` (L977-992)**: Population standard deviation

### Correlation and Regression
- **`covariance(x, y)` (L1015-1040)**: Sample covariance between two variables
- **`correlation(x, y, *, method='linear')` (L1043-1088)**: Pearson correlation or Spearman rank correlation
- **`linear_regression(x, y, *, proportional=False)` (L1094-1149)**: Simple linear regression returning LinearRegression namedtuple

### Normal Distribution Class
- **`NormalDist` (L1236-1454)**: Complete normal distribution implementation
  - Constructor: `__init__(mu=0.0, sigma=1.0)` (L1246-1251)
  - Class method: `from_samples(cls, data)` (L1253-1256)
  - Core methods: `pdf`, `cdf`, `inv_cdf`, `quantiles`, `samples`
  - Statistical methods: `overlap`, `zscore`
  - Arithmetic operators: `__add__`, `__sub__`, `__mul__`, `__truediv__` for distribution algebra

### Specialized Square Root Functions
- **`_float_sqrt_of_frac(n, m)` (L425-435)**: Correctly rounded square root of fraction as float
- **`_decimal_sqrt_of_frac(n, m)` (L438-463)**: Correctly rounded square root for Decimal precision

### Inverse CDF Implementation
- **`_normal_dist_inv_cdf(p, mu, sigma)` (L1155-1226)**: Rational approximation for normal distribution inverse CDF using Wichura's AS241 algorithm. Fallback to C implementation if available.

### Type Support
Supports int, float, Fraction, and Decimal types throughout with automatic type coercion and preservation of precision where possible.

### Exception Handling  
All functions raise `StatisticsError` (L148-149) for invalid inputs like empty datasets or mathematical impossibilities.