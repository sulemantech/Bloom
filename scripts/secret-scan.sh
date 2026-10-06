#!/usr/bin/env bash
# Looks for API keys, private keys and files that must never be committed (.env, .db, .pem, ...).
# Uses gitleaks when installed, otherwise a regex scan. Run directly or via githooks/pre-push.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

fail=0

echo "==> Secret scan"

if command -v gitleaks >/dev/null 2>&1; then
  gitleaks detect --source "$ROOT" --redact --no-banner
else
  echo "gitleaks not found; using fallback regex scan over tracked files."

  tmp="${TMPDIR:-/tmp}/secret-scan.$$"
  trap 'rm -f "$tmp"' EXIT

  git grep -n -I -E \
    '(AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|sk-[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|xox[baprs]-[A-Za-z0-9-]{20,}|gh[pousr]_[A-Za-z0-9_]{20,}|-----BEGIN (RSA |DSA |EC |OPENSSH |PGP )?PRIVATE KEY-----)' \
    -- \
    ':!scripts/secret-scan.sh' \
    ':!githooks/pre-push' \
    > "$tmp" || true

  if [ -s "$tmp" ]; then
    echo "Potential secret patterns found:"
    cat "$tmp"
    fail=1
  fi

  git diff --cached -U0 --diff-filter=ACMR -- \
    . \
    ':!scripts/secret-scan.sh' \
    ':!githooks/pre-push' \
    | grep -nE \
      '(AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|sk-[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|xox[baprs]-[A-Za-z0-9-]{20,}|gh[pousr]_[A-Za-z0-9_]{20,}|-----BEGIN (RSA |DSA |EC |OPENSSH |PGP )?PRIVATE KEY-----)' \
    > "$tmp" || true

  if [ -s "$tmp" ]; then
    echo "Potential secret patterns found in staged diff:"
    cat "$tmp"
    fail=1
  fi
fi

if git rev-parse --verify HEAD >/dev/null 2>&1; then
  staged_files="$(git diff --cached --name-only --diff-filter=ACMR)"
else
  staged_files="$(git ls-files --cached)"
fi

if [ -n "$staged_files" ]; then
  forbidden_staged="$(
    printf '%s\n' "$staged_files" \
      | grep -vE '(^|/)\.env\.example$' \
      | grep -nE '(^|/)\.env($|\.)|\.pem$|\.key$|\.crt$|\.db$|\.db-wal$|\.db-shm$|\.log$|(^|/)(CLAUDE|Claude|claude)\.md$|(^|/)(AGENTS|AGENT|Agent|agent|agents)\.md$' || true
  )"

  if [ -n "$forbidden_staged" ]; then
    echo "Forbidden files are staged:"
    printf '%s\n' "$forbidden_staged"
    fail=1
  fi
fi

if [ "$fail" -ne 0 ]; then
  echo "Secret scan failed."
  exit 1
fi

echo "Secret scan passed."
