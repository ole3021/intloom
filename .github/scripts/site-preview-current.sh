#!/usr/bin/env bash
set -euo pipefail

curl --fail --silent --show-error --retry 3 --retry-connrefused --max-time 30 \
  -H "Authorization: Bearer $GH_TOKEN" \
  -o "$RUNNER_TEMP/site-pull.json" "$GITHUB_API_URL/repos/$GITHUB_REPOSITORY/pulls/$1"
jq -nr --arg sha "$SHA" --arg repo "$HEAD_REPO" '
  input |
  if .state == "closed" then false
  elif .state == "open" and (.head.sha | type) == "string" and (.base.ref | type) == "string"
  then .base.ref == "main" and .head.sha == $sha and .head.repo.full_name == $repo
  else error("Invalid GitHub pull request response") end
' "$RUNNER_TEMP/site-pull.json"
