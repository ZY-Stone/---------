@echo off
title Product Analysis Platform v2.0

echo.
echo ==============================================
echo   Product Analysis Integrated Platform v2.0
echo ==============================================
echo.

cd /d "%~dp0"

:: Find Python - prefer known Python 3.12 location first
set PYTHON=
set "PY312=%LocalAppData%\Programs\Python\Python312\python.exe"
if exist "%PY312%" (
    set PYTHON=%PY312%
    goto :found
)

:: Fallback: search PATH
for %%p in (python3 python py) do (
    where %%p >nul 2>&1
    if not errorlevel 1 (
        set PYTHON=%%p
        goto :found
    )
)

echo [ERROR] Python not found. Please install Python 3.10+
echo Download: https://www.python.org/downloads/
pause
exit /b 1

:found
echo [INFO] Using: %PYTHON%
%PYTHON% --version
echo.

:: Start
%PYTHON% start.py

pause
