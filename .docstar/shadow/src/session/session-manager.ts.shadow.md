# src/session/session-manager.ts
@source-hash: a7c803ad78697990
@generated: 2026-02-09T18:15:07Z

## Primary Purpose
Main entry point and facade for debug session management. This file serves as a composition root that extends SessionManagerOperations to provide a complete session management solution with ProxyManager delegation for process and DAP communication handling.

## Key Classes and Functions
- **SessionManager (L28)**: Main class extending SessionManagerOperations to compose all session management functionality
- **handleAutoContinue() (L32-36)**: Protected method stub that throws NotImplementedError - intended to handle automatic continuation of debug sessions but currently incomplete

## Dependencies and Relationships  
- **SessionManagerOperations (L10, L23)**: Core operations class that this extends
- **Type exports (L13-20)**: Re-exports types from session-manager-core.js and session-manager-operations.js for convenience
- **ProxyManager**: Referenced in documentation as the delegation target for process management (not directly imported)

## Architectural Patterns
- **Composition over Inheritance**: Uses class extension but delegates actual work to ProxyManager instances
- **Facade Pattern**: Acts as simplified interface to complex session management subsystem
- **Type Re-exports**: Centralizes type definitions for consumer convenience

## Critical Constraints
- Each debug session requires its own ProxyManager instance for process isolation
- handleAutoContinue method is incomplete and will throw runtime errors if called
- Session context management appears to be handled in parent classes

## Notable Design Decisions
- Minimal implementation that primarily re-exports and extends existing functionality
- Incomplete handleAutoContinue suggests this is a work-in-progress or template class
- Heavy reliance on composition through SessionManagerOperations inheritance