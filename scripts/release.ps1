<#
.SYNOPSIS
  One command to ship an Android release: pull, check the release notes, tag, push the tag.

.EXAMPLE
  .\scripts\release.ps1 0.11.0      # tags android-v0.11.0
  .\scripts\release.ps1 -Bump minor # next minor after the latest android tag (0.10.0 -> 0.11.0)
  .\scripts\release.ps1 -Bump patch # 0.10.0 -> 0.10.1
  .\scripts\release.ps1 0.11.0 -DryRun   # show what would happen, change nothing

  Pushing the tag starts the "Release Android" workflow, which builds the APK and publishes the GitHub release.
  The release notes must exist first: mobile/release-notes/<version>.md, starting with <!-- date: YYYY-MM-DD -->.
#>
param(
  [Parameter(Position = 0)] [string] $Version,
  [ValidateSet('major', 'minor', 'patch')] [string] $Bump,
  [switch] $DryRun
)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)

function Run([string] $What) {
  if ($DryRun) { Write-Host "[dry run] $What" -ForegroundColor DarkGray; return }
  Invoke-Expression $What
  if ($LASTEXITCODE -ne 0) { throw "Failed: $What" }
}

# Work out the version.
if (-not $Version) {
  if (-not $Bump) { throw 'Give a version (e.g. 0.11.0) or -Bump major|minor|patch.' }
  git fetch --tags --quiet
  $latest = git tag --list 'android-v*' | ForEach-Object { [version]($_ -replace '^android-v', '') } | Sort-Object -Descending | Select-Object -First 1
  if (-not $latest) { throw 'No android-v* tag found to bump from.' }
  $Version = switch ($Bump) {
    'major' { "$($latest.Major + 1).0.0" }
    'minor' { "$($latest.Major).$($latest.Minor + 1).0" }
    'patch' { "$($latest.Major).$($latest.Minor).$([Math]::Max($latest.Build, 0) + 1)" }
  }
}
if ($Version -notmatch '^\d+\.\d+\.\d+$') { throw "Version must look like 1.2.3, not '$Version'." }
$tag = "android-v$Version"

# Safety checks.
if (git status --porcelain) { throw 'You have uncommitted changes. Commit or stash them first.' }
$branch = git rev-parse --abbrev-ref HEAD
if ($branch -ne 'main') { throw "You are on '$branch'. Switch to main first." }

Write-Host "Pulling main..." -ForegroundColor Cyan
Run 'git pull --ff-only'

$notes = "mobile/release-notes/$Version.md"
if (-not (Test-Path $notes)) { throw "Missing $notes. Write the release notes first." }
if ((Get-Content $notes -TotalCount 1) -notmatch '^<!-- date: \d{4}-\d{2}-\d{2} -->') { throw "$notes must start with <!-- date: YYYY-MM-DD -->." }
if (git tag --list $tag) { throw "Tag $tag already exists." }
if (git ls-remote --tags origin $tag) { throw "Tag $tag already exists on origin." }

Write-Host "Tagging $tag and pushing..." -ForegroundColor Cyan
Run "git tag $tag"
Run "git push origin $tag"

Write-Host ""
Write-Host "Done. $tag is on GitHub; the APK is building:" -ForegroundColor Green
Write-Host "  https://github.com/SMARTSKA97/Zenigma/actions"
