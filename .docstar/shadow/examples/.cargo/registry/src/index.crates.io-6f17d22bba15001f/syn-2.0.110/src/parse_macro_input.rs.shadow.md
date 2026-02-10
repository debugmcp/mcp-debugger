# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/src/parse_macro_input.rs
@source-hash: e4e22b63d0496d06
@generated: 2026-02-09T18:12:15Z

## Purpose and Responsibility
This file defines the `parse_macro_input!` macro (L108-128), a core utility in the Syn crate for parsing TokenStreams in procedural macros. It provides ergonomic error handling by automatically converting parse failures into compile errors.

## Key Components

### Main Macro: `parse_macro_input!` (L108-128)
A declarative macro with three syntax variants:

1. **Type-based parsing** (L109-116): `parse_macro_input!(tokens as Type)`
   - Uses `syn::parse::<Type>()` to parse TokenStream
   - Returns parsed data on success, compile error on failure

2. **Parser function parsing** (L117-124): `parse_macro_input!(tokens with parser_fn)`
   - Uses `Parser::parse()` trait method with custom parsing function
   - Enables alternative parsing strategies for the same type

3. **Inferred type parsing** (L125-127): `parse_macro_input!(tokens)`
   - Delegates to type-based variant with type inference (`as _`)

## Architecture and Patterns

### Error Handling Strategy
All variants follow the same pattern:
- Parse the TokenStream using appropriate method
- On success: return parsed data directly
- On failure: early return with `TokenStream::from(err.to_compile_error())`

### Dependency Usage
- Uses `$crate::parse` for type-based parsing
- Uses `$crate::parse::Parser::parse` for function-based parsing
- Uses `$crate::__private` namespace for Result, Ok, Err, and TokenStream types

### Macro Attributes
- `#[macro_export]` (L106): Makes macro available to crate users
- `#[cfg_attr(docsrs, doc(cfg(...)))]` (L107): Conditional documentation showing feature requirements

## Critical Constraints
- Must be called from functions returning `proc_macro::TokenStream`
- Designed specifically for proc macro entry points
- Error handling assumes proc macro context (early returns with TokenStream)
- Requires both "parsing" and "proc-macro" features to be enabled

## Integration Points
- Integrates with Syn's `Parse` trait for type-based parsing
- Integrates with `Parser` trait for function-based parsing
- Uses Syn's error conversion system (`to_compile_error()`)
- Part of Syn's broader parsing infrastructure