import sys
from pathlib import Path


SERVICE_ROOT = Path(__file__).resolve().parents[1]
SERVICE_ROOT_PATH = str(SERVICE_ROOT)
if SERVICE_ROOT_PATH not in sys.path:
    sys.path.insert(0, SERVICE_ROOT_PATH)
