<#
.SYNOPSIS
  Prepare a Windows machine for Rust debugging with mcp-debugger.

.DESCRIPTION
  Ensures the required Rust toolchains are installed, exposes dlltool.exe from
  the rustup GNU toolchain, builds the bundled Rust examples, and optionally
  runs the Rust smoke test suite.

.PARAMETER UpdateUserPath
  When supplied, the script permanently appends rustup's self-contained GNU bin
  directory (which hosts dlltool.exe and ld.exe) to the current user's PATH and
  sets the DLLTOOL user environment variable. Without this switch, the script
  only amends the PATH for the current PowerShell session and prints manual
  instructions for the user.

.PARAMETER SkipBuild
  Skip building the Rust examples. Useful when just validating dependencies.

.PARAMETER SkipTests
  Skip running the mcp-debugger Rust smoke tests after setup.
#>
[CmdletBinding()]
param(
  [switch]$UpdateUserPath,
  [switch]$SkipBuild,
  [switch]$SkipTests
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Section($message) {
  Write-Host ''
  Write-Host '=== ' -NoNewline
  Write-Host $message -ForegroundColor Cyan
}

function Invoke-CommandChecked {
  param(
    [Parameter(Mandatory = $true)][string]$Command,
    [Parameter()][string[]]$Arguments = @(),
    [Parameter()][hashtable]$EnvVars = @{},
    [Parameter()][string]$WorkingDirectory = $PWD
  )

  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $Command
  $psi.WorkingDirectory = $WorkingDirectory
  $psi.Arguments = [string]::Join(' ', ($Arguments | ForEach-Object {
    if ($_ -match '\s') {
      '"' + ($_ -replace '"', '\"') + '"'
    } else {
      $_
    }
  }))
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  foreach ($entry in $EnvVars.GetEnumerator()) {
    $psi.Environment[$entry.Key] = $entry.Value
  }

  $process = [System.Diagnostics.Process]::Start($psi)
  $stdout = $process.StandardOutput.ReadToEnd()
  $stderr = $process.StandardError.ReadToEnd()
  $process.WaitForExit()
  if ($process.ExitCode -ne 0) {
    throw "Command '$Command $($psi.Arguments)' failed with exit code $($process.ExitCode)`n$stderr"
  }
  if ($stdout.Trim()) {
    Write-Host $stdout.Trim()
  }
}

$isWindows = [System.Runtime.InteropServices.RuntimeInformation]::IsOSPlatform([System.Runtime.InteropServices.OSPlatform]::Windows)
if (-not $isWindows) {
  throw 'This script only targets Windows hosts.'
}

function Get-Msys2Root {
  $candidates = @()
  if ($env:MSYS2_ROOT) { $candidates += $env:MSYS2_ROOT }
  $candidates += @('C:\msys64', 'C:\tools\msys64')
  foreach ($pathCandidate in $candidates) {
    if ($pathCandidate -and (Test-Path $pathCandidate)) {
      return (Resolve-Path $pathCandidate).Path
    }
  }
  return $null
}

function Install-Msys2ViaWinget {
  Write-Host 'MSYS2 not detected. Attempting installation via winget...'
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    throw 'winget is not available. Install MSYS2 manually from https://www.msys2.org/ and re-run this script.'
  }
  Invoke-CommandChecked -Command 'winget' -Arguments @(
    'install',
    '--id', 'MSYS2.MSYS2',
    '--exact',
    '--accept-package-agreements',
    '--accept-source-agreements'
  )
}

function Ensure-Msys2 {
  $root = Get-Msys2Root
  if (-not $root) {
    Install-Msys2ViaWinget
    $root = Get-Msys2Root
    if (-not $root) {
      throw 'MSYS2 installation not found even after winget install. Install MSYS2 manually and set MSYS2_ROOT.'
    }
  }
  return $root
}

