# setup-wsl-networking.ps1
# Ensures WSL2 mirrored networking is configured so that
# localhost services on Windows (e.g. LM Studio) are reachable from WSL.

$wslconfig = Join-Path $env:USERPROFILE ".wslconfig"

Write-Host "Checking for .wslconfig at: $wslconfig"

if (Test-Path $wslconfig) {
    $content = Get-Content $wslconfig -Raw
    if ($content -match "networkingMode\s*=\s*mirrored") {
        Write-Host "Mirrored networking is already configured. No changes needed."
    } else {
        Write-Host ".wslconfig exists but mirrored networking is not set. Adding it..."
        if ($content -match "\[wsl2\]") {
            # Add networkingMode under existing [wsl2] section
            $content = $content -replace "(\[wsl2\])", "`$1`r`nnetworkingMode=mirrored"
        } else {
            # Append a new [wsl2] section
            $content = $content.TrimEnd() + "`r`n`r`n[wsl2]`r`nnetworkingMode=mirrored`r`n"
        }
        Set-Content -Path $wslconfig -Value $content -NoNewline
        Write-Host "Updated .wslconfig with mirrored networking."
    }
} else {
    Write-Host ".wslconfig not found. Creating it..."
    $content = "[wsl2]`r`nnetworkingMode=mirrored`r`n"
    Set-Content -Path $wslconfig -Value $content -NoNewline
    Write-Host "Created .wslconfig with mirrored networking."
}

# Show the current config
Write-Host "`n--- .wslconfig contents ---"
Get-Content $wslconfig
Write-Host "----------------------------`n"

# Check if WSL is running
$running = wsl -l --running 2>&1
if ($running -match "Windows Subsystem for Linux has no distributions running") {
    Write-Host "WSL is not currently running. No restart needed."
} else {
    Write-Host "Shutting down WSL..."
    wsl --shutdown

    # Wait for WSL to fully stop
    $timeout = 30
    $elapsed = 0
    while ($elapsed -lt $timeout) {
        Start-Sleep -Seconds 2
        $elapsed += 2
        $check = wsl -l --running 2>&1
        if ($check -match "Windows Subsystem for Linux has no distributions running") {
            Write-Host "WSL has stopped. (${elapsed}s)"
            break
        }
        Write-Host "Waiting for WSL to stop... (${elapsed}s)"
    }

    if ($elapsed -ge $timeout) {
        Write-Host "WARNING: WSL did not stop within ${timeout}s. Try 'wsl --shutdown' manually."
        exit 1
    }
}

# Start WSL and verify it comes back up
Write-Host "`nStarting WSL..."
wsl -e echo "WSL started successfully"

$check = wsl -l --running 2>&1
if ($check -notmatch "has no distributions running") {
    Write-Host "WSL is running again with mirrored networking enabled."
    Write-Host "`nTesting localhost connectivity to port 1234..."
    $result = wsl -e curl -s -o /dev/null -w "%{http_code}" http://localhost:1234/v1/models 2>&1
    if ($result -eq "200") {
        Write-Host "SUCCESS: LM Studio is reachable from WSL at localhost:1234"
    } else {
        Write-Host "NOTE: Could not reach localhost:1234 (is LM Studio running?)"
    }
} else {
    Write-Host "WARNING: WSL does not appear to be running."
}
