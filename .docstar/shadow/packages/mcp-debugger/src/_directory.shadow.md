# packages/mcp-debugger/src/
@generated: 2026-02-11T23:47:36Z

## Overall Purpose and Responsibility
This directory serves as the **CLI distribution entry point** for the MCP debugger, providing a carefully orchestrated bootstrap system that ensures protocol compliance while bundling all necessary language adapters for standalone deployment.

## Key Components and Integration

### CLI Entry System (`cli-entry.ts`)
The primary entry point that handles critical pre-execution concerns:
- **Protocol Compliance**: Implements sophisticated console silencing to prevent stdout pollution that would break MCP transport protocols
- **Bootstrap Orchestration**: Manages the precise loading sequence of dependencies through dynamic imports
- **Environment Coordination**: Sets coordination flags (`CONSOLE_OUTPUT_SILENCED`, `DEBUG_MCP_SKIP_AUTO_START`) for cross-module communication

### Adapter Bundling (`batteries-included.ts`)
Static registration system that ensures complete adapter availability:
- **Global Registry Pattern**: Uses `__DEBUG_MCP_BUNDLED_ADAPTERS__` global namespace for cross-module adapter discovery
- **Static Bundling**: Imports JavaScript, Python, and Mock adapters to guarantee esbuild inclusion
- **Deduplication Logic**: Prevents duplicate adapter registrations through Set-based language key tracking

## Data Flow and Architecture

1. **Pre-execution Phase**: `cli-entry.ts` executes console silencing before any imports
2. **Adapter Registration**: `batteries-included.ts` populates global adapter registry via side-effects
3. **Bootstrap Phase**: Dynamic import chain loads main implementation with proper environment setup
4. **Runtime Discovery**: Main system discovers available adapters through global registry

## Public API Surface

**Primary Entry Point**: 
- `cli-entry.ts` - Main executable entry for npx/CLI usage

**Global Adapter Registry**:
- `__DEBUG_MCP_BUNDLED_ADAPTERS__` - Runtime adapter discovery mechanism
- Bundled adapters: JavaScript, Python, Mock

## Internal Organization Patterns

### Critical Execution Order
The directory implements a strict loading sequence:
1. Console silencing (pre-import)
2. Adapter registration (import side-effects) 
3. Main system bootstrap (dynamic import)

### Cross-Module Coordination
Uses environment variables and global objects for loose coupling between bootstrap phases and main implementation, enabling proper protocol compliance without tight dependency injection.

### Distribution Strategy
Designed for standalone CLI distribution via esbuild bundling, ensuring all language adapters are statically included while maintaining runtime flexibility through global registration patterns.

## Key Architectural Invariants
- Console silencing MUST execute before any module imports
- Adapter registration occurs via import side-effects for bundle inclusion
- Bootstrap process coordinates with main implementation through environment flags
- Global registry enables adapter discovery without explicit dependency management