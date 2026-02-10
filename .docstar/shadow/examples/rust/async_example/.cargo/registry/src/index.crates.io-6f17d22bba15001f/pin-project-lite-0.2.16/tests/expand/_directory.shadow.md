# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/expand/
@generated: 2026-02-09T18:16:39Z

## Pin-Project-Lite Macro Expansion Test Suite

This directory contains comprehensive test cases for validating the `pin-project-lite` crate's macro expansion system. It serves as both a verification suite and reference implementation demonstrating how the `pin_project!` macro transforms user code into safe pin projection patterns across diverse scenarios.

### Overall Purpose and Responsibility

The directory systematically tests the correctness of macro-generated code by comparing source macro usage against expected expanded output. Each test validates that the pin-project-lite macro generates proper Rust code that maintains pin safety guarantees while providing ergonomic field access through projections.

### Key Components and Organization

The directory is organized into specialized test categories:

**Core Functionality Tests**:
- `default/`: Tests standard projection behavior with conventional naming
- `naming/`: Validates custom projection type naming capabilities  
- `multifields/`: Tests handling of multiple pinned/unpinned fields in single types
- `pub/`: Ensures correct expansion for public types and APIs

**Advanced Feature Tests**:
- `not_unpin/`: Tests explicit `!Unpin` directive handling
- `pinned_drop/`: Validates integration with custom drop implementations

### Test Architecture Pattern

Each subdirectory follows a consistent **source-expansion pair** testing methodology:
- **Source files** (`.rs`): Original code using `pin_project!` macro annotations
- **Expansion files** (`.expanded.rs`): Expected macro-generated code for validation
- **Paired coverage**: Both struct and enum variants tested systematically

### Generated Pin Projection Infrastructure

The macro expansion creates a comprehensive safety and usability layer:

**Projection Types**:
- **Mutable projections** (`*Proj`): Convert pinned fields to `Pin<&mut T>`, unpinned to `&mut T`
- **Immutable projections** (`*ProjRef`): Convert pinned fields to `Pin<&T>`, unpinned to `&T`
- **Replace projections** (`*ProjReplace`): Enable safe field replacement using phantom markers

**Core API Methods**:
- `project()`: Safe mutable field access from `Pin<&mut Self>`
- `project_ref()`: Safe immutable field access from `Pin<&Self>`
- `project_replace()`: Complex field replacement operations (enums)

**Safety Infrastructure**:
- Conditional `Unpin` implementations based on pinned field analysis
- Compile-time guards preventing unsafe patterns (`Drop`, `#[repr(packed)]`)
- Phantom types and lifetime tracking for memory safety
- Unsafe operation encapsulation within safe APIs

### Data Flow and Testing Strategy

1. **Macro Processing**: `pin_project!` analyzes field annotations and configuration attributes
2. **Code Generation**: Produces projection types, safety infrastructure, and accessor methods
3. **Expansion Validation**: Generated code compared against reference implementations
4. **Safety Verification**: Ensures pin invariants maintained across all projection patterns

### Key Testing Scenarios

The test suite validates:
- **Mixed field pinning** (pinned/unpinned combinations)
- **Generic type parameters** with different pinning requirements
- **Custom naming** for projection types
- **Public API compatibility** and visibility
- **Advanced features** (explicit `!Unpin`, custom drop handlers)
- **Complex type patterns** (enums with multiple variants)

### Public API Surface

**Entry Points**:
- `pin_project!` macro with various configuration options
- Generated projection methods on annotated types
- Custom naming attributes (`#[project = Name]`, `#[project_ref = RefName]`, `#[project_replace = ReplaceName]`)

**Core Patterns**:
- `#[pin]` field annotation for selective pinning
- Automatic safety infrastructure generation
- Zero-cost abstraction through inlined unsafe operations

### Dependencies and Integration

- `pin_project_lite`: Core macro and safety primitives
- Standard library: `Pin`, `PhantomData`, pointer operations
- Rust compiler: Macro expansion and compile-time verification

This directory serves as the definitive test suite ensuring pin-project-lite generates correct, safe, and efficient code for all supported pin projection scenarios while maintaining compatibility with Rust's pin ecosystem.