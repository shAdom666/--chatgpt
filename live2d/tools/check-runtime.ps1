param([ValidateSet('rig','animation','showcase','placement','model','multiview')][string]$Mode='animation')
$ErrorActionPreference='Stop'
$root=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$runtime=Join-Path $root 'live2d\runtime'
$info=New-Object System.Diagnostics.ProcessStartInfo
$info.FileName=Join-Path $runtime 'node_modules\electron\dist\electron.exe'
$info.Arguments='"'+$runtime+'" --'+$Mode+'-check'
$info.WorkingDirectory=$runtime
$info.UseShellExecute=$false
$info.CreateNoWindow=$true
$info.WindowStyle=[System.Diagnostics.ProcessWindowStyle]::Hidden
$info.EnvironmentVariables.Remove('ELECTRON_RUN_AS_NODE')
$child=[System.Diagnostics.Process]::Start($info)
$timeout=if($Mode -eq 'showcase'){58000}else{30000}
if(-not $child.WaitForExit($timeout)){throw ('Runtime check did not finish within '+($timeout/1000)+' seconds')}
if($child.ExitCode -ne 0){throw ('Runtime '+$Mode+' check failed: '+$child.ExitCode)}
$name=if($Mode -eq 'model'){'runtime'}else{$Mode}
$reportPath=Join-Path $root ('tests\live2d-'+$name+'.json')
$report=Get-Content -LiteralPath $reportPath -Raw | ConvertFrom-Json
if($Mode -eq 'rig'){'Rig audit completed: '+@($report.parameters).Count+' parameters'}
else{$report | Select-Object ok,drawableCount,parameterCount,frames,seconds,actual,rightGap,bottomGap,captureStats | ConvertTo-Json -Depth 5}
