# tests/test-utils/helpers/port-manager.ts
@source-hash: c48ef33850da8718
@generated: 2026-02-09T18:14:35Z

## Purpose
Test utility for centralized port allocation management to prevent conflicts between concurrent test runs. Provides singleton-based port reservation system with range-based allocation.

## Key Components

### PortRange Enum (L12-16)
Defines three port ranges for different test types:
- `UNIT_TESTS = 0` → ports 5679-5779
- `INTEGRATION = 100` → ports 5779-5879  
- `E2E = 200` → ports 5879-5979

### TestPortManager Class (L18-102)
Core port allocation manager with state tracking:

**State Management:**
- `basePort: number` (L19) - Base port 5679
- `usedPorts: Set<number>` (L20) - Tracks allocated ports
- `rangeSizes: Map<PortRange, number>` (L21) - Maps ranges to 100-port blocks

**Key Methods:**
- `getPort(range?: PortRange): number` (L39-63) - Primary allocation method with fallback logic
- `releasePort(port: number): void` (L69-71) - Deallocates specific port
- `reset(): void` (L76-78) - Clears all allocations
- `isPortInUse(port: number): boolean` (L85-87) - Port status check
- `getPorts(count: number, range?: PortRange): number[]` (L95-101) - Bulk allocation

### Singleton Export (L104-107)
- `portManager` - Default singleton instance for global test use

## Architecture Patterns
- **Singleton Pattern**: Single global instance prevents allocation conflicts
- **Range-based Allocation**: Segregates port usage by test type
- **Fallback Strategy**: Falls back to scanning full 1000-port range if preferred range exhausted
- **State Tracking**: Set-based tracking for O(1) port status checks

## Critical Behavior
- Port allocation is **not thread-safe** - assumes single-threaded test execution
- Range calculation: `basePort + rangeOffset` determines starting port
- Fallback range spans 1000 ports (5679-6678) when preferred ranges exhausted
- Throws error if all 1000 fallback ports are allocated