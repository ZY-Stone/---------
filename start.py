#!/usr/bin/env python3
"""
产品分析一体化平台 — 一键启动工具
用法: python start.py
功能: 检查环境 → 初始化数据库 → 启动后端 → 打开前端页面
"""
import sys
import os
import subprocess
import time
import webbrowser
import socket

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(BASE_DIR, "src", "backend")
FRONTEND_FILE = os.path.join(BASE_DIR, "src", "frontend", "index.html")

# 配置
HOST = "127.0.0.1"
PORT = 8800
URL = f"http://{HOST}:{PORT}"


def print_banner():
    print("""
╔══════════════════════════════════════════════════╗
║       产品分析一体化平台   v2.0                    ║
║       销售分析 · 产品宽度 · 潜力产品              ║
╚══════════════════════════════════════════════════╝
""")


def print_step(step, msg, status="..."):
    icon = {"ok": "  ✓", "fail": "  ✗", "warn": "  !", "...": "  ·"}
    print(f"{icon.get(status, '  ·')} [{step}] {msg}")


def check_python():
    """检查 Python 版本"""
    v = sys.version_info
    if v.major < 3 or (v.major == 3 and v.minor < 10):
        print_step("1/6", f"Python 版本过低: {v.major}.{v.minor} (需要 >= 3.10)", "fail")
        return False
    print_step("1/6", f"Python {v.major}.{v.minor}.{v.micro}", "ok")
    return True


def check_dependencies():
    """检查依赖包"""
    required = {
        "fastapi": "fastapi",
        "uvicorn": "uvicorn",
        "sqlalchemy": "sqlalchemy",
        "bcrypt": "bcrypt",
        "jose": "python-jose",
        "openpyxl": "openpyxl",
    }
    missing = []
    for mod, pkg in required.items():
        try:
            __import__(mod)
        except ImportError:
            missing.append(pkg)

    if missing:
        print_step("2/6", f"缺少依赖: {', '.join(missing)}", "warn")
        print("        正在自动安装...")
        for pkg in missing:
            try:
                subprocess.check_call(
                    [sys.executable, "-m", "pip", "install", pkg, "-q"],
                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
                )
                print(f"          {pkg} 安装成功")
            except Exception:
                print(f"          {pkg} 安装失败，请手动执行: pip install {pkg}", "fail")
                return False
    print_step("2/6", "依赖包就绪", "ok")
    return True


def init_database():
    """初始化数据库"""
    sys.path.insert(0, BACKEND_DIR)
    try:
        from database import init_db
        init_db()
        from seed import seed
        seed()
        print_step("3/6", "数据库初始化完成", "ok")
        return True
    except Exception as e:
        print_step("3/6", f"数据库初始化失败: {e}", "fail")
        return False


def check_port():
    """检查端口是否被占用"""
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    result = sock.connect_ex((HOST, PORT))
    sock.close()
    if result == 0:
        print_step("4/6", f"端口 {PORT} 已被占用，尝试关闭...", "warn")
        if sys.platform == "win32":
            try:
                output = subprocess.check_output(
                    f'netstat -ano | findstr :{PORT} | findstr LISTENING',
                    shell=True, text=True
                )
                for line in output.strip().split('\n'):
                    parts = line.split()
                    pid = parts[-1]
                    subprocess.run(f'taskkill //PID {pid} //F', shell=True,
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                time.sleep(1)
                print_step("4/6", f"端口 {PORT} 已释放", "ok")
            except Exception:
                print_step("4/6", f"端口 {PORT} 占用中，将尝试其他方式启动", "warn")
    else:
        print_step("4/6", f"端口 {PORT} 可用", "ok")


def start_server():
    """启动后端服务"""
    print_step("5/6", f"启动后端服务 → {URL}", "...")
    try:
        os.chdir(BACKEND_DIR)
        proc = subprocess.Popen(
            [sys.executable, "main.py"],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        # 等待服务就绪
        for i in range(20):
            time.sleep(0.5)
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            if sock.connect_ex((HOST, PORT)) == 0:
                sock.close()
                print_step("5/6", f"后端服务已就绪 (PID: {proc.pid})", "ok")
                return proc
            sock.close()
        print_step("5/6", "后端启动超时，请检查日志", "fail")
        return proc
    except Exception as e:
        print_step("5/6", f"启动失败: {e}", "fail")
        return None


def open_browser():
    """打开前端页面（由后端直接托管）"""
    try:
        webbrowser.open(URL)
        print_step("6/6", f"浏览器已打开 → {URL}", "ok")
    except Exception:
        print_step("6/6", f"请手动打开: {URL}", "warn")


def main():
    print_banner()

    if not check_python():
        sys.exit(1)

    if not check_dependencies():
        print("\n请安装依赖后重试:")
        print("  pip install fastapi uvicorn sqlalchemy bcrypt python-jose openpyxl")
        sys.exit(1)

    if not init_database():
        sys.exit(1)

    check_port()
    proc = start_server()

    if proc:
        open_browser()

        print(f"""
╔══════════════════════════════════════════════════╗
║  平台已启动！                                     ║
║                                                  ║
║  平台入口:   {URL}                          ║
║  API 文档:   {URL}/docs                      ║
║                                                  ║
║  默认账号:   admin / admin123                    ║
║  按 Ctrl+C 停止服务                              ║
╚══════════════════════════════════════════════════╝
""")

        # 监控服务
        try:
            while proc.poll() is None:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\n正在停止服务...")
            proc.terminate()
            proc.wait(timeout=5)
            print("服务已停止。")

    print("\n启动完成。")


def frontend_url():
    return f"file:///{FRONTEND_FILE.replace(os.sep, '/')}"


if __name__ == "__main__":
    main()
