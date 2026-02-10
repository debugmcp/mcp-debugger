# tests/test-utils/helpers/port-manager.ts
@source-hash: c48ef33850da8718
@generated: 2026-02-10T00:41:25Z

## Purpose
Test utility for centralized port allocation to prevent conflicts between concurrent test runs. Manages port assignment across different test categories with dedicated ranges.

## Core Components

### PortRange Enum (L12-16)
Defines test type categories with base offsets:
- `UNIT_TESTS = 0` → ports 5679-5779
- `INTEGRATION = 100` → ports 5779-5879  
- `E2E = 200` → ports 5879-5979

### TestPortManager Class (L18-102)
**State Management:**
- `basePort: number` (L19) - Starting port (5679)
- `usedPorts: Set<number>` (L20) - Tracks allocated ports
- `rangeSizes: Map<PortRange, number>` (L21) - Range size mapping (all 100 ports)

**Key Methods:**
- `getPort(range?)` (L39-63) - Primary allocation method with fallback logic
- `releasePort(port)` (L69-71) - Returns port to available pool
- `reset()` (L76-78) - Clears all allocations
- `isPortInUse(port)` (L85-87) - Port status checker
- `getPorts(count, range?)` (L95-101) - Bulk port allocation

### Singleton Export (L104-107)
Exports single instance `portManager` for global test coordination.

## Allocation Strategy
1. **Range-based**: Attempts allocation within specified test type range
2. **Fallback**: If range exhausted, searches entire 1000-port space (L54-59)
3. **Error handling**: Throws if no ports available in 1000-port window (L62)

## Architecture Notes
- Thread-safe for single process (Set operations)
- No persistence - state resets between process restarts
- Conservative 1000-port search limit prevents infinite loops
- Range sizes hardcoded to 100 ports each in constructor