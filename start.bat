@echo off
chcp 65001 >nul
title 产品分析一体化平台 v2.0

echo.
echo ╔══════════════════════════════════════════════════╗
echo ║    产品分析一体化平台 v2.0                        ║
echo ║    销售分析 · 产品宽度 · 潜力产品                 ║
echo ╚══════════════════════════════════════════════════╝
echo.

cd /d "%~dp0"

:: ── 1. 关闭旧进程 ──
echo [1/4] 关闭旧服务进程...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8800" ^| findstr "LISTENING" 2^>nul') do (
    taskkill /F /PID %%a >nul 2>&1
    echo        已关闭 PID %%a
)
echo        端口 8800 已清理
echo.

:: ── 2. 清除 Python 缓存 ──
echo [2/4] 清除 Python 缓存...
if exist "src\backend\__pycache__" rmdir /s /q "src\backend\__pycache__" 2>nul
for /d /r "src\backend" %%d in (__pycache__) do rmdir /s /q "%%d" 2>nul
echo        缓存已清除
echo.

:: ── 3. 查找 Python ──
echo [3/4] 查找 Python 环境...
set PYTHON=
set "PY312=%LocalAppData%\Programs\Python\Python312\python.exe"
if exist "%PY312%" ( set PYTHON=%PY312% & goto :found )
for %%p in (python3 python py) do (
    where %%p >nul 2>&1
    if not errorlevel 1 ( set PYTHON=%%p & goto :found )
)
echo [ERROR] Python not found! Install Python 3.10+
echo         https://www.python.org/downloads/
pause
exit /b 1

:found
echo        %PYTHON%
echo.

:: ── 4. 启动平台 ──
echo [4/4] 启动平台...
echo.
echo ╔══════════════════════════════════════════════════╗
echo ║  ✅ 请通过浏览器访问:                             ║
echo ║     http://localhost:8800                        ║
echo ║                                                  ║
echo ║  ❌ 不要直接打开 index.html 文件                  ║
echo ║                                                  ║
echo ║  默认账号: admin / admin123                      ║
echo ║  按 Ctrl+C 停止服务                              ║
echo ╚══════════════════════════════════════════════════╝
echo.

%PYTHON% start.py

pause
