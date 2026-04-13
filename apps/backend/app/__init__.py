import sys
from pathlib import Path


_ROOT = Path(__file__).resolve().parents[3]
for _p in [str(_ROOT), str(_ROOT / "packages")]:
    if _p not in sys.path:
        sys.path.insert(0, _p)
