"""
F1 Dashboard — entrypoint.

Usage:
    python main.py          # start the FastAPI backend on port 8000
    python main.py --port N # start on a custom port
"""
import argparse


def main():
    parser = argparse.ArgumentParser(description="F1 Dashboard API server")
    parser.add_argument("--port", type=int, default=8000, help="Port to listen on")
    parser.add_argument("--host", default="0.0.0.0", help="Host to bind to")
    args = parser.parse_args()

    import uvicorn
    from api import app  # noqa: F401 — imported for uvicorn

    uvicorn.run("api:app", host=args.host, port=args.port, reload=True)


if __name__ == "__main__":
    main()
