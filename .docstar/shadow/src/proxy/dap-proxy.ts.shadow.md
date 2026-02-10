# src/proxy/dap-proxy.ts
@source-hash: 0323e68b484825b8
@generated: 2026-02-09T18:15:00Z

## Purpose
Clean export interface for DAP (Debug Adapter Protocol) proxy functionality, designed for testing and programmatic use without auto-execution. Acts as a facade module that consolidates exports from multiple DAP proxy components.

## Key Exports

### Core Functionality (L10-11)
- `ProxyRunner`: Main proxy execution engine
- `detectExecutionMode`: Environment detection utility  
- `shouldAutoExecute`: Execution condition checker
- `ProxyRunnerOptions`: Configuration type for proxy runner

### Worker Components (L14-19)
- `DapProxyWorker`: Worker thread implementation for proxy operations
- `ProxyInitPayload`, `DapCommandPayload`, `TerminatePayload`: Message payload types for worker communication

### Dependencies & Utilities (L22-26)
- `createProductionDependencies`: Factory for production dependency injection
- `createConsoleLogger`: Logger factory for console output
- `setupGlobalErrorHandlers`: Global error handling setup

### Message Processing (L29)
- `MessageParser`: DAP message parsing and formatting utility

### State & Interfaces (L32-33)
- `ProxyState`: Proxy lifecycle state enumeration
- `ParentCommand`: Command interface for parent-child communication

## Architecture
Follows clean architecture principles with dependency injection support. Separates auto-executing entry points from programmatic interfaces, enabling controlled testing and integration. All exports use ES modules with explicit file extensions for compatibility.