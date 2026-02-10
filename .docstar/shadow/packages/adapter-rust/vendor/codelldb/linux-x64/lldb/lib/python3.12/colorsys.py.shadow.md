# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/colorsys.py
@source-hash: 65e3dfbf7bad61d4
@generated: 2026-02-09T18:09:32Z

## Purpose
Python standard library module providing bidirectional color space conversion functions between RGB and three alternative color systems: YIQ, HLS, and HSV. All operations use normalized float values in range [0.0, 1.0].

## Key Functions

### YIQ Color System (TV/Video)
- `rgb_to_yiq(r, g, b)` (L40-44): Converts RGB to YIQ using FCC NTSC constants. Returns luminance Y and chrominance I,Q components
- `yiq_to_rgb(y, i, q)` (L46-67): Inverse conversion with clamping to valid RGB range [0.0, 1.0]

### HLS Color System (Hue, Luminance, Saturation)  
- `rgb_to_hls(r, g, b)` (L75-97): Converts RGB to HLS, handling edge cases for grayscale colors
- `hls_to_rgb(h, l, s)` (L99-107): Inverse conversion using helper function `_v()`
- `_v(m1, m2, hue)` (L109-117): Internal helper for HLS-to-RGB hue calculations with modular arithmetic

### HSV Color System (Hue, Saturation, Value)
- `rgb_to_hsv(r, g, b)` (L125-143): Converts RGB to HSV with similar logic to HLS but different saturation calculation
- `hsv_to_rgb(h, s, v)` (L145-166): Inverse conversion using sector-based approach with 6 conditional branches

## Constants
- `ONE_THIRD`, `ONE_SIXTH`, `TWO_THIRD` (L29-31): Precomputed fractions for HLS calculations
- YIQ conversion matrices use hardcoded FCC NTSC coefficients (L41-43, L51-53)

## Architecture
- Pure functional design with no state or classes
- Each color system has symmetric conversion pair
- Input validation through clamping (YIQ→RGB) rather than exceptions
- Modular arithmetic handles hue wraparound in circular color spaces

## Critical Constraints
- All RGB values must be in [0.0, 1.0] range
- YIQ I,Q components can exceed [0.0, 1.0] as noted in docstring
- HSV conversion assumes `int()` truncates (L148 comment)
- Division by zero avoided through equality checks before range calculations