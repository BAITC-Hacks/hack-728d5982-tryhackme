"""Generate the single-file landing's API contract from its Pydantic models."""

import argparse
import json
from pathlib import Path

from app.landing import app

OUTPUT = Path(__file__).resolve().parent.parent / "contracts" / "landing.openapi.json"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    content = json.dumps(app.openapi(), ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    if args.check:
        if not OUTPUT.exists() or OUTPUT.read_text() != content:
            raise SystemExit("Outdated landing contract. Run generate_landing_openapi.py")
        print("Landing OpenAPI contract is current")
    else:
        OUTPUT.write_text(content)


if __name__ == "__main__":
    main()
