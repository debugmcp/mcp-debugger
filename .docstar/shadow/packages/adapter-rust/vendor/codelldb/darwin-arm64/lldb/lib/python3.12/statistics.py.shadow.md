# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/statistics.py
@source-hash: 5845851a5833a143
@generated: 2026-02-09T18:07:41Z

## Python Statistics Module

**Primary Purpose**: Comprehensive statistics library providing functions for calculating descriptive statistics, measures of central tendency, variability, and relationships between datasets. Part of the Python standard library.

### Public API

**Exception Class**:
- `StatisticsError` (L148-149): Custom exception inheriting from ValueError for statistics-specific errors

**Measures of Central Tendency**:
- `mean(data)` (L468-487): Sample arithmetic mean with exact precision using Fraction arithmetic
- `fmean(data, weights=None)` (L490-523): Fast floating-point arithmetic mean, optionally weighted
- `geometric_mean(data)` (L526-542): Geometric mean using logarithms, requires positive values
- `harmonic_mean(data, weights=None)` (L545-598): Harmonic mean with optional weights, handles edge cases
- `median(data)` (L601-622): Standard median with interpolation for even-length datasets
- `median_low(data)` (L625-644): Lower median variant
- `median_high(data)` (L647-663): Upper median variant  
- `median_grouped(data, interval=1.0)` (L666-735): Median for grouped/binned data using interpolation
- `mode(data)` (L738-765): Most frequent value, returns single result
- `multimode(data)` (L768-785): All most frequent values as list

**Quantile Functions**:
- `quantiles(data, n=4, method='exclusive')` (L825-865): Divide data into equal probability intervals, supports 'exclusive' (R6) and 'inclusive' (R7) methods

**Measures of Spread**:
- `variance(data, xbar=None)` (L874-915): Sample variance (n-1 denominator)
- `pvariance(data, mu=None)` (L918-956): Population variance (n denominator)
- `stdev(data, xbar=None)` (L959-974): Sample standard deviation
- `pstdev(data, mu=None)` (L977-992): Population standard deviation

**Bivariate Statistics**:
- `covariance(x, y)` (L1015-1040): Sample covariance between two variables
- `correlation(x, y, method='linear')` (L1043-1088): Pearson correlation or Spearman rank correlation
- `linear_regression(x, y, proportional=False)` (L1094-1149): Simple linear regression returning `LinearRegression` namedtuple (L1091)

**Normal Distribution Class**:
- `NormalDist` (L1236-1454): Full-featured normal distribution class with:
  - Constructor and `from_samples` class method (L1246-1256)
  - PDF, CDF, inverse CDF methods (L1264-1290)
  - Sample generation with seeding (L1258-1262)
  - Arithmetic operations for distribution combination
  - Overlap coefficient calculation (L1303-1335)
  - Z-score computation (L1337-1346)

### Internal Architecture

**High-Precision Arithmetic Core**:
- `_sum(data)` (L154-205): Central function providing exact summation using Fraction arithmetic, handles mixed numeric types
- `_ss(data, c=None)` (L208-246): Computes exact mean and sum of squared deviations in single pass
- `_exact_ratio(x)` (L287-330): Converts numbers to exact (numerator, denominator) pairs
- `_convert(value, T)` (L333-348): Type conversion with precision preservation

**Type Coercion System**:
- `_coerce(T, S)` (L256-284): Sophisticated type coercion logic following specific rules for int, float, Fraction, Decimal combinations

**Square Root Implementations**:
- `_float_sqrt_of_frac(n, m)` (L425-435): Correctly rounded float square root of fraction
- `_decimal_sqrt_of_frac(n, m)` (L438-463): Correctly rounded Decimal square root with ULP adjustment
- `_integer_sqrt_of_frac_rto(n, m)` (L413-417): Integer square root with round-to-odd

**Utility Functions**:
- `_rank(data, key=None, reverse=False, ties='average', start=1)` (L359-410): Data ranking with tie handling for correlation functions
- `_fail_neg(values, errmsg)` (L351-356): Iterator that raises StatisticsError on negative values
- `_isfinite(x)` (L249-253): Finite number detection across types
- `_mean_stdev(data)` (L995-1005): Combined mean/stdev calculation in single pass

**Normal Distribution Inverse CDF**:
- `_normal_dist_inv_cdf(p, mu, sigma)` (L1155-1226): Wichura's rational approximation algorithm for inverse normal CDF, with optional C implementation fallback (L1230-1233)

### Key Design Patterns

1. **Exact Arithmetic**: Uses Fraction internally to avoid floating-point precision loss, converting to appropriate target type only at the end
2. **Single-Pass Algorithms**: Functions like `_ss` compute multiple statistics in one iteration for efficiency
3. **Type Preservation**: Maintains input numeric types (int, float, Fraction, Decimal) throughout calculations
4. **Robust Error Handling**: Comprehensive validation with descriptive StatisticsError messages
5. **Performance Optimization**: Separate fast floating-point variants (`fmean`) alongside exact versions

### Dependencies

- Standard library: `math`, `numbers`, `random`, `sys`, `fractions`, `decimal`, `itertools`, `bisect`, `functools`, `operator`, `collections`
- Optional C extension: `_statistics` module for faster inverse CDF computation

### Critical Invariants

- All public functions validate input data length requirements
- Mixed numeric types follow strict coercion hierarchy
- Exact arithmetic preserved until final result conversion
- Normal distribution operations require non-zero sigma for PDF/CDF operations