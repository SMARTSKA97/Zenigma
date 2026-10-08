#!/usr/bin/env bash
# Runs a command; if it fails, surfaces the last lines of its output as a GitHub error annotation
# (so failures are readable through the API/checks view without opening the raw log).
set -o pipefail
out="$(mktemp)"
"$@" 2>&1 | tee "$out"
code=${PIPESTATUS[0]}
if [ "$code" -ne 0 ]; then
  tail -n 40 "$out" | sed 's/%/%25/g' | awk 'BEGIN{ORS="%0A"} {print}' | { read -r msg; echo "::error title=Command failed: $1 $2::$msg"; }
fi
exit "$code"
