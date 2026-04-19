# Verify all required secrets exist in Windows Credential Manager (does NOT display values)
$ServicePrefix = "ladder-room-online"
$RequiredKeys = @("REDIS_PASSWORD", "JWT_SECRET")

Write-Host "=== Ladder Room Online — Secret Verification ===" -ForegroundColor Yellow
Write-Host "Service: $ServicePrefix"
Write-Host ""

$allOk = $true

foreach ($key in $RequiredKeys) {
    $result = cmdkey /list:"${ServicePrefix}:${key}" 2>&1
    if ($result -match $key) {
        Write-Host "OK $key — present (value hidden)" -ForegroundColor Green
    } else {
        Write-Host "MISSING $key" -ForegroundColor Red
        $allOk = $false
    }
}

Write-Host ""
if ($allOk) {
    Write-Host "All secrets verified." -ForegroundColor Green
    exit 0
} else {
    Write-Host "Some secrets missing. Run .\scripts\setup_secrets.ps1 first." -ForegroundColor Red
    exit 1
}
