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
call npx vsce package --allow-missing-repository
if %errorlevel% neq 0 exit /b %errorlevel%

REM Show the packaged file
for /f "delims=" %%F in ('dir /b /o-d lmstudio-chat-*.vsix 2^>nul') do (
    echo [SUCCESS] Build complete!
    echo [OUTPUT] Extension packaged: %%F
    goto done
)

:done
echo [NEXT] Run .\install.bat to install

pause
