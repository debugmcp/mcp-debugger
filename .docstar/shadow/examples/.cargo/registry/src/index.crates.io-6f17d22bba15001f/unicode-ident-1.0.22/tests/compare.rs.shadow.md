# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/unicode-ident-1.0.22/tests/compare.rs
@source-hash: f2311271aa1db738
@generated: 2026-02-09T18:12:35Z

## Purpose
Cross-validation test file that verifies the correctness of the unicode-ident crate's XID character classification by comparing its results against multiple alternative implementations using different data structures and algorithms.

## Key Components

### Test Function
- `compare_all_implementations()` (L10-68): Exhaustive validation test that checks every Unicode character (U+0000 to U+10FFFF) against multiple XID classification implementations

### Module Dependencies
- `fst` (L5): Finite State Transducer implementation for XID character sets
- `roaring` (L6): Roaring bitmap implementation for XID character sets  
- `trie` (L7): Trie-based implementation using ucd-trie for XID character sets

## Test Logic
The test iterates through all possible Unicode characters (L16) and validates that `unicode_ident::is_xid_start()` and `unicode_ident::is_xid_continue()` (L17-18) produce identical results to:

1. **unicode-xid crate** (L21-30): Reference implementation using `UnicodeXID` trait
2. **ucd-trie implementation** (L33-42): Uses precomputed trie structures `XID_START` and `XID_CONTINUE`
3. **FST implementation** (L44-54): Finite State Transducer approach with big-endian byte encoding
4. **Roaring bitmap implementation** (L56-66): Compressed bitmap representation

## Architecture Notes
- Exhaustive testing approach ensures 100% coverage of Unicode space
- Multiple implementation strategies validate correctness through consensus
- Character-by-character comparison with detailed error reporting (`{ch:?}` format)
- Big-endian byte encoding used for FST lookups (L47, L52)
- Direct u32 casting for roaring bitmap lookups (L59, L64)

## Critical Invariants
- All implementations must agree on XID_Start and XID_Continue classification for every Unicode codepoint
- Test failure indicates either a bug in unicode-ident or inconsistency in reference implementations