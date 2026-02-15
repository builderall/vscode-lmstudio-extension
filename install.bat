@echo off
REM Install script for LM Studio Chat extension (Windows PowerShell)

echo [INSTALL] Installing LM Studio Chat Extension...

REM Find the .vsix file
for /f "delims=" %%F in ('dir /b /o-d lmstudio-chat-*.vsix 2^>nul') do (
    set "VSIX_FILE=%%F"
    goto found
)

:notfound
echo [ERROR] No .vsix file found!
echo [INFO] Please run .\build.bat first to create the extension package
exit /b 1

:found
echo [FOUND] File: %VSIX_FILE%

REM Check if code command is available
where code >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] VS Code command not found!
    echo [INFO] Make sure VS Code is installed and 'code' is in your PATH
    exit /b 1
)

REM Install the extension
echo [INSTALL] Installing extension...
call code --install-extension "%VSIX_FILE%" --force

echo [SUCCESS] Installation complete!
echo [NEXT] Next steps:
echo    1. Reload VS Code (Ctrl+Shift+P -^> 'Reload Window')
echo    2. Configure settings:
echo       - lmstudio.apiBaseUrl
echo       - lmstudio.apiKey
echo       - lmstudio.model (required)
echo    3. Make sure LM Studio is running with a model loaded
echo    4. Open the 'LM Studio Chat' view in the Explorer sidebar

pause
