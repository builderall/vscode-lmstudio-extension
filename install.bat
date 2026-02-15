@echo off
REM Install script for LM Studio Chat extension (Windows)

setlocal enabledelayedexpansion

echo [INSTALL] Installing LM Studio Chat Extension...

REM Find the latest .vsix file (sorted by date descending)
set "VSIX_FILE="
for /f "delims=" %%F in ('dir /b /o-d lmstudio-chat-*.vsix 2^>nul') do (
    set "VSIX_FILE=%%F"
    goto found
)

echo [ERROR] No .vsix file found!
echo [INFO] Please run .\build.bat first to create the extension package
exit /b 1

:found
echo [FOUND] Latest: %VSIX_FILE%

REM Check if code command is available
where code >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] VS Code command not found!
    echo [INFO] Make sure VS Code is installed and 'code' is in your PATH
    exit /b 1
)

REM Uninstall any old versions
echo [CLEANUP] Removing old versions...
for /f "delims=" %%E in ('code --list-extensions 2^>nul ^| findstr /i "lmstudio"') do (
    echo    Uninstalling: %%E
    call code --uninstall-extension "%%E" 2>nul
)

REM Install the latest extension
echo [INSTALL] Installing %VSIX_FILE%...
call code --install-extension "%VSIX_FILE%" --force

echo [SUCCESS] Installation complete!
echo [NEXT] Next steps:
echo    1. Reload VS Code (Ctrl+Shift+P -^> 'Reload Window')
echo    2. Configure settings:
echo       - lmstudio.model (required)
echo       - lmstudio.apiBaseUrl (default: http://localhost:1234/v1)
echo    3. Make sure LM Studio is running with a model loaded
echo    4. Open Chat panel, type @lmstudio followed by your message

pause
