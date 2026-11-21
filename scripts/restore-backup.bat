@echo off
title DeepAI Code RTL Restore Original
cd /d "%~dp0\.."
echo ========================================================
echo       DeepAI Code Restore Original Unpatched Version
echo ========================================================
echo.
node src\patcher.js restore
echo.
pause
