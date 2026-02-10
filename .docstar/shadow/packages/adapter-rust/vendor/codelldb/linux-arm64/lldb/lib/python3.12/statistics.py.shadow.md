# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/statistics.py
@source-hash: 5845851a5833a143
@generated: 2026-02-09T18:09:23Z

## Purpose
The Python `statistics` module provides a comprehensive implementation of statistical functions for analyzing numerical data. Part of Python's standard library, it includes measures of central tendency (averages), measures of spread (variance/std dev), and statistical relationships between datasets.

## Core Architecture

### Exception Classes
- `StatisticsError` (L148-149): Custom exception inheriting from ValueError for statistics-specific errors

### Private Utility Functions
- `_sum()` (L154-205): High-precision summation using Fraction arithmetic to avoid floating-point errors
- `_ss()` (L208-246): Calculates exact mean and sum of square deviations in single pass
- `_coerce()` (L256-284): Type coercion for mixed numeric types (int, float, Fraction, Decimal)
- `_exact_ratio()` (L287-330): Converts numbers to exact numerator/denominator pairs
- `_convert()` (L333-348): Converts values between numeric types
- `_fail_neg()` (L351-356): Iterator that validates non-negative values
- `_rank()` (L359-410): Ranks dataset elements, handling ties via averaging

### Measures of Central Tendency
- `mean()` (L468-487): Arithmetic mean supporting exact arithmetic with Fraction/Decimal
- `fmean()` (L490-523): Fast floating-point mean with optional weights
- `geometric_mean()` (L526-542): Geometric mean using log transformation
- `harmonic_mean()` (L545-598): Harmonic mean with optional weights and negative value validation
- `median()` (L601-622): Standard median with interpolation for even counts
- `median_low()` (L625-644): Lower middle value for even counts
- `median_high()` (L647-663): Upper middle value for even counts  
- `median_grouped()` (L666-735): Estimated median for grouped/binned data
- `mode()` (L738-765): Most frequent discrete value
- `multimode()` (L768-785): All values with maximum frequency
- `quantiles()` (L825-865): Divide data into equal probability intervals

### Measures of Spread
- `variance()` (L874-915): Sample variance (n-1 denominator)
- `pvariance()` (L918-956): Population variance (n denominator)
- `stdev()` (L959-974): Sample standard deviation
- `pstdev()` (L977-992): Population standard deviation
- `_mean_stdev()` (L995-1005): Combined mean/stdev calculation

### Bivariate Statistics
- `covariance()` (L1015-1040): Sample covariance between two variables
- `correlation()` (L1043-1088): Pearson correlation with optional Spearman rank correlation
- `LinearRegression` (L1091): Named tuple for regression results
- `linear_regression()` (L1094-1149): Simple linear regression via least squares

### Normal Distribution Class
- `NormalDist` (L1236-1454): Complete normal distribution implementation with:
  - Construction from parameters or samples (L1246, L1254-1256)
  - Sample generation (L1258-1262)
  - PDF/CDF/inverse CDF methods (L1264-1290)
  - Quantile computation (L1292-1301)
  - Distribution overlap calculation (L1303-1335)
  - Z-score computation (L1337-1346)
  - Arithmetic operations for distribution algebra (L1377-1435)

## Key Design Patterns

### Exact Arithmetic
Uses Fraction internally to avoid floating-point precision issues, especially in `_sum()` and `_ss()`. Results are converted to appropriate output types via `_convert()`.

### Type Flexibility
Supports int, float, Decimal, and Fraction inputs with sophisticated type coercion rules in `_coerce()`.

### Single-Pass Algorithms
Critical functions like `_ss()` use streaming algorithms to handle iterators efficiently without requiring multiple passes.

### Robust Error Handling
Comprehensive validation for edge cases (empty data, negative values where inappropriate, mismatched input sizes).

## Dependencies
- Standard library: math, numbers, random, sys, fractions, decimal, itertools, bisect, functools, operator, collections
- Optional C extension: `_statistics._normal_dist_inv_cdf` for performance (L1230-1233)