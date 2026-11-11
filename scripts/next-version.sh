#!/usr/bin/env bash
# The version the next release gets, from the titles of the changes since the latest vX.Y.Z tag (Conventional
# Commits): "feat!: …" (any type with "!") is the next major, "feat: …" the next minor, anything else (fix, docs,
# chore, ci …) the next patch. Only titles count: a commit's subject, or for a "Merge pull request" commit the pull
# request's title (the first line of its body). package.json's "version" wins when it is higher.
# Needs the repository's tags (checkout with fetch-depth: 0).
set -euo pipefail
cd "$(dirname "$0")/.."

wanted=$(jq -r '.version // ""' package.json)
if ! [[ $wanted =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "package.json's version must be x.y.z, not '$wanted'." >&2
  exit 1
fi
latest=$(git tag --list 'v*' | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -1 || true)
if [ -z "$latest" ]; then
  echo "v$wanted"
  exit 0
fi

titles=""
for sha in $(git rev-list "$latest..HEAD"); do
  title=$(git log -1 --format=%s "$sha")
  if [[ $title =~ ^Merge\ pull\ request\ \#[0-9]+ ]]; then
    title=$(git log -1 --format=%b "$sha" | sed '/^[[:space:]]*$/d' | head -1)
  fi
  titles+="$title"$'\n'
done

IFS=. read -r major minor patch <<< "${latest#v}"
if grep -qE '^[a-z]+(\([^)]*\))?!: ' <<< "$titles"; then
  next="v$((major + 1)).0.0"
elif grep -qE '^feat(\([^)]*\))?: ' <<< "$titles"; then
  next="v$major.$((minor + 1)).0"
else
  next="v$major.$minor.$((patch + 1))"
fi

if [ "$(printf '%s\n' "$next" "v$wanted" | sort -V | tail -1)" = "v$wanted" ]; then
  echo "v$wanted"
else
  echo "$next"
fi
