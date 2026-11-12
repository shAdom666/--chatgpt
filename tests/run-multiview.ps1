$ErrorActionPreference='Stop'
$projectRoot=Split-Path -Parent $PSScriptRoot
$electronExe=Join-Path $projectRoot 'live2d\runtime\node_modules\electron\dist\electron.exe'
$env:ELECTRON_RUN_AS_NODE=$null
foreach($name in @('sideview-render','posture-render')){
  $testFile=Join-Path $PSScriptRoot ($name+'.cjs')
  $info=New-Object Diagnostics.ProcessStartInfo
  $info.FileName=$electronExe
  $info.Arguments='"'+$testFile+'"'
  $info.UseShellExecute=$false
  $info.CreateNoWindow=$true
  $info.WindowStyle=[Diagnostics.ProcessWindowStyle]::Hidden
  $info.EnvironmentVariables.Remove('ELECTRON_RUN_AS_NODE')
  $testProcess=[Diagnostics.Process]::Start($info)
  if(-not $testProcess.WaitForExit(45000)){$testProcess.Kill();throw ($name+' timeout')}
  if($testProcess.ExitCode -ne 0){throw ($name+' failed: '+$testProcess.ExitCode)}
  $report=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($name+'.json')) -Raw | ConvertFrom-Json
  if(-not $report.ok){throw ($name+' report failed')}
  Write-Output ('PASS '+$name)
}
