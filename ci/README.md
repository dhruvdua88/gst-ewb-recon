# CI workflow (manual install)

`github-actions-ci.yml` is the intended GitHub Actions workflow (typecheck + test +
build + html↔asset consistency check on every push/PR). It could not be pushed by the
tooling because the token lacks the `workflow` OAuth scope. To enable CI:

    mkdir -p .github/workflows
    cp ci/github-actions-ci.yml .github/workflows/ci.yml
    git add .github/workflows/ci.yml && git commit -m "Add CI" && git push

(Push from an account/token that has `workflow` scope.)
