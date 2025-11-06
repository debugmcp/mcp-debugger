param(
  [int]$TopN = 25
)

$ErrorActionPreference = 'SilentlyContinue'

function GB([double]$b) { [math]::Round($b / 1GB, 2) }

Write-Host "=== Memory Diagnostic Snapshot $(Get-Date -Format o) ==="

# System-level memory
$os = Get-CimInstance Win32_OperatingSystem
$totalGB = [math]::Round($os.TotalVisibleMemorySize / 1MB, 2)
$freeGB = [math]::Round($os.FreePhysicalMemory / 1MB, 2)

$commit       = (Get-Counter '\Memory\Committed Bytes').CounterSamples[0].CookedValue
$commitLimit  = (Get-Counter '\Memory\Commit Limit').CounterSamples[0].CookedValue
$np           = (Get-Counter '\Memory\Pool Nonpaged Bytes').CounterSamples[0].CookedValue
$pp           = (Get-Counter '\Memory\Pool Paged Bytes').CounterSamples[0].CookedValue
$cache        = (Get-Counter '\Memory\Cache Bytes').CounterSamples[0].CookedValue
$standbyNorm  = (Get-Counter '\Memory\Standby Cache Normal Priority Bytes').CounterSamples[0].CookedValue
$standbyRes   = (Get-Counter '\Memory\Standby Cache Reserve Bytes').CounterSamples[0].CookedValue
$standbyCore  = (Get-Counter '\Memory\Standby Cache Core Bytes').CounterSamples[0].CookedValue
$compressedPg = (Get-Counter '\Memory\Compressed Page Count').CounterSamples[0].CookedValue
$compressedB  = $compressedPg * 4096
$pagefilePct  = (Get-Counter '\Paging File(_Total)\% Usage').CounterSamples[0].CookedValue

$sumPrivate = (Get-Process | Measure-Object -Property PrivateMemorySize64 -Sum).Sum
$sumWS      = (Get-Process | Measure-Object -Property WorkingSet64 -Sum).Sum

Write-Host ("System Memory: Total {0} GB, Free {1} GB" -f $totalGB, $freeGB)
Write-Host ("Committed: {0:N2}/{1:N2} GB ({2:P0})" -f (GB $commit), (GB $commitLimit), ($commit / $commitLimit))
Write-Host ("Pagefile Usage: {0:N1}%  |  Memory Compression: {1:N2} GB" -f $pagefilePct, (GB $compressedB))
Write-Host ("Kernel Pools -> Nonpaged {0:N2} GB, Paged {1:N2} GB" -f (GB $np), (GB $pp))
Write-Host ("File Cache: {0:N2} GB  |  Standby: {1:N2} GB" -f (GB $cache), (GB ($standbyNorm + $standbyRes + $standbyCore)))
Write-Host ("Sum of Processes -> Private {0:N2} GB, Working Set {1:N2} GB" -f (GB $sumPrivate), (GB $sumWS))
Write-Host ""

# Commit breakdown (approximate)
Write-Host "Commit breakdown (approximate):"
$pt = (Get-Counter '\Memory\Page Table Bytes').CounterSamples[0].CookedValue
$sysCodeTotal = (Get-Counter '\Memory\System Code Total Bytes').CounterSamples[0].CookedValue
$sysCodeResident = (Get-Counter '\Memory\System Code Resident Bytes').CounterSamples[0].CookedValue
$sysDriverResident = (Get-Counter '\Memory\System Driver Resident Bytes').CounterSamples[0].CookedValue
$sysCacheResident = (Get-Counter '\Memory\System Cache Resident Bytes').CounterSamples[0].CookedValue
$kernelCommitApprox = $np + $pp + $pt + $sysDriverResident + $sysCodeTotal
$delta = $commit - ($sumPrivate + $kernelCommitApprox)
Write-Host ("Page Table Bytes: {0:N2} GB" -f (GB $pt))
Write-Host ("System Code Total: {0:N2} GB (Resident {1:N2} GB)" -f (GB $sysCodeTotal), (GB $sysCodeResident))
Write-Host ("System Driver Resident: {0:N2} GB" -f (GB $sysDriverResident))
Write-Host ("System Cache Resident: {0:N2} GB" -f (GB $sysCacheResident))
Write-Host ("Approx Kernel+PT Commit: {0:N2} GB" -f (GB $kernelCommitApprox))
Write-Host ("Delta Commit (Unattributed): {0:N2} GB" -f (GB $delta))
Write-Host ""

