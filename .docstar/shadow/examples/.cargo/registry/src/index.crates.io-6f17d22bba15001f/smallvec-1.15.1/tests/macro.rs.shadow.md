# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/smallvec-1.15.1/tests/macro.rs
@source-hash: 22ad4f6f104a599f
@generated: 2026-02-09T18:11:47Z

## Purpose
Test file for the `smallvec!` macro that validates macro hygiene by testing without importing the macro into scope, forcing the macro to use `$crate` prefixes for reliable self-reference during recursive expansion.

## Key Components

**`smallvec()` test function (L4-24)**
- Primary test that validates `smallvec!` macro behavior against standard `vec!` macro
- Creates `SmallVec<[i32; 2]>` instances using fully-qualified macro path `smallvec::smallvec!`
- Tests both repetition syntax (`[value; count]`) and list syntax (`[item1, item2, ...]`)

**`check!` internal macro (L8-13)**
- Helper macro that creates a SmallVec and compares it against equivalent `vec!` output
- Takes token tree parameter `$init` representing vec initialization syntax
- Asserts element-wise equality between SmallVec and Vec contents

## Test Coverage
- **Repetition patterns (L15-18)**: Tests `[0; 0]`, `[1; 1]`, `[2; 2]`, `[3; 3]` syntax
- **List patterns (L20-23)**: Tests `[]`, `[1]`, `[1, 2]`, `[1, 2, 3]` syntax
- Validates both inline and spill-to-heap scenarios (SmallVec capacity is 2)

## Dependencies
- `smallvec` crate with `SmallVec` type and `smallvec!` macro
- Standard library `vec!` macro for comparison testing

## Architecture Notes
- Deliberately avoids `use smallvec::smallvec` to test macro hygiene
- Macro recursion testing ensures proper `$crate` prefix usage in macro definitions
- Element-wise comparison using dereference operator validates identical behavior between SmallVec and Vec