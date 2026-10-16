#!/usr/bin/env bash
# Veille des versions de Handy, utilisée par .github/workflows/veille-handy.yml.
#
# Compare la dernière release de Handy à la version dont J’écoute dérive (.github/upstream-version) et, s'il y a
# plus récent, ouvre un ticket « Handy vX.Y.Z est sortie » avec les notes de version et les commandes de
# synchronisation. Pas de doublon : rien n'est créé si un ticket du même titre existe déjà (ouvert ou fermé). Un
# ticket encore ouvert pour une version plus ancienne est fermé, avec un renvoi vers le nouveau.
#
# Variables : GH_TOKEN et GITHUB_REPOSITORY (fournies par le workflow), AMONT (dépôt de Handy, cjpais/Handy par
# défaut), FICHIER_VERSION (.github/upstream-version par défaut).
set -euo pipefail

amont="${AMONT:-cjpais/Handy}"
fichier="${FICHIER_VERSION:-.github/upstream-version}"
depot="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY non défini}"
motif='^v[0-9]+\.[0-9]+\.[0-9]+$'

# Vrai si la version $1 est strictement plus récente que $2 (vX.Y.Z).
plus_recente() {
  [ "$1" != "$2" ] && [ "$(printf '%s\n%s\n' "${1#v}" "${2#v}" | sort -V | tail -n 1)" = "${1#v}" ]
}

actuelle=$(tr -d '[:space:]' < "$fichier")
if ! [[ "$actuelle" =~ $motif ]]; then
  echo "::error file=$fichier::Version attendue sous la forme vX.Y.Z, lu « $actuelle »."
  exit 1
fi

derniere=$(gh api "repos/$amont/releases/latest" --jq '.tag_name')
if ! [[ "$derniere" =~ $motif ]]; then
  echo "::error::Tag inattendu pour la dernière release de $amont : « $derniere »."
  exit 1
fi

echo "J’écoute dérive de Handy $actuelle ; dernière release de Handy : $derniere."
if [ "$derniere" = "$actuelle" ]; then
  echo "À jour."
  exit 0
fi
if ! plus_recente "$derniere" "$actuelle"; then
  echo "::warning file=$fichier::$fichier ($actuelle) est plus récent que la dernière release de Handy ($derniere) : à vérifier."
  exit 0
fi

titre="Handy $derniere est sortie"

# Tickets de veille existants (ouverts et fermés) : numéro, état, titre.
tickets=$(gh issue list --repo "$depot" --state all --limit 1000 --json number,state,title \
  --jq '.[] | select(.title | test("^Handy v[0-9]+[.][0-9]+[.][0-9]+ est sortie$")) | "\(.number)\t\(.state)\t\(.title)"')

existant=$(awk -F '\t' -v t="$titre" '$3 == t { print $1; exit }' <<< "$tickets")
if [ -n "$existant" ]; then
  echo "Le ticket #$existant « $titre » existe déjà : rien à faire."
  exit 0
fi

# Notes de toutes les versions publiées depuis celle de J’écoute (plus récente d'abord).
releases=$(gh api "repos/$amont/releases?per_page=100" \
  --jq '.[] | select(.draft | not) | select(.prerelease | not) | "\(.tag_name)\t\(.html_url)\t\(.published_at)"')
notes=""
while IFS=$'\t' read -r tag url date; do
  [[ "$tag" =~ $motif ]] || continue
  if plus_recente "$tag" "$actuelle" && ! plus_recente "$tag" "$derniere"; then
    notes+="- [$tag]($url) (${date%%T*})"$'\n'
  fi
done <<< "$releases"
[ -n "$notes" ] || notes="- [$derniere](https://github.com/$amont/releases/tag/$derniere)"$'\n'

corps=$(mktemp)
trap 'rm -f "$corps"' EXIT
cat > "$corps" <<EOF
Une nouvelle version de [Handy](https://github.com/$amont), dont J’écoute dérive, est sortie : **$derniere**.
J’écoute est aujourd'hui basé sur Handy **$actuelle** (\`$fichier\`).

### Notes de version

${notes}
Différences du code : https://github.com/$amont/compare/$actuelle...$derniere

### Synchroniser

\`\`\`sh
git fetch upstream --no-tags "+refs/tags/$derniere:refs/tags/handy/$derniere"
git switch -c sync/handy-$derniere main
git merge --no-ff handy/$derniere
\`\`\`

Conflits : le cœur Rust (\`src-tauri/\`) suit Handy, l'interface (\`src/\`) reste celle de J’écoute et les
changements de Handy y sont reportés à la main. Ensuite : vérifications (\`bun run lint\`, \`bun run build\`,
\`cargo test\`), \`$fichier\` passé à \`$derniere\`, puis pull request fusionnée avec un commit de fusion (pas de
squash, pour garder l'historique de Handy).

_Ticket ouvert par le workflow « Veille Handy » (\`.github/workflows/veille-handy.yml\`)._
EOF

url=$(gh issue create --repo "$depot" --title "$titre" --body-file "$corps")
numero="${url##*/}"
echo "Ticket créé : $url"

# Un seul ticket de veille ouvert à la fois.
while IFS=$'\t' read -r ancien etat ancien_titre; do
  [ -n "$ancien" ] && [ "$etat" = "OPEN" ] || continue
  gh issue close "$ancien" --repo "$depot" --comment "Remplacé par #$numero ($titre)."
  echo "Ticket #$ancien « $ancien_titre » fermé, remplacé par #$numero."
done <<< "$tickets"

{
  echo "### Handy $derniere est sortie"
  echo "J’écoute dérive de Handy $actuelle. Ticket : $url"
} >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
