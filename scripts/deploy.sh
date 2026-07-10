#!/usr/bin/env bash
# Safe deploy to GitHub Pages (gh-pages branch).
#
# Why this exists: a plain "build then rsync to gh-pages" can publish an index.html
# that references a hashed asset which isn't in the same commit (stale dist, or the
# CDN caching html and assets separately). That produces a blank page / 404 on the
# bundle. This script CLEAN-builds and refuses to push unless index.html points at an
# asset that actually exists in the build.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "==> clean build"
rm -rf dist
npm run build >/dev/null

BUNDLE="$(grep -o 'assets/index-[A-Za-z0-9_]*\.js' dist/index.html | head -1)"
if [ -z "$BUNDLE" ] || [ ! -f "dist/$BUNDLE" ]; then
  echo "ERROR: index.html references '$BUNDLE' which is not in dist/. Aborting." >&2
  exit 1
fi
echo "==> consistency OK: index.html -> $BUNDLE (present)"

WT="$(mktemp -d)"
git fetch origin gh-pages:refs/remotes/origin/gh-pages 2>/dev/null || true
if git show-ref --verify --quiet refs/remotes/origin/gh-pages; then
  git worktree add -B gh-pages "$WT" origin/gh-pages >/dev/null
else
  git worktree add --orphan -b gh-pages "$WT" >/dev/null
fi

rsync -a --delete --exclude='.git' dist/ "$WT"/
touch "$WT/.nojekyll"

( cd "$WT"
  git add -A
  if git diff --cached --quiet; then
    echo "==> gh-pages already up to date"
  else
    git commit -q -m "Deploy $(grep -o '\"version\": *\"[^\"]*\"' "$REPO_ROOT/package.json" | head -1 | grep -o '[0-9][0-9.]*') — $BUNDLE"
    git push origin gh-pages
  fi )

git worktree remove "$WT" >/dev/null 2>&1 || true
git worktree prune

echo "==> triggering Pages rebuild"
gh api -X POST repos/dhruvdua88/gst-ewb-recon/pages/builds >/dev/null 2>&1 || true
echo "==> done. Verify: https://dhruvdua88.github.io/gst-ewb-recon/  (bundle $BUNDLE)"
