#!/usr/bin/env bash
# Do NOT use set -e — failures must accumulate, not abort the gate.

CHANGED=$(git diff --name-only HEAD 2>/dev/null || true)
[[ -z "$CHANGED" ]] && echo '{"decision":"allow"}' && exit 0

FAILURES=""
echo "$CHANGED" | grep -q '\.cs$' && \
  { dotnet test services/assets-svc/Tests/AssetsService.Tests.csproj -q >/dev/null 2>&1 || FAILURES="$FAILURES .NET tests failed."; }
echo "$CHANGED" | grep -q '\.java$' && \
  { (cd services/workforce-svc && mvn -q test --no-transfer-progress >/dev/null 2>&1) || FAILURES="$FAILURES Java tests failed."; }
echo "$CHANGED" | grep -q '\.py$' && \
  { (cd services/reporting-svc && pytest -q >/dev/null 2>&1) || FAILURES="$FAILURES Python tests failed."; }
echo "$CHANGED" | grep -qE '\.(ts|tsx|astro)$' && \
  { (cd services/web && npm run test:e2e --silent >/dev/null 2>&1) || FAILURES="$FAILURES Playwright tests failed."; }

if [[ -n "$FAILURES" ]]; then
  jq -n --arg reason "Tests are failing — fix before finishing this turn:$FAILURES" \
    '{"decision":"block","reason":$reason}'
else
  echo '{"decision":"allow"}'
fi