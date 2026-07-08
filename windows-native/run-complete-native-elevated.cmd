@echo off
setlocal
cd /d "%~dp0"
echo Running native elevated setup from %CD%
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0complete-native-elevated.ps1"
echo.
echo Native elevated setup finished with exit code %ERRORLEVEL%.
pause
exit /b %ERRORLEVEL%
