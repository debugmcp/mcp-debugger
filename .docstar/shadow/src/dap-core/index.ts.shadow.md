# src/dap-core/index.ts
@source-hash: 4a07c015e28495f7
@generated: 2026-02-10T00:41:41Z

## Primary Purpose
Entry point module for the DAP (Debug Adapter Protocol) Core package that provides functional utilities for handling debug adapter protocol operations. Acts as a centralized export hub for the core debugging functionality.

## Module Structure
This is a pure re-export module that aggregates three main areas of functionality:

- **Types Module** (L6): Exports TypeScript type definitions and interfaces for DAP operations
- **State Management Module** (L9): Exports functions for managing debugging session state 
- **Handlers Module** (L12): Exports protocol message handlers and processing functions

## Architecture Pattern
Follows the "barrel export" pattern to provide a clean, unified API surface. All exports use ES module syntax with explicit `.js` extensions, indicating this is part of a TypeScript project compiled to ES modules.

## Key Dependencies
- `./types.js` - Core type definitions
- `./state.js` - State management utilities  
- `./handlers.js` - Protocol handler implementations

## Usage Context
This module serves as the main entry point for consumers of the DAP core functionality, allowing them to import all necessary types, state management functions, and handlers through a single import statement.