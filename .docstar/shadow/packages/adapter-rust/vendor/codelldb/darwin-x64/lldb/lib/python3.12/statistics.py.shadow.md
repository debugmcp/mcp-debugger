# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/statistics.py
@source-hash: 5845851a5833a143
@generated: 2026-02-09T18:08:13Z

## Python Statistics Module

**Primary Purpose**: Comprehensive statistical functions library providing descriptive statistics, measures of central tendency, variability, and correlation analysis. Part of Python standard library with high-precision arithmetic support.

### Core Architecture

The module uses exact rational arithmetic internally via `_sum()` (L154-206) and `_ss()` (L208-247) to avoid floating-point precision errors. These functions convert inputs to fractions for computation, then convert back to appropriate output types.

**Type Coercion**: `_coerce()` (L256-285) handles mixed numeric types (int, float, Fraction, Decimal) with specific precedence rules.

**Exact Arithmetic**: `_exact_ratio()` (L287-331) converts numbers to exact (numerator, denominator) pairs for precision.

### Measures of Central Tendency

- `mean()` (L468-488): Sample arithmetic mean using exact arithmetic
- `fmean()` (L490-524): Fast floating-point mean with optional weights
- `geometric_mean()` (L526-543): Geometric mean via logarithms 
- `harmonic_mean()` (L545-599): Harmonic mean with weight support
- `median()` (L601-623): Standard median with interpolation for even counts
- `median_low()`/`median_high()` (L625-664): Low/high medians
- `median_grouped()` (L666-736): Grouped data median estimation
- `mode()`/`multimode()` (L738-786): Most frequent value(s)

### Quantiles and Ranking

- `quantiles()` (L825-866): Divide data into equal probability intervals with 'inclusive'/'exclusive' methods
- `_rank()` (L359-411): Internal ranking function with tie handling

### Measures of Spread  

- `variance()`/`pvariance()` (L874-957): Sample/population variance
- `stdev()`/`pstdev()` (L959-993): Sample/population standard deviation
- Square root computation via `_float_sqrt_of_frac()` (L425-436) and `_decimal_sqrt_of_frac()` (L438-464)

### Bivariate Statistics

- `covariance()` (L1015-1041): Sample covariance between two variables
- `correlation()` (L1043-1089): Pearson correlation with 'linear'/'ranked' methods
- `linear_regression()` (L1094-1150): Simple linear regression returning `LinearRegression` namedtuple (L1091)

### Normal Distribution Class

`NormalDist` (L1236-1454): Complete normal distribution implementation with:
- Probability density (`pdf()`, L264-271) and cumulative distribution (`cdf()`, L272-277) functions
- Inverse CDF (`inv_cdf()`, L278-291) using Wichura's algorithm (L1155-1227)
- Sample generation (`samples()`, L258-263)
- Distribution overlap coefficient (`overlap()`, L1303-1336) 
- Arithmetic operations (`__add__`, `__sub__`, `__mul__`, `__truediv__`)
- Z-score calculation (`zscore()`, L1337-1347)

### Utilities

- `StatisticsError` (L148-150): Custom exception class
- `_fail_neg()` (L351-357): Iterator that validates non-negative values
- `_mean_stdev()` (L995-1006): Single-pass mean and standard deviation calculation

### Dependencies

Standard library imports: `math`, `numbers`, `random`, `sys`, `fractions`, `decimal`, `itertools`, `bisect`, `functools`, `operator`, `collections`

### Key Constants

- `_SQRT2` (L144): Cached square root of 2
- `_sqrt_bit_width` (L422): Precision width for square root calculations