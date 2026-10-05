@echo off
REM StockFlow first-time setup. Needs Node.js LTS from https://nodejs.org
cd /d "%~dp0"
echo Installing StockFlow (this can take several minutes)...
call npm ci --no-audit --no-fund || goto :error
node local\stockflow.mjs setup || goto :error
node local\stockflow.mjs autostart on
echo.
echo Setup finished. Double-click "Start StockFlow.bat" to begin.
pause
exit /b 0
:error
echo.
echo Setup failed. See the message above.
pause
exit /b 1
