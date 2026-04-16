import os
import sys
import subprocess
import webbrowser
import time
import threading


def open_browser(port):
    # Only try to open the browser if not running in Docker
    if os.getenv("IS_DOCKER") == "true":
        return
    time.sleep(1.5)
    webbrowser.open(f"http://localhost:{port}")


def main():
    port = int(os.getenv("PORT", 3000))
    print(f"Starting Application Review on port {port}...")
    
    # Start browser thread
    threading.Thread(target=open_browser, args=(port,), daemon=True).start()
    
    try:
        import uvicorn
        uvicorn.run("app.server:app", host="0.0.0.0", port=port, reload=False)
    except ImportError:
        print("ERROR: uvicorn is not installed. Run: uv sync")
        sys.exit(1)


if __name__ == "__main__":
    main()