function Test-MingwTools {
  param(
    [Parameter(Mandatory = $true)][string]$BinDir
  )

  $tools = @('x86_64-w64-mingw32-gcc', 'ld', 'as', 'dlltool')
  foreach ($tool in $tools) {
    $exePath = Join-Path $BinDir ("$tool.exe")
    if (-not (Test-Path $exePath)) {
      throw "Expected tool '$tool' not found under $BinDir"
    }
  }

  Invoke-CommandChecked -Command (Join-Path $BinDir 'x86_64-w64-mingw32-gcc.exe') -Arguments @('--version')
  Invoke-CommandChecked -Command (Join-Path $BinDir 'dlltool.exe') -Arguments @('--version')
}

function Ensure-MingwToolchain {
  $msysRoot = Ensure-Msys2
  $bashPath = Join-Path $msysRoot 'usr\bin\bash.exe'
  if (-not (Test-Path $bashPath)) {
    throw "Cannot find bash.exe under MSYS2 root ($msysRoot)."
  }

  $mingwBin = Join-Path $msysRoot 'mingw64\bin'
  if (-not (Test-Path (Join-Path $mingwBin 'x86_64-w64-mingw32-gcc.exe'))) {
    Write-Host 'Installing MinGW-w64 (mingw64) toolchain via pacman...'
    $pacmanCmd = 'pacman -S --needed --noconfirm base-devel mingw-w64-x86_64-toolchain'
    Invoke-CommandChecked -Command $bashPath -Arguments @('-lc', $pacmanCmd)
  }

  if (-not (Test-Path (Join-Path $mingwBin 'dlltool.exe'))) {
    throw "dlltool.exe still missing under $mingwBin after MSYS2 setup."
  }

  Test-MingwTools -BinDir $mingwBin
  return $mingwBin
}

function Ensure-PathEntry {
  param(
    [Parameter(Mandatory = $true)][string]$Entry,
    [switch]$Persist
  )

  if (-not (Test-Path $Entry)) {
    return
  }

  $resolvedEntry = (Resolve-Path $Entry).Path
  $sessionParts = @()
  if ($env:PATH) {
    $sessionParts = $env:PATH -split ';' | Where-Object { $_ }
  }
  if (-not ($sessionParts | Where-Object { $_.Trim().ToLowerInvariant() -eq $resolvedEntry.Trim().ToLowerInvariant() })) {
    $env:PATH = "$resolvedEntry;$env:PATH"
  }

  if ($Persist) {
    $userPathRaw = [System.Environment]::GetEnvironmentVariable('Path', 'User')
    $userParts = @()
    if ($userPathRaw) {
      $userParts = $userPathRaw -split ';' | Where-Object { $_ }
    }
    if (-not ($userParts | Where-Object { $_.Trim().ToLowerInvariant() -eq $resolvedEntry.Trim().ToLowerInvariant() })) {
      $newUserPath = ($userParts + $resolvedEntry) -join ';'
      [System.Environment]::SetEnvironmentVariable('Path', $newUserPath, 'User')
      Write-Host "Prepended $resolvedEntry to the user PATH."
    }
  }
}

function Build-ExampleProject {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$ManifestPath
  )

  $manifestFullPath = (Resolve-Path $ManifestPath).Path
  $projectDir = Split-Path $manifestFullPath -Parent

  Write-Host "Building $Name with GNU toolchain..."
  $gnuSucceeded = $false
  try {
    Invoke-CommandChecked -Command 'cargo' -Arguments @(
      '+stable-gnu',
      'build',
      '--target', 'x86_64-pc-windows-gnu',
      '--manifest-path', $manifestFullPath
    ) -WorkingDirectory $projectDir -EnvVars @{ DLLTOOL = $env:DLLTOOL; PATH = $env:PATH }
    $gnuSucceeded = $true
  } catch {
    Write-Warning "GNU build failed for ${Name}: $($_)"
  }

  if ($gnuSucceeded) {
    return
  }

  Write-Host 'Falling back to MSVC build so at least one binary exists for debugging.'
  try {
    Invoke-CommandChecked -Command 'cargo' -Arguments @(
      '+stable-msvc',
      'build',
      '--target', 'x86_64-pc-windows-msvc',
      '--manifest-path', $manifestFullPath
    ) -WorkingDirectory $projectDir
  } catch {
    Write-Warning "MSVC fallback build also failed for ${Name}: $($_)"
  }
}

