param(
  [int]$IntervalSec = 10,
  [int]$TopN = 10,
  [string]$OutPath = ("logs/memwatch-{0}.csv" -f (Get-Date -Format "yyyyMMdd-HHmmss"))
)

$ErrorActionPreference = 'SilentlyContinue'

function GB([double]$b) { [math]::Round($b / 1GB, 2) }

function GetCounterSafe([string]$path) {
  try {
    $c = Get-Counter $path -ErrorAction Stop
    if ($c.CounterSamples -and $c.CounterSamples.Count -gt 0) { return $c.CounterSamples[0].CookedValue }
  } catch { }
  return $null
}

function GetCounterSafeOrZero([string]$path) {
  $v = GetCounterSafe $path
  if ($null -eq $v) { return 0 } else { return $v }
}

# Ensure output directory exists
$dir = Split-Path -Parent $OutPath
if (-not [string]::IsNullOrWhiteSpace($dir)) {
  New-Item -Path $dir -ItemType Directory -Force | Out-Null
}

Write-Host "Starting memwatch. Interval: $IntervalSec s, TopN: $TopN, Output: $OutPath"
Write-Host "Press Ctrl+C to stop."

# Helper to build a record with dynamic top-N fields and export as CSV (append after first write)
function Write-Record {
  param([hashtable]$h, [string]$path)

  $obj = [PSCustomObject]$h
  if (-not (Test-Path -Path $path)) {
    $obj | Export-Csv -Path $path -NoTypeInformation
  } else {
    $obj | Export-Csv -Path $path -Append -NoTypeInformation
  }
}

while ($true) {
  try {
    $ts = Get-Date -Format o

    # System snapshot
    $os = Get-CimInstance Win32_OperatingSystem
    $totalGB = [math]::Round($os.TotalVisibleMemorySize / 1MB, 2)
    $freeGB  = [math]::Round($os.FreePhysicalMemory / 1MB, 2)

    $commit      = GetCounterSafeOrZero '\Memory\Committed Bytes'
    $commitLimit = GetCounterSafeOrZero '\Memory\Commit Limit'
    $np          = GetCounterSafeOrZero '\Memory\Pool Nonpaged Bytes'
    $pp          = GetCounterSafeOrZero '\Memory\Pool Paged Bytes'
    $cache       = GetCounterSafeOrZero '\Memory\Cache Bytes'
    $standbyNorm = GetCounterSafeOrZero '\Memory\Standby Cache Normal Priority Bytes'
    $standbyRes  = GetCounterSafeOrZero '\Memory\Standby Cache Reserve Bytes'
    $standbyCore = GetCounterSafeOrZero '\Memory\Standby Cache Core Bytes'
    $compressedPg = GetCounterSafeOrZero '\Memory\Compressed Page Count'
    $compressedB  = $compressedPg * 4096
    $pagefilePct  = GetCounterSafeOrZero '\Paging File(_Total)\% Usage'

    $sumPrivate = (Get-Process | Measure-Object -Property PrivateMemorySize64 -Sum).Sum
    $sumWS      = (Get-Process | Measure-Object -Property WorkingSet64 -Sum).Sum

    # Kernel-ish approximation and unattributed commit delta
    $pt = GetCounterSafeOrZero '\Memory\Page Table Bytes'
    $sysCodeTotal = GetCounterSafeOrZero '\Memory\System Code Total Bytes'
    $sysDriverResident = GetCounterSafeOrZero '\Memory\System Driver Resident Bytes'
    $kernelCommitApprox = $np + $pp + $pt + $sysDriverResident + $sysCodeTotal
    $delta = $commit - ($sumPrivate + $kernelCommitApprox)

    # Top processes by Private Bytes
    $top = Get-Process | Select-Object Name, Id,
      @{Name='PrivateMB'; Expression={[math]::Round($_.PrivateMemorySize64 / 1MB, 1)}},
      @{Name='WSMB';      Expression={[math]::Round($_.WorkingSet64 / 1MB, 1)}} |
      Sort-Object PrivateMB -Descending | Select-Object -First $TopN
    if ($null -eq $top) { $top = @() }

    # Compose CSV row
    $commitPct = if ($commitLimit -gt 0) { [math]::Round(($commit / $commitLimit) * 100, 1) } else { 0 }
    $row = [ordered]@{
      Timestamp        = $ts
      TotalGB          = $totalGB
      FreeGB           = $freeGB
      CommitGB         = (GB $commit)
      CommitLimitGB    = (GB $commitLimit)
      CommitPct        = $commitPct
      PagefileUsagePct = [math]::Round($pagefilePct, 1)
      NonpagedGB       = (GB $np)
      PagedGB          = (GB $pp)
      CacheGB          = (GB $cache)
      StandbyGB        = (GB ($standbyNorm + $standbyRes + $standbyCore))
      CompressionGB    = (GB $compressedB)
      SumPrivateGB     = (GB $sumPrivate)
      SumWorkingSetGB  = (GB $sumWS)
      KernelApproxGB   = (GB $kernelCommitApprox)
      DeltaCommitGB    = (GB $delta)
    }

    # Add dynamic top-N columns
    for ($i = 0; $i -lt $TopN; $i++) {
      if ($i -lt $top.Count) {
        $p = $top[$i]
        $row["Top$($i+1)Name"] = $p.Name
        $row["Top$($i+1)Pid"]  = $p.Id
        $row["Top$($i+1)PrivMB"] = $p.PrivateMB
        $row["Top$($i+1)WSMB"]   = $p.WSMB
      } else {
        $row["Top$($i+1)Name"] = $null
        $row["Top$($i+1)Pid"]  = $null
        $row["Top$($i+1)PrivMB"] = $null
        $row["Top$($i+1)WSMB"]   = $null
      }
    }

    # Export
    Write-Record -h $row -path $OutPath

    # Console status
    $status = ("[{0}] Commit {1:N2}/{2:N2} GB ({3:N1}%), Free {4} GB, Standby {5} GB, Delta {6:N2} GB" -f `
      $ts, (GB $commit), (GB $commitLimit), $commitPct, $freeGB, (GB ($standbyNorm + $standbyRes + $standbyCore)), (GB $delta))
    if (($commit / $commitLimit) -ge 0.95) {
      Write-Warning $status
    } else {
      Write-Host $status
    }
  } catch {
    Write-Warning ("memwatch iteration error: {0}" -f $_.Exception.Message)
  }

  Start-Sleep -Seconds $IntervalSec
}
