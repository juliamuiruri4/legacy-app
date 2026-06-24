import sys
from pathlib import Path


SERVICE_ROOT = Path(__file__).resolve().parents[1]
service_root = str(SERVICE_ROOT)
if service_root not in sys.path:
    sys.path.insert(0, service_root)
