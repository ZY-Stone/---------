哦@echo off
title Platform Starter

cd /d "%~dp0"

echo.
echo ================================================
echo   Product Analysis Platform v3.2
echo ================================================
echo.

rem [1/5] Free port 8800
echo [1/5] Free port 8800...
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":8800 "') do (
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 2 /nobreak >nul
echo        Done
echo.

rem [2/5] Clear Python cache
echo [2/5] Clear Python cache...
for /d /r "src\backend" %%d in (__pycache__) do (
    if exist "%%d" rmdir /s /q "%%d" 2>nul
)
del /s /q "src\backend\*.pyc" 2>nul
echo        Done
echo.

rem [3/5] Find Python
echo [3/5] Find Python...
set PYTHON=
set "PY312=%LocalAppData%\Programs\Python\Python312\python.exe"
set "PY313=%LocalAppData%\Programs\Python\Python313\python.exe"
if exist "%PY312%" ( set "PYTHON=%PY312%" & goto :found )
if exist "%PY313%" ( set "PYTHON=%PY313%" & goto :found )
for %%p in (python3 python py) do (
    where %%p >nul 2>&1
    if not errorlevel 1 ( set "PYTHON=%%p" & goto :found )
)
echo [ERROR] Python not found. Install Python 3.10+
pause
exit /b 1

:found
echo        %PYTHON%
echo.

rem [4/5] Init DB and start backend
echo [4/5] Init DB + start backend...
cd /d "%~dp0src\backend"

"%PYTHON%" -c "from database import init_db; init_db(); from seed import seed; seed(); print('DB OK')"

start "Backend" /MIN "%PYTHON%" main.py
cd /d "%~dp0"

rem [5/5] Wait for backend ready
echo [5/5] Wait for backend...
for /l %%i in (1,1,30) do (
    timeout /t 1 /nobreak >nul
    curl -s -m 2 http://localhost:8800/health 2>nul | findstr "ok" >nul
    if not errorlevel 1 goto :ready
)

echo.
echo ================================================
echo   ERROR: Backend did not start within 30s
echo.
echo   Check:
echo   1. pip install -r requirements.txt
echo   2. Port 8800 is free
echo   3. Database is not corrupted
echo ================================================
pause
exit /b 1

:ready
echo.
echo ================================================
echo   Platform Ready
echo.
echo   URL:      http://localhost:8800
echo   API Docs: http://localhost:8800/docs
echo   Login:    admin / admin123
echo.
echo   Press Ctrl+C to stop
echo ================================================
echo.

start http://localhost:8800

echo Backend running. Close this window to stop.
pause >nul
