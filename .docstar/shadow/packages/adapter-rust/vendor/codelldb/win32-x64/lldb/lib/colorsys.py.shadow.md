# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/colorsys.py
@source-hash: 65e3dfbf7bad61d4
@generated: 2026-02-09T18:13:16Z

## Purpose
Python color conversion library providing bidirectional transformations between RGB and three other color spaces: YIQ, HLS, and HSV. Part of the LLDB debugger's Python environment within a Rust adapter package.

## Public API
Exports 6 conversion functions (L24-25):
- `rgb_to_yiq(r, g, b)` (L40-44) - RGB to YIQ (NTSC video standard)
- `yiq_to_rgb(y, i, q)` (L46-67) - YIQ to RGB with clamping to [0,1]
- `rgb_to_hls(r, g, b)` (L75-97) - RGB to HLS (Hue, Luminance, Saturation)
- `hls_to_rgb(h, l, s)` (L99-107) - HLS to RGB using helper `_v()`
- `rgb_to_hsv(r, g, b)` (L125-143) - RGB to HSV (Hue, Saturation, Value)  
- `hsv_to_rgb(h, s, v)` (L145-165) - HSV to RGB with sector-based algorithm

## Key Components
- **Constants** (L29-31): `ONE_THIRD`, `ONE_SIXTH`, `TWO_THIRD` for mathematical operations
- **Helper function** `_v(m1, m2, hue)` (L109-117): HLS-to-RGB conversion helper using piecewise linear interpolation
- **YIQ conversion**: Uses FCC NTSC constants with explicit output clamping in reverse conversion
- **HLS/HSV conversion**: Standard algorithms with hue normalization via modulo operation

## Color Space Details
- **YIQ**: Luminance + chrominance for composite video; I,Q can exceed [0,1] range
- **HLS**: Perceptual lightness model with separate hue/saturation/lightness
- **HSV**: Artist-friendly model emphasizing brightness (value) over lightness

## Mathematical Approach
All algorithms handle edge cases (zero saturation, equal RGB components) and use normalized hue values [0,1]. YIQ uses matrix transformations, while HLS/HSV use min/max-based geometric calculations.

## Dependencies
Pure Python standard library - no external dependencies.