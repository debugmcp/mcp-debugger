# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/unicode-ident-1.0.22/src/tables.rs
@source-hash: 96d345fb3df2dc67
@generated: 2026-02-09T18:12:42Z

## Unicode Identifier Lookup Tables

This file contains auto-generated Unicode lookup tables for the `unicode-ident` crate, specifically targeting Unicode 17.0.0. It implements trie-based data structures for efficiently determining valid Unicode identifier characters.

### Core Data Structures

**Alignment Wrappers (L7-10):**
- `Align8<T>` - Forces 8-byte alignment for performance optimization
- `Align64<T>` - Forces 64-byte alignment for cache-line optimization

**Unicode Metadata (L12):**
- `UNICODE_VERSION` - Current Unicode version tuple (17, 0, 0)

**ASCII Fast Path Constants (L14-15):**
- `ASCII_START` - Bitmask for ASCII identifier start characters (A-Z, a-z, _)
- `ASCII_CONTINUE` - Bitmask for ASCII identifier continuation characters (includes 0-9)

**Chunk Size (L17):**
- `CHUNK` - Block size of 64 bytes for trie traversal optimization

### Trie Data Structures

**Start Character Trie (L19-46):**
- `TRIE_START` - 8-byte aligned lookup table (411 bytes) for Unicode identifier start characters
- Used to determine if a character can begin an identifier

**Continue Character Trie (L48-162):**
- `TRIE_CONTINUE` - 8-byte aligned lookup table (1793 bytes) for Unicode identifier continuation characters  
- Used to determine if a character can appear after the first character in an identifier

**Leaf Node Data (L164-663):**
- `LEAF` - 64-byte aligned bitmap table (7968 bytes) containing the actual character classification bits
- Terminal nodes of the trie structure containing packed boolean flags

### Architecture

The implementation uses a three-tier lookup system:
1. **ASCII Fast Path** - Direct bitmask lookup for common ASCII characters
2. **Trie Navigation** - Multi-level trie using `TRIE_START`/`TRIE_CONTINUE` tables
3. **Leaf Resolution** - Final bitmap lookup in `LEAF` table

This design optimizes for:
- Cache efficiency through strategic alignment
- Fast ASCII character handling (common case)
- Compact Unicode coverage for the full Unicode 17.0.0 character set
- Memory efficiency through trie compression

The tables are generated from official Unicode data files and should not be manually edited.