# Perf counter per-process Private Bytes (more complete attribution)
Write-Host "Per-process Private Bytes via Perf Counters:"
try {
  $pb  = (Get-Counter '\Process(*)\Private Bytes').CounterSamples
  $ids = (Get-Counter '\Process(*)\ID Process').CounterSamples
  $idMap = @{}
  foreach ($s in $ids) { $idMap[$s.InstanceName] = [int]$s.CookedValue }

  $procPB = $pb | Where-Object { $_.InstanceName -ne '_Total' -and $_.InstanceName -ne 'Idle' } | ForEach-Object {
    [PSCustomObject]@{
      Instance  = $_.InstanceName
      Id        = $(if ($idMap.ContainsKey($_.InstanceName)) { $idMap[$_.InstanceName] } else { $null })
      PrivateMB = [math]::Round($_.CookedValue / 1MB, 1)
    }
  } | Sort-Object PrivateMB -Descending

  $sumPBGB = [math]::Round((($procPB | Measure-Object -Property PrivateMB -Sum).Sum) / 1024, 2)
  Write-Host ("PerfCounter Sum of Private Bytes: {0:N2} GB" -f $sumPBGB)
  $procPB | Select-Object -First $TopN | Format-Table -AutoSize
} catch {
  Write-Host "Perf counter query failed (try running elevated): $($_.Exception.Message)"
}
Write-Host ""

# Per-process Committed Bytes via Perf Counters (alternative to "Commit Size")
Write-Host "Per-process Committed Bytes via Perf Counters:"
try {
  $cb = (Get-Counter '\Process(*)\Committed Bytes').CounterSamples
  $ids = (Get-Counter '\Process(*)\ID Process').CounterSamples
  $idMapCB = @{}
  foreach ($s in $ids) { $idMapCB[$s.InstanceName] = [int]$s.CookedValue }

  $procCB = $cb | Where-Object { $_.InstanceName -ne '_Total' -and $_.InstanceName -ne 'Idle' } | ForEach-Object {
    [PSCustomObject]@{
      Instance = $_.InstanceName
      Id       = $(if ($idMapCB.ContainsKey($_.InstanceName)) { $idMapCB[$_.InstanceName] } else { $null })
      CommitMB = [math]::Round($_.CookedValue / 1MB, 1)
    }
  } | Sort-Object CommitMB -Descending

  $sumCBGB = [math]::Round((($procCB | Measure-Object -Property CommitMB -Sum).Sum) / 1024, 2)
  Write-Host ("PerfCounter Sum of Committed Bytes: {0:N2} GB" -f $sumCBGB)
  $procCB | Select-Object -First $TopN | Format-Table -AutoSize
} catch {
  Write-Host "Committed Bytes perf counter not available: $($_.Exception.Message)"
}
Write-Host ""

