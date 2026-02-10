# packages/adapter-mock/src/mock-adapter-factory.ts
@source-hash: cadb274391dfa46e
@generated: 2026-02-09T18:14:30Z

## Purpose
Factory implementation for creating mock debug adapter instances used in testing scenarios. Provides a concrete implementation of the IAdapterFactory interface specifically for mock/test environments.

## Core Components

**MockAdapterFactory (L21-91)**: Main factory class implementing IAdapterFactory
- Constructor accepts optional MockAdapterConfig (L24-26)
- Stores config privately for adapter creation
- Handles creation, metadata, and validation of mock adapters

**createAdapter() (L31-33)**: Creates MockDebugAdapter instances
- Takes AdapterDependencies parameter
- Returns IDebugAdapter interface
- Passes stored config to adapter constructor

**getMetadata() (L38-50)**: Returns static adapter metadata
- Language: DebugLanguage.MOCK
- Version: "1.0.0" 
- File extensions: ['.mock', '.test']
- Includes base64 encoded SVG icon
- Documentation URL and version requirements

**validate() (L55-90)**: Async validation with simulated checks
- Always passes basic Node.js runtime check (L62-64)
- Warns on high error probability (>50%) in config (L67-69)
- Warns on high default delay (>1000ms) in config (L72-74)
- Returns FactoryValidationResult with errors, warnings, and system details

**createMockAdapterFactory() (L96-98)**: Factory function
- Convenience function for creating MockAdapterFactory instances
- Accepts optional config parameter

## Dependencies
- Imports core interfaces from '@debugmcp/shared' (L8-14, L16)
- Imports MockDebugAdapter and MockAdapterConfig from local module (L15)

## Key Patterns
- Factory pattern implementation for adapter creation
- Configuration injection through constructor
- Validation simulation for testing environments
- Metadata encapsulation with static values
- Error handling in validation with try-catch (L76-78)