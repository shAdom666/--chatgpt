$ErrorActionPreference = 'Stop'
$runtimePath = Join-Path $PSScriptRoot 'live2d\runtime'
$runtimeExecutable = Join-Path $runtimePath 'node_modules\electron\dist\electron.exe'
$modelManifestPath = Join-Path $PSScriptRoot 'live2d\model\GPTDragon.model3.json'
if (-not (Test-Path -LiteralPath $modelManifestPath)) { throw 'Live2D 运行模型尚未从 Cubism 正式导出。请先完成 GPTDragon.model3.json 与 moc3、纹理、物理文件的导出。' }
if (-not (Test-Path -LiteralPath $runtimeExecutable)) { throw 'Electron 运行环境未准备好。' }
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'GptBridge.exe'))) { & (Join-Path $PSScriptRoot 'build-live2d.ps1') }
$startInfo = New-Object System.Diagnostics.ProcessStartInfo
$startInfo.FileName = $runtimeExecutable
$startInfo.Arguments = '"'+$runtimePath+'"'
$startInfo.WorkingDirectory = $runtimePath
$startInfo.UseShellExecute = $false
$startInfo.EnvironmentVariables.Remove('ELECTRON_RUN_AS_NODE')
[System.Diagnostics.Process]::Start($startInfo) | Out-Null
