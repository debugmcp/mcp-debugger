# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/proc-macro2-1.0.103/src/location.rs
@source-hash: 9225c5a55f03b56c
@generated: 2026-02-09T18:11:39Z

## Primary Purpose
Defines position tracking for source code locations within the proc-macro2 crate, specifically for representing line-column coordinates in source files during macro processing.

## Key Types and Implementation

### LineColumn Struct (L8-15)
- **Purpose**: Represents a precise location in source code as a line-column pair
- **Fields**:
  - `line: usize` (L11) - 1-indexed line number (inclusive bounds)
  - `column: usize` (L14) - 0-indexed UTF-8 character column (inclusive bounds)
- **Traits**: Copy, Clone, Debug, PartialEq, Eq, Hash
- **Visibility**: Public but semver-exempt, gated behind "span-locations" feature

### Ordering Implementation (L17-29)
- **Ord trait (L17-23)**: Implements lexicographic ordering - primary sort by line, secondary by column
- **PartialOrd trait (L25-29)**: Delegates to total ordering implementation via `cmp()`

## Dependencies
- `core::cmp::Ordering` for comparison operations

## Architectural Notes
- Feature-gated design (`span-locations`) suggests optional functionality
- Semver exemption indicates internal/unstable API
- Mixed indexing convention (1-indexed lines, 0-indexed columns) follows common editor conventions
- Total ordering enables use in sorted collections (BTreeMap, etc.)

## Usage Context
Likely used by `Span` types to track source locations for error reporting and debugging in procedural macros.