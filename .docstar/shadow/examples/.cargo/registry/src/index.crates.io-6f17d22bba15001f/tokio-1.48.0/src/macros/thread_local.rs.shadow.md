# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/macros/thread_local.rs
@source-hash: c03b4bd975825f89
@generated: 2026-02-09T18:06:34Z

**Purpose**: Conditional thread-local storage abstraction that switches between Loom's testing implementation and standard library implementation based on build configuration.

**Key Macros**:
- `tokio_thread_local!` (L2-11): Loom-enabled version active when both `loom` and `test` features are enabled
  - Handles const initialization syntax (L3-8): Transforms `const { expr }` pattern to work with Loom's thread_local macro
  - Fallback pattern (L10): Delegates all other token patterns directly to `loom::thread_local!`
- `tokio_thread_local!` (L14-17): Standard version active in non-test builds, delegates to `::std::thread_local!`

**Architecture Pattern**: Feature-gated conditional compilation using `#[cfg]` attributes to provide test-time vs runtime implementations. The Loom version includes special handling for const initialization syntax that standard thread_local doesn't support in the same way.

**Dependencies**:
- `loom::thread_local!` (test builds with loom feature)
- `::std::thread_local!` (standard builds)

**Usage Context**: Part of Tokio's testing infrastructure, allowing thread-local variables to be properly tracked and debugged under Loom's concurrency testing framework while maintaining standard behavior in production builds.