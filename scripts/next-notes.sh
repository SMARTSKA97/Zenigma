#!/usr/bin/env bash
# Prints the release-notes file that new changes belong in: the next minor version after the newest android-v* tag.
# Run it before adding any release note, so work done after a release never lands in the notes of a version that is already out.
set -euo pipefail
cd "$(dirname "$0")/.."
git fetch -q --tags origin 2>/dev/null || true
latest="$(git tag --list 'android-v*' | sed 's/^android-v//' | sort -V | tail -n1)"
[[ -n "$latest" ]] || { echo "No android-v* tag found." >&2; exit 1; }
IFS=. read -r major minor _ <<<"$latest"
next="$major.$((minor + 1)).0"
file="mobile/release-notes/$next.md"
if [[ ! -f "$file" ]]; then
  printf '<!-- date: %s -->\nIncludes everything from %s.\n' "$(date +%F)" "$latest" > "$file"
fi
echo "$file"
