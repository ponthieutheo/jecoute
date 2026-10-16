<#
.SYNOPSIS
  Test de bout en bout des outils de release, sans aucun secret.

.DESCRIPTION
  Génère une clé de mise à jour jetable, signe deux faux installeurs nommés comme ceux de Tauri
  (« J’écoute_<version>_x64-setup.exe », « J’écoute_<version>_x64_en-US.msi »), puis :
    1. prepare-release.ps1 doit produire les noms ASCII, latest.json et SHA256SUMS.txt ;
    2. verify-updater-sig doit tout accepter avec la clé jetable ;
    3. verify-updater-sig doit refuser un installeur modifié d'un seul bit.

  À lancer depuis la racine du dépôt, après `bun install`. Utilisé par le workflow ci.yml.
#>
[CmdletBinding()]
param(
  [string] $WorkDir = (Join-Path ([IO.Path]::GetTempPath()) "jecoute-test-release")
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version 3.0
# Journaux lisibles (accents) quand la sortie est redirigée, comme dans GitHub Actions.
try { [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false } catch { }

function Invoke-Checked([string] $Exe, [string[]] $Arguments) {
  $eap = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try { & $Exe @Arguments | Out-Host } finally { $ErrorActionPreference = $eap }
  return $LASTEXITCODE
}

# Ce test n'utilise que sa clé jetable, jamais une vraie clé présente dans l'environnement.
Remove-Item Env:TAURI_SIGNING_PRIVATE_KEY, Env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD, Env:TAURI_SIGNING_PRIVATE_KEY_PATH -ErrorAction SilentlyContinue

$root = (Get-Location).Path
$conf = Get-Content -LiteralPath (Join-Path $root "src-tauri/tauri.conf.json") -Raw -Encoding UTF8
$version = ($conf | ConvertFrom-Json).version
$product = "J" + [char]0x2019 + [char]0x00E9 + "coute"
$password = "cle-jetable-de-test"
$verifier = Join-Path $root ".github/tools/verify-updater-sig/Cargo.toml"
$base = "https://github.com/ponthieutheo/jecoute/releases/download/v$version"

if (Test-Path -LiteralPath $WorkDir) { Remove-Item -LiteralPath $WorkDir -Recurse -Force }
$bundle = Join-Path $WorkDir "bundle"
New-Item -ItemType Directory -Path (Join-Path $bundle "nsis"), (Join-Path $bundle "msi") | Out-Null

Write-Host "==> Clé jetable"
$key = Join-Path $WorkDir "cle.key"
if ((Invoke-Checked "bun" @("run", "tauri", "signer", "generate", "--ci", "-p", $password, "-w", $key)) -ne 0) { throw "tauri signer generate a échoué" }
$pub = ([IO.File]::ReadAllText("$key.pub")).Trim()
$testConf = [regex]::Replace($conf, '"pubkey"\s*:\s*"[^"]*"', '"pubkey": "' + $pub + '"')
if ($testConf -eq $conf) { throw "pubkey introuvable dans tauri.conf.json" }
$confPath = Join-Path $WorkDir "tauri.conf.json"
[IO.File]::WriteAllText($confPath, $testConf, (New-Object Text.UTF8Encoding $false))

Write-Host "==> Faux installeurs signés"
$rng = New-Object Random 2026
foreach ($f in @("nsis/${product}_${version}_x64-setup.exe", "msi/${product}_${version}_x64_en-US.msi")) {
  $path = Join-Path $bundle $f
  $bytes = New-Object byte[] 65536
  $rng.NextBytes($bytes)
  [IO.File]::WriteAllBytes($path, $bytes)
  if ((Invoke-Checked "bun" @("run", "tauri", "signer", "sign", "-f", $key, "-p", $password, $path)) -ne 0) { throw "tauri signer sign a échoué pour $f" }
}

Write-Host "==> prepare-release.ps1"
$out = Join-Path $WorkDir "out"
& (Join-Path $root ".github/scripts/prepare-release.ps1") -BundleDir $bundle -Version $version -OutDir $out -BodyPath (Join-Path $WorkDir "notes.md")
$expected = @("Jecoute_${version}_x64-setup.exe", "Jecoute_${version}_x64-setup.exe.sig", "Jecoute_${version}_x64_en-US.msi",
  "Jecoute_${version}_x64_en-US.msi.sig", "SHA256SUMS.txt", "latest.json")
$actual = @(Get-ChildItem -LiteralPath $out | ForEach-Object { $_.Name } | Sort-Object)
if (($actual -join "|") -ne (($expected | Sort-Object) -join "|")) { throw "Fichiers produits inattendus : $($actual -join ', ')" }

$verify = @("run", "--quiet", "--release", "--locked", "--manifest-path", $verifier, "--", $confPath, $out, "--base-url", $base,
  "--require", "windows-x86_64", "--require", "windows-x86_64-nsis", "--require", "windows-x86_64-msi")

Write-Host "==> verify-updater-sig (doit accepter)"
if ((Invoke-Checked "cargo" $verify) -ne 0) { throw "verify-updater-sig a refusé une release valide" }

Write-Host "==> verify-updater-sig (doit refuser un installeur modifié)"
$setup = Join-Path $out "Jecoute_${version}_x64-setup.exe"
$bytes = [IO.File]::ReadAllBytes($setup)
$bytes[100] = $bytes[100] -bxor 1
[IO.File]::WriteAllBytes($setup, $bytes)
if ((Invoke-Checked "cargo" $verify) -eq 0) { throw "verify-updater-sig a accepté un installeur modifié" }

Remove-Item -LiteralPath $WorkDir -Recurse -Force
Write-Host "Outils de release : OK"
# Le dernier verify-updater-sig a (volontairement) échoué : ne pas laisser son code de sortie à l'appelant.
exit 0
