# scripts/memwatch.ps1
@source-hash: b84d33adfef7776e
@generated: 2026-02-10T00:42:04Z

## Primary Purpose
PowerShell memory monitoring tool that continuously samples Windows system memory metrics and top memory-consuming processes, logging to CSV for analysis. Designed for long-running memory usage tracking and debugging memory leaks.

## Key Parameters & Configuration (L1-5)
- `$IntervalSec`: Sampling interval in seconds (default: 10)
- `$TopN`: Number of top memory-consuming processes to track (default: 10) 
- `$OutPath`: CSV output file path with timestamp-based naming

## Core Functions

### Memory Conversion & Counter Access
- `GB()` (L9): Converts bytes to gigabytes with 2 decimal precision
- `GetCounterSafe()` (L11-17): Safely retrieves Windows performance counters, returns null on failure
- `GetCounterSafeOrZero()` (L19-22): Wrapper that returns 0 instead of null for missing counters

### CSV Output Management
- `Write-Record()` (L34-43): Handles CSV export with header creation on first write, append mode thereafter

## Main Monitoring Loop (L45-136)

### System Memory Metrics Collection (L47-65)
Gathers comprehensive memory statistics via WMI and performance counters:
- Physical memory (total/free) from Win32_OperatingSystem
- Commit charge and limits
- Memory pools (paged/nonpaged)
- Cache and standby memory
- Memory compression statistics
- Pagefile usage percentage

### Process Memory Analysis (L66-82)
- Aggregates private memory and working set across all processes
- Identifies top N processes by private memory usage
- Calculates kernel memory approximation and unattributed commit delta

### Dynamic CSV Structure (L83-121)
Creates ordered hashtable with:
- Fixed system metrics (timestamp, totals, percentages)
- Dynamic columns for top N processes (name, PID, private MB, working set MB)
- Null padding for missing top-N entries to maintain consistent CSV schema

### Status Reporting (L123-133)
- Console output with formatted memory status
- Warning alerts when commit usage ≥95%
- Error handling with iteration continuation

## Dependencies
- Windows PowerShell with WMI access
- Performance counter access (`Get-Counter`)
- File system write permissions for log directory

## Architectural Decisions
- Continuous sampling with configurable intervals
- CSV append strategy for long-running data collection
- Graceful degradation with counter access failures
- Dynamic column generation for flexible top-N tracking
- Memory calculations consistently use GB precision for human readability

## Critical Invariants
- CSV schema remains consistent across iterations via null padding
- All counter access failures are handled silently (ErrorActionPreference)
- Directory creation ensures output path availability
- Memory calculations account for Windows memory management complexity (standby, compressed, etc.)