#!/usr/bin/env python
"""
FoodShare quality gate: smoke + edge tests and TypeScript ratchet.

    python scripts/run_checks.py               # backend always, frontends only if changed vs upstream
    python scripts/run_checks.py --all         # everything
    python scripts/run_checks.py --update-baseline   # lower the TS error baseline after you fix errors

Checks
  backend   pytest -m "smoke or edge" (in-process, read-only against the dev DB)
  admin     tsc -b --noEmit   -> error count must not exceed scripts/tsc-baseline.json
  mobile    tsc --noEmit      -> same ratchet

Exit code 0 = all green, 1 = at least one check failed, 2 = a check could not run.
Can also be called from a local pre-push hook; safe to run by hand.
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASELINE_FILE = os.path.join(ROOT, "scripts", "tsc-baseline.json")

TS_PACKAGES = {
    "admin-dashboard": ["tsc", "-b", "--noEmit"],
    "FoodShareMobile": ["tsc", "--noEmit"],
}


def _run(cmd, cwd, timeout=600, env=None):
    """Returns (exit_code, output). Tooling problems come back as code 127 instead of raising."""
    try:
        proc = subprocess.run(
            cmd, cwd=cwd, capture_output=True, text=True, encoding="utf-8",
            errors="replace", timeout=timeout, env=env,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        return 127, f"could not run {cmd[0]}: {exc}"
    return proc.returncode, (proc.stdout or "") + (proc.stderr or "")


def changed_packages():
    """Top-level folders touched by commits not yet on the upstream (what a push would send)."""
    for base in ("@{u}", "origin/main"):
        code, out = _run(["git", "diff", "--name-only", f"{base}...HEAD"], ROOT, timeout=60)
        if code == 0:
            return {line.split("/", 1)[0] for line in out.splitlines() if line.strip()}
    return None  # unknown -> caller runs everything


def check_backend():
    python = os.environ.get("FOODSHARE_PYTHON") or sys.executable
    env = dict(os.environ, PYTHONIOENCODING="utf-8")
    code, out = _run(
        [python, "-m", "pytest", "-m", "smoke or edge", "-q", "-p", "no:cacheprovider", "-W", "ignore"],
        os.path.join(ROOT, "backend"), env=env,
    )
    summary = next((l for l in reversed(out.splitlines()) if re.search(r"\d+ (passed|failed|error)", l)), out[-300:])
    if code == 0:
        return "pass", summary.strip()
    if code in (1,):
        failed = [l for l in out.splitlines() if l.startswith(("FAILED", "ERROR", "XPASS"))]
        return "fail", summary.strip() + "\n    " + "\n    ".join(failed[:15])
    return "error", f"pytest exited {code}: " + out[-600:].strip()


def load_baseline():
    try:
        with open(BASELINE_FILE, encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return {}


def check_ts(package, update_baseline=False):
    npx = shutil.which("npx") or shutil.which("npx.cmd")
    if not npx:
        return "error", "npx not found on PATH"
    code, out = _run([npx] + TS_PACKAGES[package], os.path.join(ROOT, package))
    count = len(re.findall(r"error TS\d+", out))
    if code != 0 and count == 0:
        return "error", f"tsc exited {code} without TS errors (config/tooling problem): {out[-400:].strip()}"

    baseline = load_baseline()
    allowed = baseline.get(package, 0)
    if update_baseline and count < allowed:
        baseline[package] = count
        with open(BASELINE_FILE, "w", encoding="utf-8") as fh:
            json.dump(baseline, fh, indent=2)
            fh.write("\n")
        return "pass", f"{count} TS errors (baseline lowered from {allowed})"
    if count > allowed:
        new = [l for l in out.splitlines() if "error TS" in l]
        return "fail", f"{count} TS errors > baseline {allowed} (new errors introduced)\n    " + "\n    ".join(new[:15])
    note = f" - run with --update-baseline to lock in the improvement" if count < allowed else ""
    return "pass", f"{count} TS errors (baseline {allowed}){note}"


def main():
    # Windows consoles here default to cp1254; tool output (and OS error text) may not encode.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--all", action="store_true", help="run every check regardless of what changed")
    parser.add_argument("--update-baseline", action="store_true", help="lower TS baselines when error counts dropped")
    args = parser.parse_args()

    changed = None if args.all else changed_packages()
    results = [("backend smoke+edge", *check_backend())]
    for package in TS_PACKAGES:
        if changed is None or package in changed or args.update_baseline:
            results.append((f"{package} tsc", *check_ts(package, args.update_baseline)))
        else:
            results.append((f"{package} tsc", "skip", "no changes vs upstream"))

    for name, status, detail in results:
        print(f"[{status.upper():5}] {name}: {detail}")

    statuses = {status for _, status, _ in results}
    if "error" in statuses:
        return 2
    return 1 if "fail" in statuses else 0


if __name__ == "__main__":
    sys.exit(main())
