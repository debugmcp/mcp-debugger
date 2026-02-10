# src/proxy/dap-proxy.ts
@source-hash: 0323e68b484825b8
@generated: 2026-02-10T00:41:45Z

## Purpose
Clean export module for DAP (Debug Adapter Protocol) proxy functionality, designed for testing and programmatic use without auto-execution. Acts as a facade providing access to all proxy components.

## Key Exports

### Core Functionality (L10-11)
- `ProxyRunner`: Main proxy execution engine
- `detectExecutionMode`: Environment detection utility  
- `shouldAutoExecute`: Auto-execution logic
- `ProxyRunnerOptions`: Configuration interface

### Worker System (L14-19)
- `DapProxyWorker`: Worker thread implementation for proxy operations
- `ProxyInitPayload`, `DapCommandPayload`, `TerminatePayload`: Worker communication interfaces

### Dependencies & Infrastructure (L22-26)
- `createProductionDependencies`: Factory for production dependency injection
- `createConsoleLogger`: Logging utility factory
- `setupGlobalErrorHandlers`: Error handling setup

### Message Processing (L29)
- `MessageParser`: DAP message parsing functionality

### State & Interfaces (L32-33)
- `ProxyState`: State management enum/interface
- `ParentCommand`: Command structure interface

## Architecture
File serves as a clean API boundary, re-exporting functionality from multiple specialized modules without side effects. Enables safe importing for testing while maintaining separation of concerns across the proxy system.

## Dependencies
- `./dap-proxy-core.js`: Core proxy logic
- `./dap-proxy-worker.js`: Worker implementation  
- `./dap-proxy-interfaces.js`: Type definitions
- `./dap-proxy-dependencies.js`: Dependency injection
- `./dap-proxy-message-parser.js`: Message parsing