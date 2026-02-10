# scripts/memwatch.ps1
@source-hash: b84d33adfef7776e
@generated: 2026-02-09T18:15:18Z

## Purpose
PowerShell script for continuous memory monitoring on Windows systems. Collects detailed system memory metrics and process-level memory usage, exporting data to CSV for analysis and alerting on high memory pressure.

## Parameters & Configuration
- **IntervalSec** (L2): Monitoring interval in seconds (default 10)
- **TopN** (L3): Number of top memory-consuming processes to track (default 10)  
- **OutPath** (L4): CSV output file path with timestamp-based naming
- **ErrorActionPreference** (L7): Set to 'SilentlyContinue' for fault tolerance

## Core Functions

### Utility Functions
- **GB** (L9): Converts bytes to gigabytes with 2 decimal precision
- **GetCounterSafe** (L11-17): Safe performance counter retrieval with error handling, returns null on failure
- **GetCounterSafeOrZero** (L19-22): Wrapper that returns 0 instead of null for missing counters
- **Write-Record** (L34-43): CSV export helper that creates file on first write, appends thereafter

## Main Monitoring Loop (L45-136)

### System Memory Collection (L50-64)
Gathers comprehensive Windows memory metrics:
- Physical memory totals and free space via Win32_OperatingSystem WMI
- Commit charge and limits from Memory performance counters
- Pool memory (paged/nonpaged), cache, and standby memory states
- Memory compression statistics and pagefile usage percentage

### Process Memory Analysis (L66-82)
- Aggregates all process private memory and working sets
- Identifies top N processes by private memory consumption
- Captures process name, PID, private memory, and working set for each

### Memory Accounting (L69-74)
Performs kernel memory approximation:
- Sums nonpaged pool, paged pool, page tables, system code, and driver memory
- Calculates unattributed commit delta (total commit - process private - kernel approximation)

### Dynamic CSV Structure (L85-118)
Creates ordered hashtable with:
- Fixed system metrics (timestamp, totals, percentages, pools)
- Dynamic top-N process columns (Name, PID, PrivateMB, WSMB per process slot)
- Null-fills unused top-N slots when fewer than TopN processes exist

### Output & Alerting (L121-130)
- Exports each sample to CSV via Write-Record
- Console status with formatted memory statistics
- Warning-level output when commit usage ≥95% of limit

## Architecture Notes
- Fault-tolerant design with comprehensive error handling in counter collection
- Self-creating output directory structure
- Infinite loop with configurable sleep interval
- Mixed data sources: WMI for OS stats, performance counters for detailed memory metrics, Get-Process for application data

## Dependencies
- Windows Performance Counters (Memory category)
- WMI (Win32_OperatingSystem)
- PowerShell cmdlets: Get-Process, Get-Counter, Get-CimInstance, Export-Csv