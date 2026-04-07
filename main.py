import sys
import subprocess
import webbrowser
import time
import threading


def open_browser():
    time.sleep(1.5)
    webbrowser.open("http://localhost:8000")


def main():
    print("Starting Application Review...")
    threading.Thread(target=open_browser, daemon=True).start()
    try:
        import uvicorn
        uvicorn.run("app.server:app", host="0.0.0.0", port=8000, reload=False)
    except ImportError:
        print("ERROR: uvicorn is not installed. Run: uv sync")
        sys.exit(1)


if __name__ == "__main__":
    main()
