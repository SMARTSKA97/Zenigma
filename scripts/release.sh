#!/usr/bin/env bash
# One command to ship an Android release: pull, check the release notes, tag, push the tag.
#   ./scripts/release.sh 0.11.0
# The notes must exist first: mobile/release-notes/<version>.md, starting with <!-- date: YYYY-MM-DD -->.
set -euo pipefail
cd "$(dirname "$0")/.."

version="${1:-}"
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "Usage: $0 <version, e.g. 0.11.0>" >&2; exit 1; }
tag="android-v$version"

[[ -z "$(git status --porcelain)" ]] || { echo "Uncommitted changes: commit or stash first." >&2; exit 1; }
[[ "$(git rev-parse --abbrev-ref HEAD)" == "main" ]] || { echo "Switch to main first." >&2; exit 1; }

git pull --ff-only

notes="mobile/release-notes/$version.md"
[[ -f "$notes" ]] || { echo "Missing $notes. Write the release notes first." >&2; exit 1; }
head -n 1 "$notes" | grep -Eq '^<!-- date: [0-9]{4}-[0-9]{2}-[0-9]{2} -->' || { echo "$notes must start with <!-- date: YYYY-MM-DD -->." >&2; exit 1; }
[[ -z "$(git tag --list "$tag")" ]] || { echo "Tag $tag already exists." >&2; exit 1; }
[[ -z "$(git ls-remote --tags origin "$tag")" ]] || { echo "Tag $tag already exists on origin." >&2; exit 1; }

git tag "$tag"
git push origin "$tag"
echo "Done. $tag is pushed; the APK is building: https://github.com/SMARTSKA97/Zenigma/actions"
