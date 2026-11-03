#!/usr/bin/env python3

from pathlib import Path

project_root = Path(__file__).resolve().parent.parent
shell_scripts = list(project_root.rglob("*.sh"))

if not (project_root / "install.sh").is_file():
    raise SystemExit(f"Installer not found in {project_root}")

for script in shell_scripts:
    content = script.read_bytes()
    normalized = content.replace(b"\r\n", b"\n")
    if normalized != content:
        script.write_bytes(normalized)
    if b"\r\n" in script.read_bytes():
        raise SystemExit(f"Could not normalize line endings in {script}")

print(f"Normalized {len(shell_scripts)} shell scripts in {project_root}")