Write-Section 'Checking prerequisites'
if (-not (Get-Command rustup -ErrorAction SilentlyContinue)) {
  throw 'rustup not found. Install from https://rustup.rs/ and re-run this script.'
}

Write-Host 'Ensuring Rust toolchains are installed...'
Invoke-CommandChecked -Command 'rustup' -Arguments @('toolchain', 'install', 'stable-gnu', '--profile', 'minimal')
Invoke-CommandChecked -Command 'rustup' -Arguments @('toolchain', 'install', 'stable-msvc', '--profile', 'minimal')
Invoke-CommandChecked -Command 'rustup' -Arguments @('default', 'stable-gnu')
Invoke-CommandChecked -Command 'rustup' -Arguments @('target', 'add', 'x86_64-pc-windows-gnu', '--toolchain', 'stable-gnu')

$dlltoolDir = Join-Path $env:USERPROFILE '.rustup\toolchains\stable-x86_64-pc-windows-gnu\lib\rustlib\x86_64-pc-windows-gnu\bin\self-contained'
$dlltoolExe = Join-Path $dlltoolDir 'dlltool.exe'
if (-not (Test-Path $dlltoolExe)) {
  throw "dlltool.exe not found at expected location: $dlltoolExe"
}

Write-Section 'Configuring dlltool'
$preferredDlltool = $dlltoolExe

Write-Section 'Ensuring MSYS2 MinGW toolchain'
$mingwPath = $null
try {
  $mingwPath = Ensure-MingwToolchain
  Ensure-PathEntry -Entry $mingwPath -Persist:$UpdateUserPath
  $preferredDlltool = Join-Path $mingwPath 'dlltool.exe'
  Write-Host "Using MSYS2 MinGW toolchain at $mingwPath"
} catch {
  Write-Warning "Unable to provision MSYS2 MinGW toolchain automatically: $_"
  Write-Warning 'Install MSYS2 + MinGW-w64 manually (see https://www.msys2.org/docs/cygwin/#installing-packages) and re-run this script for full GNU support.'
}

$env:DLLTOOL = $preferredDlltool
Ensure-PathEntry -Entry (Split-Path $preferredDlltool -Parent) -Persist:$UpdateUserPath
if ($UpdateUserPath) {
  [System.Environment]::SetEnvironmentVariable('DLLTOOL', $preferredDlltool, 'User')
  Write-Host "Set DLLTOOL user environment variable to $preferredDlltool."
} else {
  Write-Host @"
For the current session, PATH and DLLTOOL now point at:
  $preferredDlltool
Add this directory to your PATH or re-run the script with -UpdateUserPath to persist the change.
"@
}

if (-not $SkipBuild) {
  Write-Section 'Building bundled Rust examples'
  $examples = @(
    @{ Name = 'hello_world'; Manifest = Join-Path $PSScriptRoot '..\..\examples\rust\hello_world\Cargo.toml' },
    @{ Name = 'async_example'; Manifest = Join-Path $PSScriptRoot '..\..\examples\rust\async_example\Cargo.toml' }
  )
  foreach ($example in $examples) {
    Build-ExampleProject -Name $example.Name -ManifestPath $example.Manifest
  }
}

if (-not $SkipTests) {
  Write-Section 'Running Rust smoke tests'
  $pnpmCmd = Get-Command pnpm -ErrorAction SilentlyContinue
  if (-not $pnpmCmd) {
    Write-Warning 'pnpm is not available on PATH. Install pnpm (https://pnpm.io/) to run the smoke tests.'
  } else {
    try {
      Invoke-CommandChecked -Command 'pnpm' -Arguments @('vitest', 'run', 'tests/e2e/mcp-server-smoke-rust.test.ts')
    } catch {
      Write-Warning "Rust smoke tests failed: $_"
    }
  }
}

Write-Section 'Setup complete'
Write-Host 'Rust debugging prerequisites are satisfied. Open a new terminal to inherit any PATH changes.' -ForegroundColor Green
