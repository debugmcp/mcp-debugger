# scripts/memdiag.ps1
@source-hash: defc069a7d6b9f32
@generated: 2026-02-10T00:42:03Z

## Windows Memory Diagnostic Script

**Primary Purpose**: Comprehensive Windows memory usage analysis tool that provides system-level and process-level memory insights through multiple data sources.

**Core Architecture**: PowerShell script that combines WMI queries, performance counters, and process objects to create a detailed memory diagnostic snapshot.

### Key Components

**Parameters & Configuration (L1-5)**:
- `$TopN` parameter controls number of processes shown in rankings (default: 25)
- `$ErrorActionPreference = 'SilentlyContinue'` suppresses non-critical errors

**Utility Functions**:
- `GB()` helper function (L7) converts bytes to gigabytes with 2 decimal precision

### Data Collection Strategies

**System Memory Overview (L11-37)**:
- Uses `Win32_OperatingSystem` CIM instance for total/free physical memory
- Queries 10+ performance counters for detailed memory metrics:
  - Committed bytes vs commit limit
  - Kernel pools (paged/nonpaged) 
  - File cache and standby cache tiers
  - Memory compression statistics
  - Pagefile utilization
- Aggregates process private bytes and working set totals

**Commit Attribution Analysis (L39-54)**:
- Attempts to break down committed memory by component
- Calculates approximate kernel commit from pools, page tables, system code
- Reports "delta" representing unattributed committed memory

**Process Memory Analysis (Multiple Approaches)**:
1. **Private Bytes via Perf Counters (L56-78)**: Most accurate process memory attribution
2. **Committed Bytes via Perf Counters (L80-102)**: Alternative commit measurement
3. **Commit Size via Perf Counters (L104-145)**: Task Manager equivalent, with Virtual Bytes fallback
4. **Get-Process Analysis (L147-162)**: Native PowerShell object approach for Private/Working Set

**Specialized Reporting**:
- Special process monitoring (L165-171): MemoryCompression, WSL, Docker processes
- Handle count analysis (L174-179): Leak detection indicator

### Error Handling Patterns

- Graceful degradation with try-catch blocks around performance counter queries
- Fallback mechanisms when newer counters unavailable (Commit Size → Virtual Bytes)
- Process ID mapping with null checks for missing instances

### Key Dependencies

- Windows Performance Counters subsystem
- CIM/WMI access for system information  
- Administrative privileges recommended for complete counter access

### Output Structure

Produces structured console output with:
- System memory summary with percentages
- Tabular process rankings by various metrics
- Memory composition breakdown
- Special process monitoring results