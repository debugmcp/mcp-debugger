# tests/e2e/rust-example-utils.ts
@source-hash: fb3c0c1e57c3e326
@generated: 2026-02-09T18:15:14Z

## Purpose
Utility module for preparing and building Rust example binaries in end-to-end test environments. Handles cross-platform compilation with caching, Docker-based Linux builds, and Windows GNU/MSVC toolchain detection.

## Key Components

### Types and Constants
- `RustExampleName` (L7): Union type for supported examples ('hello_world' | 'async_example')
- `RustTarget` (L13): Build target type ('host' | 'linux')
- `ExamplePaths` (L15-18): Interface defining source and binary path structure
- `PrepareRustExampleOptions` (L20-22): Configuration for target selection
- Constants (L9-12): Platform targets, Docker image, and build stamp file name

### Core Functions
- `prepareRustExample()` (L26-51): Main entry point that caches and orchestrates example preparation. Returns source and binary paths for given example name and target.
- `buildExampleBinary()` (L53-89): Platform-aware build orchestration with Windows toolchain fallback logic
- `resolveBinaryPath()` (L91-119): Cross-platform binary path resolution with target-specific directory structures

### Build Mechanisms
- `buildExampleBinaryInDocker()` (L121-153): Linux binary compilation using Docker container with workspace mounting
- `linuxBinaryNeedsBuild()` (L155-181): Smart rebuild detection based on file timestamps and workspace path changes
- `runCargoCommand()` (L183-203): Cargo process spawning with promise-based completion
- `runDockerCommand()` (L205-217): Docker process spawning wrapper

### Platform Support
- Windows: Handles both GNU and MSVC toolchains with dlltool detection
- Linux: Docker-based cross-compilation from any host platform  
- Host builds: Native compilation using system Rust toolchain

## Dependencies
- External: `findDlltoolExecutable` from adapter-rust package for Windows GNU builds
- Node.js: fs, path, child_process for file operations and process spawning

## Key Patterns
- **Caching**: `preparedExamples` Map (L24) prevents redundant builds using `${exampleName}:${target}` keys
- **Graceful fallback**: Windows builds attempt GNU first, fall back to MSVC on failure (L76-88)
- **Docker isolation**: Linux builds use mounted workspace with locked dependencies
- **Build stamps**: `.debug-mcp-linux-build` files track workspace context for rebuild decisions

## Critical Constraints
- Windows requires either dlltool.exe in PATH or stable-gnu toolchain for GNU builds
- Docker must be available for Linux target builds
- Examples must exist in `examples/rust/${exampleName}` directory structure
- Binary compilation follows Cargo's standard `target/debug/` output structure