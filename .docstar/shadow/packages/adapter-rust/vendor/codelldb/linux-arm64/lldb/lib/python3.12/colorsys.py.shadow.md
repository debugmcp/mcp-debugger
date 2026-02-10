# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/colorsys.py
@source-hash: 65e3dfbf7bad61d4
@generated: 2026-02-09T18:08:35Z

## Primary Purpose
Standard Python library module providing bidirectional color space conversion utilities between RGB and three other color systems: YIQ, HLS, and HSV. Part of LLDB's Python distribution for debugging support.

## Key Functions and Responsibilities

### RGB ↔ YIQ Conversion (L40-67)
- `rgb_to_yiq(r, g, b)` (L40-44): Converts RGB to YIQ using NTSC coefficients
- `yiq_to_rgb(y, i, q)` (L46-67): Converts YIQ back to RGB with clamping to [0,1] range
- Uses precomputed matrix coefficients for inverse transformation efficiency

### RGB ↔ HLS Conversion (L75-117)  
- `rgb_to_hls(r, g, b)` (L75-97): Converts RGB to Hue-Luminance-Saturation
- `hls_to_rgb(h, l, s)` (L99-107): Converts HLS back to RGB using helper function
- `_v(m1, m2, hue)` (L109-117): Internal helper for HLS→RGB hue calculations with piecewise linear interpolation

### RGB ↔ HSV Conversion (L125-166)
- `rgb_to_hsv(r, g, b)` (L125-143): Converts RGB to Hue-Saturation-Value  
- `hsv_to_rgb(h, s, v)` (L145-166): Converts HSV back to RGB using sector-based approach

## Key Constants and Dependencies
- Fractional constants (L29-31): `ONE_THIRD`, `ONE_SIXTH`, `TWO_THIRD` for mathematical precision
- No external dependencies - pure mathematical transformations
- Public API exported via `__all__` (L24-25)

## Architecture and Patterns
- **Input/Output Contract**: All functions expect/return float triples in [0,1] range (except YIQ I,Q components)
- **Error Handling**: YIQ conversion includes explicit clamping; other conversions assume valid inputs
- **Mathematical Approach**: Direct matrix transformations for YIQ; geometric algorithms for HLS/HSV
- **Performance**: Precomputed constants and efficient conditional branches

## Critical Invariants
- All RGB values must be normalized to [0,1] range
- Hue values wrap around at 1.0 using modulo operation
- YIQ inverse transformation includes bounds checking to prevent invalid RGB output
- HSV conversion assumes `int()` truncates (L148 comment)