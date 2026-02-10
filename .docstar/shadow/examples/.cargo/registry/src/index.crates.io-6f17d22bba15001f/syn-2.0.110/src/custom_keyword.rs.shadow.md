# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/src/custom_keyword.rs
@source-hash: 322114e36ae43a2f
@generated: 2026-02-09T18:12:18Z

## Purpose
This file defines the `custom_keyword!` macro system that allows creating custom keyword tokens for syn's parser. It enables treating arbitrary identifiers as keywords with full parsing, printing, and token stream integration.

## Key Components

### Primary Macro
- `custom_keyword!` (L90-123): Main macro that generates a complete keyword token type
  - Creates a struct with a single `span` field (L93-96)
  - Generates constructor function (L100-106) 
  - Implements Default trait (L109-115)
  - Conditionally implements parsing, printing, cloning, and extra traits (L117-120)

### Conditional Implementation Macros
Feature-gated implementations that provide different capabilities:

- `impl_parse_for_custom_keyword!` (L129-163): Implements parsing functionality
  - `CustomToken` trait for peeking (L132-144)
  - `Parse` trait for actual parsing (L146-161)
  - Uses cursor-based token stream navigation
  - Empty implementation when "parsing" feature disabled (L169-171)

- `impl_to_tokens_for_custom_keyword!` (L177-186): Implements token generation
  - `ToTokens` trait for quote! macro integration
  - Converts back to identifier tokens with preserved span
  - Empty when "printing" feature disabled (L192-194)

- `impl_clone_for_custom_keyword!` (L200-211): Implements Copy/Clone traits
  - Provides both Copy and Clone implementations
  - Empty when "clone-impls" feature disabled (L217-219)

- `impl_extra_traits_for_custom_keyword!` (L225-252): Implements utility traits
  - Debug, Eq, PartialEq, Hash implementations
  - Debug shows "Keyword [name]" format (L227-238)
  - PartialEq always returns true (L242-246)
  - Hash is no-op (L248-250)
  - Empty when "extra-traits" feature disabled (L258-260)

## Architecture Patterns

### Feature-Based Conditional Compilation
Uses cfg attributes to conditionally compile different trait implementations based on crate features, allowing fine-grained control over generated code size and dependencies.

### Macro-Generated Types
The main macro generates complete types with associated functions and trait implementations, providing a DSL-like experience for keyword definition.

### Span Preservation
All generated types maintain `proc_macro2::Span` information for proper error reporting and source location tracking.

### Private API Pattern
Helper macros are marked as `#[doc(hidden)]` and use `__private` module paths to prevent direct usage while remaining accessible to the main macro.

## Usage Pattern
Typically invoked within a `kw` or `keyword` module to create namespaced custom keywords that integrate seamlessly with syn's parsing infrastructure.