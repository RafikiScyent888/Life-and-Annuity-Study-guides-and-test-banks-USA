# Builds the site from templates/, content/ and states/. Run from anywhere:
#   powershell -ExecutionPolicy Bypass -File tools\build.ps1
# Writes index.html and, for each folder in states/, index.html, study-guide.html and practice-test.html.
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$utf8 = New-Object System.Text.UTF8Encoding $false

function Read-Text([string]$rel) { [IO.File]::ReadAllText((Join-Path $root $rel), $utf8) }
function Write-Text([string]$rel, [string]$text) {
  if ($text -match '\{\{[A-Z_]+\}\}') { throw "Unfilled placeholder $($Matches[0]) in $rel" }
  [IO.File]::WriteAllText((Join-Path $root $rel), $text, $utf8)
}
function Esc([string]$s) { $s.Replace('&', '&amp;').Replace('<', '&lt;').Replace('>', '&gt;') }
function Fill([string]$text, [hashtable]$vals) {
  foreach ($k in $vals.Keys) { $text = $text.Replace("{{$k}}", [string]$vals[$k]) }
  $text
}

# Reads a question bank and returns each question's part letter (A-G), using the bank's topic table
function Get-Parts([string]$rel) {
  $js = Read-Text $rel
  $topicPart = @{}
  foreach ($m in [regex]::Matches($js, '(\w+): \{ name: "[^"]*", part: "([A-G])" \}')) { $topicPart[$m.Groups[1].Value] = $m.Groups[2].Value }
  $parts = @()
  foreach ($m in [regex]::Matches($js, '(?m)^\s*(?:mc|tf|sa)\("[A-Za-z]+\d+", "(\w+)"')) {
    $t = $m.Groups[1].Value
    if (-not $topicPart.ContainsKey($t)) { throw "Unknown topic $t in $rel" }
    $parts += $topicPart[$t]
  }
  ,$parts
}

$site = Read-Text 'site.json' | ConvertFrom-Json
$common = @{ PRODUCT = (Esc $site.product); DISCLAIMER = (Esc $site.disclaimer) }
$coreLife = Get-Parts 'content/core-life.js'
$coreHealth = Get-Parts 'content/core-health.js'
$guideLife = Read-Text 'content/guide-core-life.html'
$guideHealth = Read-Text 'content/guide-core-health.html'
$guideMemory = Read-Text 'content/guide-memory-aids.html'

$cards = @()
$built = @{}
foreach ($dir in Get-ChildItem (Join-Path $root 'states') -Directory | Sort-Object Name) {
  $code = $dir.Name
  $state = Read-Text "states/$code/state.json" | ConvertFrom-Json
  $stateParts = Get-Parts "states/$code/questions.js"
  $all = $coreLife + $coreHealth + $stateParts
  $vals = $common.Clone()
  $vals.STATE = $state.code
  $vals.STATE_NAME = Esc $state.name
  $vals.STATE_LOWER = $state.code.ToLower()
  $vals.STATE_SUMMARY = Esc $state.summary
  $vals.Q_TOTAL = $all.Count
  $vals.Q_LIFE = $coreLife.Count
  $vals.Q_HEALTH = $coreHealth.Count
  $vals.Q_STATE = $stateParts.Count
  foreach ($p in 'A','B','C','D','E','F','G') { $vals["W_$p"] = @($all | Where-Object { $_ -eq $p }).Count }
  $vals.REVIEW_BANNER = if ($state.status -eq 'ready') { '' } else {
    "<div class=`"review-banner`"><div class=`"wrap`"><p><strong>In review.</strong> $(Esc $state.name)'s content is being checked by licensed professionals before release.</p></div></div>"
  }
  $vals.GUIDE_CORE_LIFE = $guideLife
  $vals.GUIDE_CORE_HEALTH = $guideHealth
  $vals.GUIDE_MEMORY = $guideMemory
  $vals.GUIDE_STATE_INTRO = Read-Text "states/$code/guide-intro.html"
  $vals.GUIDE_STATE_LAW = Read-Text "states/$code/guide-law.html"

  Write-Text "states/$code/index.html" (Fill (Read-Text 'templates/state-home.html') $vals)
  Write-Text "states/$code/study-guide.html" (Fill (Read-Text 'templates/study-guide.html') $vals)
  Write-Text "states/$code/practice-test.html" (Fill (Read-Text 'templates/practice-test.html') $vals)

  $label = if ($state.status -eq 'ready') { 'Ready' } else { 'In review' }
  $cards += "    <a class=`"state-card`" href=`"states/$code/`"><span class=`"abbr`">$($state.code)</span><h2>$(Esc $state.name)</h2><p>Life &amp; health &middot; $($all.Count) questions</p><span class=`"status $($state.status)`">$label</span></a>"
  $built[$state.code] = $true
  Write-Host "$($state.code): $($all.Count) questions ($($coreLife.Count) life, $($coreHealth.Count) health, $($stateParts.Count) state)"
}
foreach ($s in $site.comingSoon) {
  if ($built.ContainsKey($s.code)) { continue }
  $cards += "    <div class=`"state-card soon`"><span class=`"abbr`">$($s.code)</span><h2>$(Esc $s.name)</h2><p>In progress</p><span class=`"status`">Coming soon</span></div>"
}
$homeVals = $common.Clone()
$homeVals.STATE_CARDS = $cards -join "`n"
Write-Text 'index.html' (Fill (Read-Text 'templates/home.html') $homeVals)
Write-Host 'Built index.html'
