# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/process_arg0.rs
@source-hash: 9e4c518ccee4b746
@generated: 2026-02-09T18:12:19Z

**Purpose**: Integration test for Tokio's `Command::arg0()` functionality, specifically testing the ability to override the program name ($0) when executing shell commands.

**Test Coverage**: Single async test `arg0()` (L7-13) that verifies `Command::arg0()` properly sets the program name visible to the executed process.

**Key Components**:
- Uses `tokio::process::Command` (L4, L8) for async process execution
- Test setup creates shell command with custom arg0 (L9): `sh` binary with arg0 override "test_string"
- Shell command execution (L9): `-c "echo $0"` to print the program name
- Assertion (L12): Validates output matches the custom arg0 value

**Platform Constraints**: 
- Unix-only test (L2): Requires `unix` feature and excludes `miri` interpreter
- Depends on "full" tokio feature set (L2)

**Test Pattern**: Standard tokio async test using `#[tokio::test]` macro (L6), follows arrange-act-assert pattern with `Command::output().await` for execution and stdout verification.

**Dependencies**: Requires tokio with full feature set and Unix environment with shell (`sh`) availability.