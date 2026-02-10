# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/unicode-ident-1.0.22/tests/fst/mod.rs
@source-hash: 69a3aaf59acd8bca
@generated: 2026-02-09T18:06:48Z

**Purpose:** Provides lazy-loaded Finite State Transducer (FST) sets for Unicode identifier validation in the unicode-ident crate test suite.

**Key Functions:**
- `xid_start_fst()` (L3-6): Returns an FST set containing Unicode characters valid at the start of identifiers, loaded from embedded binary data "xid_start.fst"
- `xid_continue_fst()` (L8-11): Returns an FST set containing Unicode characters valid as continuation characters in identifiers, loaded from embedded binary data "xid_continue.fst"

**Dependencies:**
- `fst` crate: Used for finite state transducer operations
- Binary FST data files: "xid_start.fst" and "xid_continue.fst" embedded at compile time via `include_bytes!`

**Architectural Pattern:**
- Uses compile-time embedding of precomputed FST binary data for efficient Unicode character set lookups
- Functions return `fst::Set<&'static [u8]>` for zero-copy access to embedded data
- Both functions follow identical pattern: load embedded bytes → create raw FST → wrap in Set

**Critical Behavior:**
- Functions will panic on malformed FST data via `.unwrap()` calls
- Data lifetime is 'static due to compile-time embedding
- FST sets enable fast membership testing for Unicode identifier character validation

**Usage Context:**
This module supports testing Unicode identifier validation by providing efficient lookup structures for XID_Start and XID_Continue character classes as defined by Unicode standards.