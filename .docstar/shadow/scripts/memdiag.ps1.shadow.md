# scripts/memdiag.ps1
@source-hash: defc069a7d6b9f32
@generated: 2026-02-09T18:15:19Z

## Primary Purpose
Windows memory diagnostic PowerShell script that provides comprehensive memory usage analysis through multiple perspectives - system-level metrics, performance counters, and per-process breakdowns. Designed for troubleshooting memory issues and capacity planning.

## Key Components

### Parameters & Configuration (L1-5)
- `$TopN` parameter (L2): Controls number of top processes displayed (default: 25)
- Error suppression enabled (L5) for graceful handling of permission/counter failures

### Core Functions
- `GB()` function (L7): Utility for converting bytes to GB with 2 decimal precision

### System Memory Analysis (L11-37)
Gathers comprehensive system-level memory metrics:
- Physical memory totals via Win32_OperatingSystem (L12-14)
- Performance counters for commit, pools, cache, standby memory (L16-26)
- Memory compression and pagefile usage (L24-26)
- Process memory aggregation (L28-29)

### Commit Memory Breakdown (L39-54)
Attempts to attribute committed memory by analyzing:
- Page table bytes, system code, drivers, cache (L41-46)
- Kernel commit approximation and delta calculation (L46-47)
- Identifies unattributed committed memory (L53)

### Performance Counter Process Analysis (L56-145)
Three separate attempts to analyze per-process memory via performance counters:

1. **Private Bytes Analysis (L58-78)**
   - Maps process instances to PIDs (L61-62)
   - Sorts by private memory usage (L64-70)
   - Graceful degradation on permission failures (L75-77)

2. **Committed Bytes Analysis (L81-102)**
   - Alternative commit size measurement (L83-94)
   - Similar structure with error handling (L99-101)

3. **Commit Size Analysis with Fallback (L105-145)**
   - Primary: Uses "Commit Size" counter (closest to Task Manager) (L107-122)
   - Fallback: Virtual Bytes when Commit Size unavailable (L126-143)
   - Nested try-catch for graceful degradation (L125-144)

### Process Rankings (L147-179)
Multiple process views for different analysis needs:
- Top by Private Bytes (L148-153)
- Top by Working Set (L156-162)
- Special processes (Docker, WSL, MemoryCompression) (L166-171)
- Handle count analysis for leak detection (L174-179)

## Dependencies
- Windows Performance Counters (requires appropriate permissions)
- Win32_OperatingSystem CIM class
- Get-Process cmdlet

## Architecture Patterns
- **Graceful Degradation**: Multiple fallback mechanisms for counter access failures
- **Multi-perspective Analysis**: Same data viewed through different lenses (system vs process)
- **Error Isolation**: Try-catch blocks prevent single counter failure from breaking entire analysis
- **Consistent Formatting**: Standardized MB/GB conversion and table output

## Critical Constraints
- Requires Windows environment with performance counter access
- Some counters require elevated permissions
- Counter availability varies by Windows version (Commit Size counter)
- Memory calculations are approximations due to kernel memory attribution complexity