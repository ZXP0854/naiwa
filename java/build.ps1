param(
    [switch]$Deploy
)

$ErrorActionPreference = "Stop"

# Java Web build: compile Servlet + JDBC backend and package a deployable WAR
# Usage:  powershell -ExecutionPolicy Bypass -File build.ps1            (build only)
#         powershell -ExecutionPolicy Bypass -File build.ps1 -Deploy   (build + copy to Tomcat)

$javaDir   = $PSScriptRoot
$root      = Split-Path -Parent $javaDir
$tomcat    = "E:\apache-tomcat-9.0.95"
$servletJar = Join-Path $tomcat "lib\servlet-api.jar"
$mysqlJar  = Join-Path $javaDir "lib\mysql-connector-j-8.4.0.jar"
$submitDir = "E:\大三上\java web技术\提交作业"
$warName   = "naiwa-student-system.war"

$buildDir  = Join-Path $javaDir "build"
$classDir  = Join-Path $buildDir "classes"
$stageDir  = Join-Path $buildDir "war"

Write-Host "[1/5] cleaning" -ForegroundColor Cyan
if (Test-Path $buildDir) { Remove-Item $buildDir -Recurse -Force }
New-Item -ItemType Directory -Path $classDir -Force | Out-Null
New-Item -ItemType Directory -Path $stageDir -Force | Out-Null

Write-Host "[2/5] compiling java sources" -ForegroundColor Cyan
$sources = Get-ChildItem (Join-Path $javaDir "src\naiwa\*.java") | ForEach-Object { $_.FullName }
& javac -encoding UTF-8 -cp $servletJar -d $classDir $sources
if ($LASTEXITCODE -ne 0) { throw "javac failed" }

Write-Host "[3/5] assembling webapp" -ForegroundColor Cyan
foreach ($f in @("index.html", "majors.html", "college.html", "students.html", "anthem.html", "admin.html")) {
    Copy-Item (Join-Path $root $f) (Join-Path $stageDir $f)
}
foreach ($d in @("css", "js", "assets")) {
    Copy-Item (Join-Path $root $d) (Join-Path $stageDir $d) -Recurse
}

$webInf = Join-Path $stageDir "WEB-INF"
New-Item -ItemType Directory -Path $webInf -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $webInf "classes\naiwa") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $webInf "classes\data") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $webInf "lib") -Force | Out-Null

Copy-Item (Join-Path $javaDir "web\WEB-INF\web.xml") (Join-Path $webInf "web.xml")
Copy-Item (Join-Path $classDir "naiwa\*.class") (Join-Path $webInf "classes\naiwa")
Copy-Item (Join-Path $root "data\seed_students.json") (Join-Path $webInf "classes\data")
Copy-Item (Join-Path $root "data\majors.json") (Join-Path $webInf "classes\data")
Copy-Item $mysqlJar (Join-Path $webInf "lib")
Copy-Item (Join-Path $javaDir "lib\h2-2.2.224.jar") (Join-Path $webInf "lib") -ErrorAction SilentlyContinue

Write-Host "[4/5] packaging war" -ForegroundColor Cyan
if (-not (Test-Path $submitDir)) { New-Item -ItemType Directory -Path $submitDir -Force | Out-Null }
$warOut = Join-Path $submitDir $warName
if (Test-Path $warOut) { Remove-Item $warOut -Force }

# 用 python 的 zipfile 打包，确保条目使用正斜杠（jar 工具在部分环境下会漏打包目录）
python (Join-Path $javaDir "pack_war.py") "$stageDir" "$warOut"
if ($LASTEXITCODE -ne 0) { throw "packaging failed" }
Write-Host ("    -> " + $warOut + "  " + [math]::Round((Get-Item $warOut).Length / 1MB, 2) + " MB")

Write-Host "[5/5] done" -ForegroundColor Green
Get-ChildItem $submitDir | Select-Object Name, @{n = "MB"; e = { [math]::Round($_.Length / 1MB, 2) } } | Format-Table -AutoSize

if ($Deploy) {
    Write-Host "deploying to Tomcat..." -ForegroundColor Cyan
    $target = Join-Path $tomcat "webapps\naiwa.war"
    if (Test-Path $target) { Remove-Item $target -Force }
    $exploded = Join-Path $tomcat "webapps\naiwa"
    if (Test-Path $exploded) { Remove-Item $exploded -Recurse -Force }
    Copy-Item $warOut $target
    Write-Host "    -> $target"
}
