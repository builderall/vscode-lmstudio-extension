@echo off
REM Build script for LM Studio Chat extension (Windows)

setlocal enabledelayedexpansion

echo [BUILD] Building LM Studio Chat Extension...

REM Install dependencies
echo [INSTALL] Installing dependencies...
call npm install
if %errorlevel% neq 0 exit /b %errorlevel%

REM Compile TypeScript
echo [COMPILE] Compiling TypeScript...
call npm run compile
if %errorlevel% neq 0 exit /b %errorlevel%

REM Package extension
echo [PACKAGE] Packaging extension...
call npx vsce package
if %errorlevel% neq 0 exit /b %errorlevel%

echo [SUCCESS] Build complete!
echo [OUTPUT] Extension packaged: lmstudio-chat-0.0.1.vsix
echo [NEXT] Next steps:
echo    1. Install the .vsix file in VS Code
echo    2. Press Ctrl+Shift+P -^> "Install from VSIX"
echo    3. Select the .vsix file

pause
