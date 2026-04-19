# Ladder Room Online — k6 Load Test (Windows PowerShell)
param(
    [string]$BaseUrl = "http://localhost:3000",
    [string]$Scenario = "normal_load"
)

Write-Host "=== Ladder Room Online — k6 Load Test ===" -ForegroundColor Cyan
Write-Host "Target: $BaseUrl"
Write-Host "Scenario: $Scenario"
Write-Host ""

# Check k6 is installed
if (-not (Get-Command k6 -ErrorAction SilentlyContinue)) {
    Write-Error "k6 not found. Install via: winget install k6 --source winget"
    exit 1
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$outputFile = "results\k6_${Scenario}_${timestamp}.json"

New-Item -ItemType Directory -Force -Path "results" | Out-Null

k6 run `
    --env BASE_URL="$BaseUrl" `
    --out "json=$outputFile" `
    --summary-trend-stats="avg,min,med,max,p(90),p(95),p(99)" `
    scripts/load_test.js

Write-Host ""
Write-Host "Results saved to $outputFile" -ForegroundColor Green
