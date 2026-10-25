#!/usr/bin/env bash
# Decides which parts of the repo a push touched, so CI and Deploy only run the jobs that matter.
# Usage: changes.sh ci|deploy      Writes key=true|false lines to $GITHUB_OUTPUT (and prints them).
#
#   api        the .NET API, its tests or the database migrations
#   db         database migrations (Flyway)
#   web        the Angular app, the puzzle generators or the shared test vectors
#   web_deploy the website itself (not the Android project)
#   puzzles    generated levels / vectors or their generators
#   android    the Capacitor Android project or what feeds it (package files, capacitor config)
#   docs_only  nothing but documentation changed
set -euo pipefail
mode="${1:-ci}"
head="${GITHUB_SHA:-HEAD}"
zero='0000000000000000000000000000000000000000'

all() { # every flag true: used when we cannot tell what changed
  for k in api db web web_deploy puzzles android; do echo "$k=true"; done
  echo "docs_only=false"
}

emit() { if [ -n "${GITHUB_OUTPUT:-}" ]; then tee -a "$GITHUB_OUTPUT"; else cat; fi; }

base=""
if [ "${GITHUB_EVENT_NAME:-}" = "workflow_dispatch" ]; then all | emit; exit 0; fi

if [ "$mode" = "deploy" ]; then
  # Compare with the last commit that deployed successfully, so a failed deploy is retried by the next push
  # (a plain "before..after" would forget it).
  base="$(gh api "repos/${GITHUB_REPOSITORY}/actions/workflows/deploy.yml/runs?status=success&branch=main&per_page=1" --jq '.workflow_runs[0].head_sha // empty' 2>/dev/null || true)"
  # Anything that is not a commit id (an API error message, say) is ignored.
  [[ "$base" =~ ^[0-9a-f]{40}$ ]] || base="${BEFORE_SHA:-}"
else
  if [ "${GITHUB_EVENT_NAME:-}" = "pull_request" ]; then
    base="${PR_BASE_SHA:-}"
  elif [ "${GITHUB_REF_NAME:-}" = "main" ]; then
    base="${BEFORE_SHA:-}"
  else
    # A work branch is checked as a whole: everything it changes compared with main.
    git fetch -q --no-tags origin main 2>/dev/null || true
    base="$(git merge-base origin/main "$head" 2>/dev/null || true)"
  fi
fi

if [ -z "$base" ] || [ "$base" = "$zero" ] || ! git cat-file -e "$base^{commit}" 2>/dev/null; then
  all | emit; exit 0
fi

files="$(git diff --name-only "$base" "$head")"
echo "Changed since ${base:0:7}:" >&2; echo "$files" | sed 's/^/  /' >&2

has() { echo "$files" | grep -Eq "$1"; }
flag() { if has "$2"; then echo "$1=true"; else echo "$1=false"; fi; }

# Editing the CI scripts or the CI workflow can break anything: check everything.
if [ "$mode" = "ci" ] && has '^\.github/(workflows/ci\.yml|scripts/)'; then all | emit; exit 0; fi

if [ "$mode" = "deploy" ]; then
  # Deploying: only the API's own code and image matter (its tests and the vectors do not ship); loading puzzles needs the schema too.
  api_re='^apps/api/(Zenigma\.Api/|Dockerfile|global\.json|Directory\.)'
  puzzles_re='^(tools/generators/|db/migrations/)'
else
  api_re='^(apps/api/|db/migrations/|tests/vectors/)'
  puzzles_re='^(tools/generators/|tests/vectors/)|[Ll]evels?/|vectors?/'
fi

{
  flag api        "$api_re"
  flag db         '^db/migrations/'
  flag web        '^(apps/web/|tools/generators/|tests/vectors/)'
  flag web_deploy '^(apps/web/(src|public)/|apps/web/(package(-lock)?\.json|angular\.json|ngsw-config\.json|tsconfig[^/]*\.json)$|tools/generators/)'
  flag puzzles    "$puzzles_re"
  flag android    '^(apps/web/android/|apps/web/(capacitor\.config\.ts|package(-lock)?\.json)$)'
  if echo "$files" | grep -Evq '^(docs/|README\.md$|CONTRIBUTING\.md$|SECURITY\.md$|LICENSE$|\.github/(ISSUE_TEMPLATE|FUNDING\.yml)|mobile/release-notes/)' ; then echo "docs_only=false"; else echo "docs_only=true"; fi
} | emit
