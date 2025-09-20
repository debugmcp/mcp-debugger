Param()

$ErrorActionPreference = 'Stop'

# Resolve output directory on host
$project = Get-Location
$outDir = Join-Path $project 'logs\diag-stdio'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

# Bind /app/logs in the container to host logs/diag-stdio
$vol = "${outDir}:/app/logs"

# Run CLI help and stdio with output captured to /app/logs, then export logs
docker run --rm -v "$vol" mcp-debugger:local sh -lc "set -e; rm -f /app/logs/*; node dist/index.js --help >/app/logs/cli-help.txt 2>&1 || true; node dist/index.js stdio >/app/logs/cli-stdio.txt 2>&1 & pid=$!; sleep 3; echo '--- container /app/logs ---'; ls -la /app/logs || true; kill $pid; wait $pid || true"

Write-Host '--- host out dir ---'
Get-ChildItem -Force $outDir

Write-Host '--- cli-help.txt ---'
$cliHelp = Join-Path $outDir 'cli-help.txt'
if (Test-Path $cliHelp) { Get-Content -Raw $cliHelp } else { Write-Host 'cli-help.txt missing' }

Write-Host '--- cli-stdio.txt (first 200 lines) ---'
$cliStd = Join-Path $outDir 'cli-stdio.txt'
if (Test-Path $cliStd) { Get-Content $cliStd -TotalCount 200 } else { Write-Host 'cli-stdio.txt missing' }

Write-Host '--- bundle-start.log ---'
$bundle = Join-Path $outDir 'bundle-start.log'
if (Test-Path $bundle) { Get-Content -Raw $bundle } else { Write-Host 'bundle-start.log missing' }

Write-Host '--- debug-mcp-server.log (tail) ---'
$serverlog = Join-Path $outDir 'debug-mcp-server.log'
if (Test-Path $serverlog) { Get-Content -Tail 200 $serverlog } else { Write-Host 'debug-mcp-server.log missing' }
