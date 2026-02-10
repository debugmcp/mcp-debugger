# tests/e2e/rust-example-utils.ts
@source-hash: fb3c0c1e57c3e326
@generated: 2026-02-10T00:42:03Z

## Primary Purpose
E2E test utility for building and preparing Rust example binaries across different platforms and targets. Handles cross-platform compilation with smart caching and Docker-based Linux builds.

## Key Types and Interfaces
- `RustExampleName` (L7): Union type restricting examples to 'hello_world' | 'async_example'
- `RustTarget` (L13): 'host' | 'linux' target platforms
- `ExamplePaths` (L15-18): Contains sourcePath and binaryPath for compiled examples
- `PrepareRustExampleOptions` (L20-22): Configuration for target platform selection

## Core Functions

### prepareRustExample (L26-51)
Main entry point that coordinates building and locating Rust example binaries. Implements caching via `preparedExamples` Map (L24) using `${exampleName}:${target}` keys. Returns ExamplePaths with source and binary locations.

### buildExampleBinary (L53-89)
Platform-aware build orchestration:
- Linux target: Delegates to Docker build (L58-60)
- Windows: Attempts GNU toolchain first with dlltool setup (L63-82), falls back to MSVC
- Other platforms: Direct cargo build

### resolveBinaryPath (L91-119)
Determines correct binary location based on platform and target:
- Linux: `target/debug/{binaryName}`
- Windows GNU: `target/{WINDOWS_GNU_TARGET}/debug/{binaryName}.exe`
- Fallback: `target/debug/{binaryName}[.exe]`

### buildExampleBinaryInDocker (L121-153)
Containerized Linux build using configurable Docker image. Implements incremental build detection via build stamps (L128). Mounts examples directory as workspace volume.

### linuxBinaryNeedsBuild (L155-181)
Smart rebuild detection comparing:
- Binary existence
- Workspace path consistency via stamp files
- Source vs binary modification times

## Helper Functions
- `runCargoCommand` (L183-203): Promisified cargo subprocess execution
- `runDockerCommand` (L205-217): Promisified docker subprocess execution  
- `pathExistsAsync` (L219-226): Async file existence check

## Dependencies and Configuration
- Imports `findDlltoolExecutable` from adapter-rust package for Windows GNU builds
- `DOCKER_RUST_IMAGE` (L11): Configurable via env var, defaults to rust:1.83-slim
- `WINDOWS_GNU_TARGET` (L9): x86_64-pc-windows-gnu
- `LINUX_BUILD_STAMP` (L12): .debug-mcp-linux-build file for tracking builds

## Architecture Patterns
- Caching layer prevents redundant builds
- Graceful fallbacks for Windows build toolchains
- Docker isolation for cross-platform Linux builds
- File system timestamp-based incremental compilation
- Error propagation with descriptive messages for missing dependencies