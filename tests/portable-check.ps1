param([string]$PackagePath=(Join-Path $PSScriptRoot '..\dist\GPTDragonPet-1.1-portable-x64.zip'))
$ErrorActionPreference='Stop'
$projectRoot=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$packageFile=(Resolve-Path -LiteralPath $PackagePath).Path
$checkRoot=Join-Path $projectRoot ('_build\portable-check-'+[guid]::NewGuid().ToString('N'))
Expand-Archive -LiteralPath $packageFile -DestinationPath $checkRoot
$inventory=Get-Content -LiteralPath (Join-Path $checkRoot 'package-manifest.json') -Raw | ConvertFrom-Json
foreach($entry in $inventory){
 if($entry.path -match '(?i)(\.cmo3$|\.psd$|settings\.json$|\.env$|\.log$|\.git/|tools/|tests/)'){throw ('Unexpected development/user file '+$entry.path)}
 $item=Join-Path $checkRoot $entry.path
 if(-not (Test-Path -LiteralPath $item)){throw ('Missing packaged file '+$entry.path)}
 if((Get-FileHash -LiteralPath $item -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.sha256){throw ('Package hash mismatch '+$entry.path)}
}
New-Item -ItemType Directory -Path (Join-Path $checkRoot 'tests') | Out-Null
$electronExe=Join-Path $checkRoot 'live2d\runtime\node_modules\electron\dist\electron.exe'
$runtimePath=Join-Path $checkRoot 'live2d\runtime'
$env:ELECTRON_RUN_AS_NODE=$null
foreach($mode in @('multiview','placement')){
 $info=New-Object Diagnostics.ProcessStartInfo
 $info.FileName=$electronExe
 $info.Arguments='"'+$runtimePath+'" --'+$mode+'-check'
 $info.UseShellExecute=$false
 $info.CreateNoWindow=$true
 $info.WindowStyle=[Diagnostics.ProcessWindowStyle]::Hidden
 $info.EnvironmentVariables.Remove('ELECTRON_RUN_AS_NODE')
 $checkProcess=[Diagnostics.Process]::Start($info)
 if(-not $checkProcess.WaitForExit(30000)){$checkProcess.Kill();throw ('Packaged '+$mode+' timeout')}
 if($checkProcess.ExitCode -ne 0){throw ('Packaged '+$mode+' failed: '+$checkProcess.ExitCode)}
 $result=Get-Content -LiteralPath (Join-Path $checkRoot ('tests\live2d-'+$mode+'.json')) -Raw | ConvertFrom-Json
 if(-not $result.ok){throw ('Packaged '+$mode+' report failed')}
}
[ordered]@{ok=$true;files=@($inventory).Count;packageSha256=(Get-FileHash -LiteralPath $packageFile -Algorithm SHA256).Hash.ToLowerInvariant();multiview=$true;placement=$true;apiCalls=0} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $projectRoot 'dist\portable-check.json') -Encoding utf8
Write-Output ('PASS portable package: '+@($inventory).Count+' file hashes, native models, action queue and desktop placement')
