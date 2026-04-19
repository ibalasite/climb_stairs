# Setup Ladder Room Online secrets in Windows Credential Manager
# Usage: .\scripts\setup_secrets.ps1
# Requires: PowerShell 5.1+

$ServicePrefix = "ladder-room-online"

function Store-Secret {
    param(
        [string]$Key,
        [string]$Prompt,
        [bool]$CanAutoGenerate = $false
    )

    Write-Host ""
    Write-Host "--- $Key ---" -ForegroundColor Cyan
    Write-Host $Prompt

    # Check existing
    $existing = cmdkey /list:$ServicePrefix | Select-String $Key
    if ($existing) {
        $overwrite = Read-Host "Already set. Overwrite? [y/N]"
        if ($overwrite -ne 'y') { Write-Host "Skipped."; return }
        cmdkey /delete:"${ServicePrefix}:${Key}" | Out-Null
    }

    $value = $null
    if ($CanAutoGenerate) {
        $gen = Read-Host "Generate automatically? [Y/n]"
        if ($gen -ne 'n') {
            $bytes = New-Object byte[] 32
            [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
            $value = -join ($bytes | ForEach-Object { $_.ToString("x2") })
            Write-Host "Generated: $($value.Substring(0, 8))... (truncated)"
        }
    }

    if (-not $value) {
        $secureValue = Read-Host "Enter value" -AsSecureString
        $value = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
            [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)
        )
    }

    cmdkey /generic:"${ServicePrefix}:${Key}" /user:ladder /pass:"$value" | Out-Null
    Write-Host "Stored $Key in Credential Manager." -ForegroundColor Green
}

Write-Host "=== Ladder Room Online — Windows Credential Manager Secret Setup ===" -ForegroundColor Yellow
Write-Host "Service: $ServicePrefix"

Store-Secret -Key "REDIS_PASSWORD" `
    -Prompt "Redis authentication password (min 32 chars recommended)" `
    -CanAutoGenerate $true

Store-Secret -Key "JWT_SECRET" `
    -Prompt "JWT signing secret (64-byte hex, HS256)" `
    -CanAutoGenerate $true

Write-Host ""
Write-Host "=== Setup Complete ===" -ForegroundColor Green
Write-Host "Run .\scripts\verify_secrets.ps1 to confirm."
Write-Host "Run .\scripts\setup_k8s_secrets.ps1 to push to Kubernetes."
