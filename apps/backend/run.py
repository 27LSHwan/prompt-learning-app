"""
백엔드 실행 스크립트

사용법:
    cd apps/backend
    python run.py
"""

import sys
import os
from pathlib import Path

import uvicorn

# 프로젝트 루트와 packages 경로를 PYTHONPATH에 추가
_root = Path(__file__).resolve().parents[2]
for _p in [str(_root), str(_root / "packages")]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=[str(Path(__file__).resolve().parent / "app")],
    )