# Per-process Commit Size via Perf Counters (closest to Task Manager "Commit size")
Write-Host "Per-process Commit Size via Perf Counters:"
try {
  $cs = (Get-Counter '\Process(*)\Commit Size').CounterSamples
  $ids = (Get-Counter '\Process(*)\ID Process').CounterSamples
  $idMap2 = @{}
  foreach ($s in $ids) { $idMap2[$s.InstanceName] = [int]$s.CookedValue }

  $procCS = $cs | Where-Object { $_.InstanceName -ne '_Total' -and $_.InstanceName -ne 'Idle' } | ForEach-Object {
    [PSCustomObject]@{
      Instance = $_.InstanceName
      Id       = $(if ($idMap2.ContainsKey($_.InstanceName)) { $idMap2[$_.InstanceName] } else { $null })
      CommitMB = [math]::Round($_.CookedValue / 1MB, 1)
    }
  } | Sort-Object CommitMB -Descending

  $sumCSGB = [math]::Round((($procCS | Measure-Object -Property CommitMB -Sum).Sum) / 1024, 2)
  Write-Host ("PerfCounter Sum of Commit Size: {0:N2} GB" -f $sumCSGB)
  $procCS | Select-Object -First $TopN | Format-Table -AutoSize
} catch {
  Write-Host "Commit Size perf counter not available (Windows build dependent)."
  try {
    Write-Host "Fallback: Per-process Virtual Bytes (note: includes reserved address space, not just commit):"
    $vb = (Get-Counter '\Process(*)\Virtual Bytes').CounterSamples
    $ids = (Get-Counter '\Process(*)\ID Process').CounterSamples
    $idMap3 = @{}
    foreach ($s in $ids) { $idMap3[$s.InstanceName] = [int]$s.CookedValue }
    $procVB = $vb | Where-Object { $_.InstanceName -ne '_Total' -and $_.InstanceName -ne 'Idle' } | ForEach-Object {
      [PSCustomObject]@{
        Instance = $_.InstanceName
        Id       = $(if ($idMap3.ContainsKey($_.InstanceName)) { $idMap3[$_.InstanceName] } else { $null })
        VirtMB   = [math]::Round($_.CookedValue / 1MB, 1)
      }
    } | Sort-Object VirtMB -Descending
    $sumVBGB = [math]::Round((($procVB | Measure-Object -Property VirtMB -Sum).Sum) / 1024, 2)
    Write-Host ("PerfCounter Sum of Virtual Bytes: {0:N2} GB" -f $sumVBGB)
    $procVB | Select-Object -First $TopN | Format-Table -AutoSize
  } catch {
    Write-Host "Virtual Bytes query failed: $($_.Exception.Message)"
  }
}
Write-Host ""

# Top by Private Bytes
Write-Host "Top processes by Private Bytes (MB):"
Get-Process | Select-Object Name, Id,
  @{Name='PrivateMB'; Expression={[math]::Round($_.PrivateMemorySize64 / 1MB, 1)}},
  @{Name='WSMB';      Expression={[math]::Round($_.WorkingSet64 / 1MB, 1)}},
  @{Name='Handles';   Expression={$_.Handles}} |
  Sort-Object PrivateMB -Descending | Select-Object -First $TopN | Format-Table -AutoSize

Write-Host ""
# Top by Working Set
Write-Host "Top processes by Working Set (MB):"
Get-Process | Select-Object Name, Id,
  @{Name='WSMB';      Expression={[math]::Round($_.WorkingSet64 / 1MB, 1)}},
  @{Name='PrivateMB'; Expression={[math]::Round($_.PrivateMemorySize64 / 1MB, 1)}},
  @{Name='Handles';   Expression={$_.Handles}} |
  Sort-Object WSMB -Descending | Select-Object -First $TopN | Format-Table -AutoSize

Write-Host ""
# Special processes often implicated in high memory use
Write-Host "Special processes (MemoryCompression, Vmmem, com.docker.backend, WSL):"
Get-Process -Name MemoryCompression, Vmmem, "com.docker.backend", "wslservice", "wslhost" -ErrorAction SilentlyContinue |
  Select-Object Name, Id,
    @{Name='WSMB';      Expression={[math]::Round($_.WorkingSet64 / 1MB, 1)}},
    @{Name='PrivateMB'; Expression={[math]::Round($_.PrivateMemorySize64 / 1MB, 1)}} |
  Format-Table -AutoSize

Write-Host ""
# Handles can indicate leaks
Write-Host "Top by Handle Count (leak indicator):"
Get-Process | Sort-Object Handles -Descending | Select-Object -First 20 |
  Select-Object Name, Id, Handles,
    @{Name='WSMB'; Expression={[math]::Round($_.WorkingSet64 / 1MB, 1)}} |
  Format-Table -AutoSize

exit 0
