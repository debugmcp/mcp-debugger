# packages/adapter-rust/src/utils/
@generated: 2026-02-09T18:16:10Z

## Overall Purpose
The `utils` directory provides essential toolchain and system integration utilities for the Rust adapter package. This collection of modules handles Rust/Cargo environment detection, project analysis, binary classification, debugging tool resolution, and cross-platform tooling operations necessary for comprehensive Rust development support.

## Key Components and Relationships

**Core Toolchain Layer**:
- `rust-utils.ts`: Foundation module providing Rust/Cargo installation verification, version detection, and host system analysis
- `cargo-utils.ts`: Specialized Cargo operations including project parsing, building, testing, and dependency management
- `codelldb-resolver.ts`: Debug tooling integration for locating and validating CodeLLDB debugger executables

**Analysis and Detection Layer**:
- `binary-detector.ts`: Post-compilation analysis for classifying Windows PE binaries (MSVC/GNU) and debug information detection

## Public API Surface

### Primary Entry Points
- **Environment Verification**: `checkCargoInstallation()`, `checkRustInstallation()`, `getCargoVersion()`
- **Project Operations**: `resolveCargoProject()`, `buildCargoProject()`, `runCargoTest()`, `needsRebuild()`
- **Binary Analysis**: `detectBinaryFormat()` - comprehensive Windows PE binary classification
- **Tool Resolution**: `resolveCodeLLDBExecutable()`, `findDlltoolExecutable()`
- **Path Utilities**: `findCargoProjectRoot()`, `getRustBinaryPath()`, `findBinaryTargets()`

### Cross-Module Integration
- `rust-utils.ts` re-exports `resolveCodeLLDBExecutable` as unified tooling interface
- `cargo-utils.ts` leverages filesystem utilities for intelligent rebuild detection
- `binary-detector.ts` operates on outputs from cargo build processes

## Internal Organization and Data Flow

**Discovery Phase**: Environment verification → project root detection → metadata extraction
**Analysis Phase**: Target identification → dependency analysis → build requirement assessment  
**Execution Phase**: Build/test operations → binary path resolution → format classification
**Tooling Phase**: Debug tool resolution → platform-specific executable location

## Important Patterns and Conventions

### Error Handling Strategy
- **Graceful Degradation**: Most functions return `null` or empty arrays rather than throwing exceptions
- **Multi-path Fallbacks**: Tool resolution attempts multiple candidate locations before failing
- **Environment Variable Overrides**: Provides escape hatches for custom tool installations

### Cross-Platform Considerations
- **Windows Compatibility**: Automatic `.exe` extension handling, MSVC/GNU toolchain detection
- **Platform Mapping**: Architecture-aware directory resolution (`darwin-arm64`, `linux-x64`, etc.)
- **Shell Integration**: Uses `shell: true` for reliable cross-platform subprocess execution

### Performance Optimizations
- **Lazy Evaluation**: File system scanning only when needed
- **Caching Strategy**: Modification time comparisons for rebuild decisions
- **Bounded Scanning**: 1MB limit on binary analysis to prevent memory issues

### Key Dependencies
- **Node.js Core**: `fs/promises`, `child_process.spawn`, `path` modules
- **Process Integration**: Heavy reliance on spawning cargo/rustc subprocesses
- **JSON Processing**: Cargo metadata parsing and version file handling

## System Role
This utilities package serves as the foundational layer enabling higher-level Rust development operations. It abstracts platform differences, provides reliable toolchain integration, and delivers essential project introspection capabilities that other adapter components depend on for compilation, debugging, and analysis workflows.