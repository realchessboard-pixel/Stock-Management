@echo off
title StockFlow - keep this window open
cd /d "%~dp0"
node local\stockflow.mjs start
pause
