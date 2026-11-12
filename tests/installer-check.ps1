param([string]$InstallerPath=(Join-Path $PSScriptRoot '..\dist\GPTDragonPet-Setup-1.0.0-x64.exe'))
$ErrorActionPreference='Stop'
$projectRoot=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$installer=(Resolve-Path -LiteralPath $InstallerPath).Path
$installRoot=Join-Path $projectRoot ('_build\install-check-'+[guid]::NewGuid().ToString('N'))
$uninstallKey='HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\{2A7D71DF-13CB-4E14-B665-421C58AC6078}_is1'
if(Test-Path -LiteralPath $uninstallKey){throw 'This app is already installed; refusing to replace its uninstall registration during validation.'}
$settingsPath=Join-Path $env:LOCALAPPDATA 'GPTDesktopPet\settings.json'
$settingsHash=if(Test-Path -LiteralPath $settingsPath){(Get-FileHash -LiteralPath $settingsPath).Hash}else{''}
function Assert-Check([bool]$Condition,[string]$Message){if(-not $Condition){throw $Message}}
function Run-Installer([string]$Phase){
  $log=Join-Path $projectRoot ('_build\installer-'+$Phase+'.log')
  $arguments='/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP- /NOICONS /TASKS="" /GROUP="GPTDragonPet Validation" /DIR="'+$installRoot+'" /LOG="'+$log+'"'
  $process=Start-Process -FilePath $installer -ArgumentList $arguments -PassThru -WindowStyle Hidden
  if(-not $process.WaitForExit(55000)){throw 'Installer did not finish within 55 seconds'}
  Assert-Check ($process.ExitCode -eq 0) ('Install failed: '+$process.ExitCode)
}
function Check-Payload {
  $inventory=Get-Content -LiteralPath (Join-Path $installRoot 'package-manifest.json') -Raw | ConvertFrom-Json
  foreach($entry in $inventory){
    $file=Join-Path $installRoot $entry.path
    Assert-Check (Test-Path -LiteralPath $file) ('Missing installed file: '+$entry.path)
    Assert-Check (((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash) -eq $entry.sha256) ('Installed file differs: '+$entry.path)
    Assert-Check ($entry.path -notmatch '(?i)(\.cmo3$|\.psd$|settings\.json$|\.env$|\.log$|\.git/|tools/|tests/)') ('Unexpected private/development file: '+$entry.path)
  }
  return $inventory.Count
}
$report=[ordered]@{ok=$false;installRoot=$installRoot}
$testElectron=$null
$sentinelCreated=$false
try {
  Run-Installer 'fresh'
  $report.installedFiles=Check-Payload
  Assert-Check (Test-Path -LiteralPath (Join-Path $installRoot 'unins000.exe')) 'Missing uninstaller'
  Assert-Check (Test-Path -LiteralPath $uninstallKey) 'Missing uninstall registration'
  $report.freshInstall=$true
  # An unknown user file must survive both update and uninstall.
  $sentinel=Join-Path $installRoot 'validation-user-file.txt'
  [IO.File]::WriteAllText($sentinel,'retain user files')
  $sentinelCreated=$true
  Run-Installer 'upgrade'
  $null=Check-Payload
  Assert-Check ((Get-Content -LiteralPath $sentinel -Raw) -eq 'retain user files') 'Update removed user file'
  $report.upgrade=$true
  New-Item -ItemType Directory -Path (Join-Path $installRoot 'tests') -Force | Out-Null
  $runtime=Join-Path $installRoot 'live2d\runtime'
  $info=New-Object System.Diagnostics.ProcessStartInfo
  $info.FileName=Join-Path $runtime 'node_modules\electron\dist\electron.exe'
  $info.Arguments='"'+$runtime+'" --model-check'
  $info.WorkingDirectory=$installRoot
  $info.UseShellExecute=$false
  $info.CreateNoWindow=$true
  $info.EnvironmentVariables.Remove('ELECTRON_RUN_AS_NODE')
  $testElectron=[Diagnostics.Process]::Start($info)
  if(-not $testElectron.WaitForExit(25000)){throw 'Installed model did not finish rendering validation'}
  Assert-Check ($testElectron.ExitCode -eq 0) ('Installed model failed: '+$testElectron.ExitCode)
  $render=Get-Content -LiteralPath (Join-Path $installRoot 'tests\live2d-runtime.json') -Raw | ConvertFrom-Json
  Assert-Check ($render.ok -and $render.vertexMotionVerified -and $render.physicsLoaded -and $render.parameterCount -eq 36 -and $render.render.visiblePixels -gt 5000) 'Installed render/animation failed'
  $report.render=[ordered]@{parameters=$render.parameterCount;drawables=$render.drawableCount;visiblePixels=$render.render.visiblePixels;vertexMotion=$render.vertexMotionVerified;physics=$render.physicsLoaded}
  $bridgeOutput='{"op":"config"}' | & (Join-Path $installRoot 'GptBridge.exe')
  $bridge=$bridgeOutput | ConvertFrom-Json
  Assert-Check ($bridge.ok -eq $true) 'Installed GPT bridge failed'
  $report.gptBridge=$true
}
catch {
  $report.error=$_.Exception.Message
  throw
}
finally {
  if($testElectron -and -not $testElectron.HasExited){$testElectron.Kill();$testElectron.WaitForExit()}
  $uninstaller=Join-Path $installRoot 'unins000.exe'
  if(Test-Path -LiteralPath $uninstaller){
    $uninstallLog=Join-Path $projectRoot '_build\installer-uninstall.log'
    $process=Start-Process -FilePath $uninstaller -ArgumentList ('/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /LOG="'+$uninstallLog+'"') -PassThru -WindowStyle Hidden
    if(-not $process.WaitForExit(20000)){throw 'Uninstall timed out'}
    Assert-Check ($process.ExitCode -eq 0) ('Uninstall failed: '+$process.ExitCode)
    Assert-Check (-not (Test-Path -LiteralPath (Join-Path $installRoot 'GPTPet.exe'))) 'Uninstall left application behind'
    Assert-Check (-not (Test-Path -LiteralPath $uninstallKey)) 'Uninstall registration was not removed'
    if($sentinelCreated){Assert-Check (Test-Path -LiteralPath (Join-Path $installRoot 'validation-user-file.txt')) 'Uninstall removed unknown user file'}
    $report.uninstall=$true
  }
  $settingsAfter=if(Test-Path -LiteralPath $settingsPath){(Get-FileHash -LiteralPath $settingsPath).Hash}else{''}
  Assert-Check ($settingsHash -eq $settingsAfter) 'Connection settings changed during install/uninstall'
  $report.settingsPreserved=$true
  $report.ok=$report.freshInstall -and $report.upgrade -and $report.gptBridge -and $report.uninstall -and $report.settingsPreserved
  $report | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $projectRoot 'dist\installer-check.json') -Encoding utf8
}
$report | ConvertTo-Json -Depth 5
