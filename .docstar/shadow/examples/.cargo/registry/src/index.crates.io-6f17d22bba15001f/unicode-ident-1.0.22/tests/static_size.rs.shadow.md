# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/unicode-ident-1.0.22/tests/static_size.rs
@source-hash: 52763dc203f21156
@generated: 2026-02-09T18:12:37Z

## Purpose
Test suite for measuring memory footprint of different Unicode identifier table implementations in the unicode-ident crate. Validates that data structure sizes remain stable across builds and configurations.

## Key Test Functions

**`test_size` (L5-17)** - Measures total size of ASCII lookup tables and trie structures from `tables.rs`. Validates combined size equals 10,248 bytes through `size_of_val()` calculations on:
- `ASCII_START/ASCII_CONTINUE` tables
- `TRIE_START/TRIE_CONTINUE` structures  
- `LEAF` data structure

**`test_xid_size` (L19-29)** - Tests XID (XML Identifier) table sizes from `tables/mod.rs`. Expects combined `XID_START` and `XID_CONTINUE` tables to total 11,976 bytes. Also references `BY_NAME` to ensure it's not dead code.

**`test_trieset_size` (L31-76)** - 64-bit only test measuring `ucd_trie::TrieSet` memory usage from `trie/trie.rs`. Destructures trie levels (tree1/2/3_level1/2/3) for both XID_START and XID_CONTINUE, calculating total size of 10,392 bytes.

**`test_fst_size` (L78-84)** - Measures Finite State Transducer (FST) binary file sizes by including `fst/xid_start.fst` and `fst/xid_continue.fst` as byte arrays. Expects combined 143,513 bytes.

**`test_roaring_size` (L86-95)** - Tests Roaring bitmap representation size from `roaring/mod.rs`. Uses `serialized_size()` method on XID bitmaps, expecting 66,104 bytes total.

## Architecture & Dependencies
- Uses `std::mem::size_of_val` for runtime size measurement
- Imports table modules via `#[path]` attributes pointing to relative locations
- Tests different data structure approaches: lookup tables, tries, FSTs, and compressed bitmaps
- Platform-conditional compilation for 64-bit trie tests
- Relies on external `ucd_trie` crate for trie data structures

## Testing Strategy
Each test validates a different Unicode data encoding strategy's memory efficiency, ensuring no regressions in data structure sizes. The hardcoded size assertions serve as canaries for unintended changes to Unicode table generation or encoding.