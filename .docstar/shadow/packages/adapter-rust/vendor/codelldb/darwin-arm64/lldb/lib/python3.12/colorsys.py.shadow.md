# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/colorsys.py
@source-hash: 65e3dfbf7bad61d4
@generated: 2026-02-09T18:07:02Z

## Color Space Conversion Library

**Primary Purpose:** Provides bidirectional conversion functions between RGB and three other color systems (YIQ, HLS, HSV). Part of Python's standard library color utilities.

**Core Architecture:**
- All functions expect/return float triples in range [0.0, 1.0] (except YIQ I,Q components which may extend slightly beyond)
- Input validation through clamping in YIQ conversion
- No class-based design - pure functional API

**Key Functions:**

**YIQ Color System (Composite Video):**
- `rgb_to_yiq(r, g, b)` (L40-44): Converts RGB to YIQ using FCC NTSC constants
- `yiq_to_rgb(y, i, q)` (L46-67): Inverse conversion with output clamping to [0,1] range

**HLS Color System (Hue, Luminance, Saturation):**
- `rgb_to_hls(r, g, b)` (L75-97): RGB to HLS conversion with special handling for achromatic colors
- `hls_to_rgb(h, l, s)` (L99-107): HLS to RGB using helper function `_v`
- `_v(m1, m2, hue)` (L109-117): Private helper for HLS→RGB hue calculations with modular arithmetic

**HSV Color System (Hue, Saturation, Value):**
- `rgb_to_hsv(r, g, b)` (L125-143): RGB to HSV conversion
- `hsv_to_rgb(h, s, v)` (L145-166): HSV to RGB using sector-based approach

**Mathematical Constants:**
- Fractional constants (L29-31): `ONE_THIRD`, `ONE_SIXTH`, `TWO_THIRD` for precise calculations

**Dependencies:** Pure Python, no external imports

**Critical Implementation Details:**
- YIQ conversion includes manual RGB clamping (L55-66) to handle out-of-gamut colors
- HLS/HSV hue calculations use modular arithmetic to handle wraparound
- HSV→RGB uses integer sector calculation with truncation assumption (L148 comment)
- Achromatic color handling (when min == max) returns early with zero hue/saturation

**Export Interface:** Six public functions exposed via `__all__` (L24-25)