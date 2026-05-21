param(
  [string]$BackendUrl = "http://127.0.0.1:8080",
  [string]$TeacherUrl = "http://127.0.0.1:5174",
  [string]$StudentUrl = "http://127.0.0.1:5173",
  [string]$EdgePath = ""
)

$ErrorActionPreference = "Stop"

function Resolve-EdgePath {
  param([string]$Hint)
  if ($Hint -and (Test-Path $Hint)) {
    return $Hint
  }
  $candidates = @(
    "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
  )
  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) {
      return $candidate
    }
  }
  throw "Microsoft Edge was not found. Pass -EdgePath explicitly."
}

function Get-HttpStatusCode {
  param(
    [string]$Url,
    [string]$Method = "GET",
    [string]$Body = "",
    [string]$ContentType = "application/json"
  )
  try {
    if ($Method -eq "GET") {
      $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing -Method Get -TimeoutSec 10
    } else {
      $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing -Method $Method -Body $Body -ContentType $ContentType -TimeoutSec 10
    }
    return [int]$resp.StatusCode
  } catch {
    if ($_.Exception.Response -ne $null) {
      return [int]$_.Exception.Response.StatusCode.value__
    }
    throw
  }
}

function Get-Json {
  param(
    [string]$Url,
    [string]$Method = "GET",
    [string]$Body = "",
    [string]$ContentType = "application/json"
  )
  if ($Method -eq "GET") {
    return Invoke-RestMethod -Uri $Url -Method Get -TimeoutSec 15
  }
  return Invoke-RestMethod -Uri $Url -Method $Method -Body $Body -ContentType $ContentType -TimeoutSec 15
}

function Wait-Ready {
  param(
    [string]$Url,
    [int]$Retries = 30
  )
  for ($i = 0; $i -lt $Retries; $i++) {
    try {
      $status = Get-HttpStatusCode -Url $Url
      if ($status -ge 200 -and $status -lt 500) {
        return
      }
    } catch {
      Start-Sleep -Milliseconds 1000
    }
    Start-Sleep -Milliseconds 1000
  }
  throw "Service not ready: $Url"
}

function Get-RenderedHtml {
  param(
    [string]$BrowserPath,
    [string]$Url
  )
  $previousErrorActionPreference = $ErrorActionPreference
  try {
    # Headless Edge can emit non-fatal Chromium diagnostics on stderr. Keep the
    # script strict for real failures, but do not treat browser stderr as fatal.
    $ErrorActionPreference = "Continue"
    $html = & $BrowserPath --headless=new --disable-gpu --virtual-time-budget=8000 --dump-dom $Url 2>$null | Out-String
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
  if ([string]::IsNullOrWhiteSpace($html)) {
    throw "Failed to render DOM from $Url"
  }
  return $html
}

function Assert-Contains {
  param(
    [string]$Text,
    [string]$Needle,
    [string]$Label
  )
  if (-not $Text.Contains($Needle)) {
    throw "Assertion failed: '$Label' did not contain '$Needle'"
  }
}

$resolvedEdgePath = Resolve-EdgePath -Hint $EdgePath
Write-Host "Using Edge:" $resolvedEdgePath

Write-Host "Checking backend health..."
Wait-Ready -Url "$BackendUrl/actuator/health"
$health = Get-Json -Url "$BackendUrl/actuator/health"
if ($health.status -ne "UP") {
  throw "Backend health is not UP"
}

Write-Host "Checking Prometheus scrape endpoint..."
$promStatus = Get-HttpStatusCode -Url "$BackendUrl/actuator/prometheus"
if ($promStatus -ne 200) {
  throw "Prometheus endpoint failed with status $promStatus"
}

Write-Host "Checking auth guard on protected API..."
$questionsStatus = Get-HttpStatusCode -Url "$BackendUrl/api/questions"
if ($questionsStatus -ne 401) {
  throw "Expected 401 for unauthenticated /api/questions, got $questionsStatus"
}

Write-Host "Checking teacher portal routes..."
Wait-Ready -Url "$TeacherUrl/login"
$teacherLoginHtml = Get-RenderedHtml -BrowserPath $resolvedEdgePath -Url "$TeacherUrl/login"
Assert-Contains -Text $teacherLoginHtml -Needle "Teacher sign in" -Label "Teacher login page"
$teacherDashboardHtml = Get-RenderedHtml -BrowserPath $resolvedEdgePath -Url "$TeacherUrl/dashboard"
Assert-Contains -Text $teacherDashboardHtml -Needle "Teacher sign in" -Label "Teacher dashboard redirect"

Write-Host "Checking student portal routes..."
Wait-Ready -Url "$StudentUrl/login"
$studentLoginHtml = Get-RenderedHtml -BrowserPath $resolvedEdgePath -Url "$StudentUrl/login"
Assert-Contains -Text $studentLoginHtml -Needle "Welcome back" -Label "Student login page"
$studentDashboardHtml = Get-RenderedHtml -BrowserPath $resolvedEdgePath -Url "$StudentUrl/dashboard"
Assert-Contains -Text $studentDashboardHtml -Needle "Welcome back" -Label "Student dashboard redirect"

Write-Host "Checking student register -> login flow..."
$stamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$registerBody = @{
  username = "smoke_student_$stamp"
  email = "smoke_student_$stamp@example.com"
  password = "SmokePwd123!"
  fullName = "Smoke Student $stamp"
} | ConvertTo-Json

$registerResp = Get-Json -Url "$BackendUrl/api/auth/register" -Method "POST" -Body $registerBody
if (-not $registerResp.data.accessToken) {
  throw "Register response did not contain accessToken"
}

$loginBody = @{
  email = "smoke_student_$stamp@example.com"
  password = "SmokePwd123!"
} | ConvertTo-Json
$loginResp = Get-Json -Url "$BackendUrl/api/auth/login" -Method "POST" -Body $loginBody
if (-not $loginResp.data.accessToken) {
  throw "Login response did not contain accessToken"
}

Write-Host "Smoke browser test (teacher/student + backend local) passed."
