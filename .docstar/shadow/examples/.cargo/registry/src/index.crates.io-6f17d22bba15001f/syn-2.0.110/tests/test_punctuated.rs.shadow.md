# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/tests/test_punctuated.rs
@source-hash: efed2c281b6965d7
@generated: 2026-02-09T18:12:04Z

## Purpose
Test module for `syn::punctuated::Punctuated` data structure functionality, verifying iterator behavior, exact size constraints, memory safety, and error conditions.

## Key Components

### Helper Macros
- **`punctuated!` (L10-22)**: Creates `Punctuated` sequences with trailing comma syntax support. Two variants handle both `($($e:expr,)+)` and `($($e:expr),+)` patterns.
- **`check_exact_size_iterator!` (L24-33)**: Validates that iterators correctly implement `ExactSizeIterator` trait by comparing `size_hint()`, `len()`, and `count()` results.

### Test Functions
- **`pairs()` (L35-51)**: Tests `Punctuated::pairs()`, `pairs_mut()`, and `into_pairs()` methods. Verifies exact size iterator behavior and bidirectional iteration using `next_back()`.
- **`iter()` (L53-66)**: Tests standard iterator methods `iter()`, `iter_mut()`, and `into_iter()`. Similar structure to pairs test but focuses on element iteration rather than pair extraction.
- **`may_dangle()` (L68-85)**: Memory safety test verifying that references can be safely dropped during iteration without causing use-after-free issues. Tests both immutable and mutable reference scenarios.
- **`index_out_of_bounds()` (L87-92)**: Panic test ensuring proper bounds checking behavior when accessing empty `Punctuated` collection via index operator.

## Dependencies
- `syn::punctuated::{Pair, Punctuated}`: Core data structure being tested
- `syn::Token`: Punctuation token types for separators

## Testing Patterns
- Uses `Token![,]` as standard punctuation separator throughout tests
- Employs integer literals (2, 3, 4) as test data for simplicity
- Systematic testing of both owned and borrowed iterator variants
- Explicit panic testing with `#[should_panic]` attribute

## Key Invariants
- All iterators must satisfy `ExactSizeIterator` contract
- Bidirectional iteration should work consistently across iterator types  
- Memory safety must be maintained during concurrent iteration and dropping