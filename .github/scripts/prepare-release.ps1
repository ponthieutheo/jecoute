<#
.SYNOPSIS
  Prépare les fichiers d'une release Windows x64 de J’écoute à partir du dossier bundle de Tauri.

.DESCRIPTION
  Utilisé par le workflow release.yml et par la publication manuelle, pour que les deux produisent
  exactement les mêmes fichiers :
    - copie les installeurs NSIS et MSI et leurs signatures de mise à jour (.sig) sous des noms ASCII :
        Jecoute_<version>_x64-setup.exe(.sig)   Jecoute_<version>_x64_en-US.msi(.sig)
      (le nom de produit « J’écoute » n'est pas ASCII ; la signature porte sur le contenu, pas sur le nom) ;
    - écrit latest.json, le manifeste lu par le plugin de mise à jour de Tauri v2 ;
    - écrit SHA256SUMS.txt ;
    - écrit éventuellement le texte de la release (BodyPath), en dehors du dossier de sortie.

  Fonctionne avec Windows PowerShell 5.1 et PowerShell 7.
#>
[CmdletBinding()]
param(
  # Dossier bundle produit par `tauri build` (contient nsis\ et msi\).
  [Parameter(Mandatory = $true)] [string] $BundleDir,
  [Parameter(Mandatory = $true)] [string] $Version,
  # Dossier de sortie : créé s'il n'existe pas, doit être vide s'il existe.
  [Parameter(Mandatory = $true)] [string] $OutDir,
  [string] $Repository = "ponthieutheo/jecoute",
  [string] $Notes = "",
  # Date de publication RFC 3339 ; par défaut, maintenant (UTC).
  [string] $PubDate = "",
  # Fichier Markdown du texte de la release (facultatif).
  [string] $BodyPath = "",
  # Le texte de la release mentionne les attestations de provenance : seulement depuis release.yml, qui les
  # crée (une publication manuelle n'en a pas).
  [switch] $Attestations
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version 3.0
# Journaux lisibles (accents) quand la sortie est redirigée, comme dans GitHub Actions.
try { [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false } catch { }

if ($Version -notmatch '^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$') {
  throw "Version invalide : '$Version' (attendu : semver, sans 'v')."
}

$productName = "J" + [char]0x2019 + [char]0x00E9 + "coute"  # J’écoute, sans dépendre de l'encodage du fichier
$baseUrl = "https://github.com/$Repository/releases/download/v$Version"
$utf8NoBom = New-Object System.Text.UTF8Encoding $false

# JSON écrit à la main : sortie identique sous PowerShell 5.1 et 7 (ConvertTo-Json n'indente pas pareil).
function ConvertTo-JsonText($Value, [int] $Indent = 0) {
  if ($Value -is [System.Collections.IDictionary]) {
    $pad = "  " * ($Indent + 1)
    $items = foreach ($key in $Value.Keys) {
      $pad + (ConvertTo-JsonText ([string] $key)) + ": " + (ConvertTo-JsonText $Value[$key] ($Indent + 1))
    }
    return "{`n" + ($items -join ",`n") + "`n" + ("  " * $Indent) + "}"
  }
  $sb = New-Object System.Text.StringBuilder
  [void] $sb.Append('"')
  foreach ($c in ([string] $Value).ToCharArray()) {
    $code = [int] $c
    if ($code -eq 0x22) { [void] $sb.Append('\"') }
    elseif ($code -eq 0x5C) { [void] $sb.Append('\\') }
    elseif ($code -eq 0x0A) { [void] $sb.Append('\n') }
    elseif ($code -eq 0x0D) { [void] $sb.Append('\r') }
    elseif ($code -eq 0x09) { [void] $sb.Append('\t') }
    elseif ($code -lt 0x20) { [void] $sb.Append(('\u{0:x4}' -f $code)) }
    else { [void] $sb.Append($c) }
  }
  [void] $sb.Append('"')
  return $sb.ToString()
}

function Find-One([string] $Dir, [string] $Filter) {
  if (-not (Test-Path -LiteralPath $Dir)) { throw "Dossier introuvable : $Dir" }
  $found = @(Get-ChildItem -LiteralPath $Dir -File | Where-Object { $_.Name -like $Filter })
  if ($found.Count -ne 1) {
    $list = ($found | ForEach-Object { $_.Name }) -join ", "
    throw "Attendu exactement un fichier '$Filter' dans $Dir, trouvé $($found.Count) : $list"
  }
  $sig = $found[0].FullName + ".sig"
  if (-not (Test-Path -LiteralPath $sig)) {
    throw "Signature de mise à jour absente : $sig (TAURI_SIGNING_PRIVATE_KEY était-elle définie pendant le build ?)"
  }
  return $found[0]
}

$artifacts = @(
  [pscustomobject]@{ Kind = "nsis"; Source = (Find-One (Join-Path $BundleDir "nsis") "*_${Version}_x64-setup.exe"); Name = "Jecoute_${Version}_x64-setup.exe" },
  [pscustomobject]@{ Kind = "msi"; Source = (Find-One (Join-Path $BundleDir "msi") "*_${Version}_x64_en-US.msi"); Name = "Jecoute_${Version}_x64_en-US.msi" }
)

if (Test-Path -LiteralPath $OutDir) {
  if (@(Get-ChildItem -LiteralPath $OutDir -Force).Count -gt 0) { throw "Le dossier de sortie n'est pas vide : $OutDir" }
} else {
  New-Item -ItemType Directory -Path $OutDir | Out-Null
}
$OutDir = (Resolve-Path -LiteralPath $OutDir).Path

$platforms = [ordered]@{}
$sums = New-Object System.Collections.Generic.List[string]
foreach ($a in $artifacts) {
  $dest = Join-Path $OutDir $a.Name
  Copy-Item -LiteralPath $a.Source.FullName -Destination $dest
  Copy-Item -LiteralPath ($a.Source.FullName + ".sig") -Destination ($dest + ".sig")

  $srcHash = (Get-FileHash -LiteralPath $a.Source.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
  $dstHash = (Get-FileHash -LiteralPath $dest -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($srcHash -ne $dstHash) { throw "Copie corrompue : $($a.Name)" }

  # Le .sig de Tauri est une seule ligne base64 ; le plugin la décode telle quelle, donc sans espace final.
  $signature = ([System.IO.File]::ReadAllText($dest + ".sig")).Trim()
  if ($signature -notmatch '^[A-Za-z0-9+/]+={0,2}$') { throw "Signature inattendue dans $($a.Name).sig" }

  $entry = [ordered]@{ signature = $signature; url = "$baseUrl/$($a.Name)" }
  if ($a.Kind -eq "nsis") {
    # Clé générique (lue en dernier recours par le plugin) = l'installeur NSIS, l'installeur conseillé.
    $platforms["windows-x86_64"] = $entry
  }
  $platforms["windows-x86_64-$($a.Kind)"] = $entry
  $sums.Add("$dstHash  $($a.Name)")
  Write-Host ("{0,-40} <- {1}" -f $a.Name, $a.Source.Name)
}

if (-not $PubDate) { $PubDate = [DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ", [Globalization.CultureInfo]::InvariantCulture) }
if (-not $Notes) { $Notes = "$productName $Version : https://github.com/$Repository/releases/tag/v$Version" }

$manifest = [ordered]@{
  version   = $Version
  notes     = $Notes
  pub_date  = $PubDate
  platforms = $platforms
}
# UTF-8 sans BOM : le plugin lit la réponse avec serde_json, qui refuse un BOM.
$json = ConvertTo-JsonText $manifest
[System.IO.File]::WriteAllText((Join-Path $OutDir "latest.json"), $json + "`n", $utf8NoBom)
[System.IO.File]::WriteAllText((Join-Path $OutDir "SHA256SUMS.txt"), (($sums -join "`n") + "`n"), $utf8NoBom)
Write-Host ("{0,-40} (manifeste de mise à jour)" -f "latest.json")
Write-Host ("{0,-40} (sommes de contrôle)" -f "SHA256SUMS.txt")

if ($BodyPath) {
  $setup = $artifacts[0].Name
  $msi = $artifacts[1].Name
  $lines = @(
    "## $productName $Version",
    ""
  )
  if ($PSBoundParameters.ContainsKey("Notes") -and $PSBoundParameters["Notes"]) { $lines += @($PSBoundParameters["Notes"], "") }
  $lines += @(
    "### Installer (Windows 10/11, 64 bits)",
    "",
    "- **``$setup``** : l'installeur conseillé (il propose aussi une installation portable).",
    "- ``$msi`` : la même application en paquet MSI, pour un déploiement géré.",
    "",
    "Les installeurs ne sont pas encore signés : Windows SmartScreen peut afficher « Windows a protégé votre ordinateur ». Clique sur « Informations complémentaires », puis sur « Exécuter quand même ».",
    "",
    "Une installation existante se met à jour d'elle-même (``latest.json`` et fichiers ``.sig``).",
    "",
    "### Install (English)",
    "",
    "Windows 10/11, 64-bit. **``$setup``** is the recommended installer (it also offers a portable install); ``$msi`` is the same app as an MSI package. The installers are not code-signed yet: if Windows SmartScreen says *Windows protected your PC*, click **More info**, then **Run anyway**. Existing installations update themselves.",
    ""
  )
  if ($Attestations) {
    $lines += @(
      "Provenance vérifiable : les installeurs et ``latest.json`` sont attestés par le workflow de release de ce dépôt (``gh attestation verify <fichier> --repo $Repository``).",
      ""
    )
  }
  $lines += @(
    "### Sommes de contrôle SHA-256",
    "",
    "| Fichier | SHA-256 |",
    "| --- | --- |"
  )
  foreach ($line in $sums) {
    $parts = $line -split "  ", 2
    $lines += "| ``$($parts[1])`` | ``$($parts[0])`` |"
  }
  [System.IO.File]::WriteAllText($BodyPath, (($lines -join "`n") + "`n"), $utf8NoBom)
  Write-Host "Texte de la release : $BodyPath"
}
