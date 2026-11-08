# 打包交作业：生成可直接解压运行的压缩包（自动排除密码、本机数据、缓存）
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$out  = Join-Path (Split-Path -Parent $root) "奶蛙大学-学生信息管理系统.zip"

if (Test-Path $out) { Remove-Item $out -Force }

Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::Open($out, "Create")

$skipDirs  = @("__pycache__", "部分网页实例图片", ".git")
$skipFiles = @("admin.key", "config.local.json", "naiwa.db", ".env")

Get-ChildItem -Path $root -Recurse -File | ForEach-Object {
    $rel   = $_.FullName.Substring($root.Length + 1)
    $parts = $rel.Split("\")
    $skip  = $false
    foreach ($d in $parts) { if ($skipDirs -contains $d) { $skip = $true } }
    if ($skipFiles -contains $_.Name) { $skip = $true }
    if ($_.Extension -eq ".pyc") { $skip = $true }
    if (-not $skip) {
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $rel, "Optimal") | Out-Null
    }
}

$zip.Dispose()
Write-Host "打包完成：$out"
Write-Host "解压后双击 启动网站.bat 即可运行；第一次打开 /admin.html 时设置管理密码。"
