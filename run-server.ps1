$ErrorActionPreference = 'Stop'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error 'Node.js is not installed or is not on PATH. Install the current LTS release, then reopen PowerShell.'
    exit 1
}

$securePassword = Read-Host 'Enter the team password (12+ characters)' -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)

try {
    $env:TEAM_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
    node (Join-Path $PSScriptRoot 'server.js')
}
finally {
    Remove-Item Env:TEAM_PASSWORD -ErrorAction SilentlyContinue
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
    $securePassword.Dispose()
}
