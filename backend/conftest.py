"""Root conftest.py for backend tests — ensures backend/ is on sys.path first."""

import sys
import os

# Ensure the backend directory is the first on sys.path so that
# 'import main' finds backend/main.py, not the root-level main.py
backend_dir = os.path.dirname(__file__)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)
