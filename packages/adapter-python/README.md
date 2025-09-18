# @debugmcp/adapter-python

Python debug adapter for MCP Debugger using debugpy. This package provides:
- PythonDebugAdapter (DAP-facing adapter behavior)
- PythonAdapterFactory (factory/metadata/validation)
- Python executable discovery helpers:
  - findPythonExecutable
  - getPythonVersion
  - setDefaultCommandFinder (testing)
  - CommandNotFoundError (error type)
  - CommandFinder (interface)

## Install (workspace)
This package is intended to be used within the monorepo via npm workspaces.

## Build
npm run build -w @debugmcp/adapter-python

## Test
npm test -w @debugmcp/adapter-python

Note: The package tests do not require Python to be installed. Integration and e2e tests live in the main suite and exercise real Python/debugpy if available.

## Usage (from main package)
import {
  PythonAdapterFactory,
  PythonDebugAdapter,
  findPythonExecutable,
  getPythonVersion
} from '@debugmcp/adapter-python';

## Notes
- Python discovery relies on the `which` module and filters Windows Store aliases.
- For unit tests, mock `findPythonExecutable` and `getPythonVersion` when you don't want to hit the system.
