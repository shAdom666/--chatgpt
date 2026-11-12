param([string]$CompilerPath=(Join-Path $PSScriptRoot 'tools\InnoSetup\ISCC.exe'),[switch]$PortableOnly,[switch]$FixPreview)
$ErrorActionPreference='Stop'
if($FixPreview -and -not $PortableOnly){throw 'FixPreview is a portable test build. Supply -PortableOnly.'}
$projectRoot=$PSScriptRoot
if(-not $PortableOnly -and -not (Test-Path -LiteralPath $CompilerPath)){throw 'Inno Setup compiler missing. Supply -CompilerPath with a local ISCC.exe path, or use -PortableOnly.'}
# A fresh stage avoids accidentally shipping authoring files, caches or user data.
$stageRoot=Join-Path $projectRoot ('_build\installer-'+[guid]::NewGuid().ToString('N'))
$payloadRoot=Join-Path $stageRoot 'payload'
$outputRoot=Join-Path $projectRoot 'dist'
New-Item -ItemType Directory -Path $payloadRoot,$outputRoot -Force | Out-Null
function Copy-Payload([string]$Source,[string]$Relative){
  $destination=Join-Path $payloadRoot $Relative
  New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
  Copy-Item -LiteralPath (Join-Path $projectRoot $Source) -Destination $destination -Force
}
foreach($file in @('GPTPet.exe','GPTPet.exe.config','GptBridge.exe')){Copy-Payload $file $file}
Copy-Payload 'assets\pet.ico' 'assets\pet.ico'
Copy-Payload 'assets\NOTICE.md' 'assets\NOTICE.md'
Copy-Payload 'installer\使用说明.txt' '使用说明.txt'
Copy-Payload 'installer\THIRD-PARTY-NOTICES.txt' 'THIRD-PARTY-NOTICES.txt'
Copy-Payload 'live2d\model\StretchyStudio-LICENSE.txt' 'licenses\StretchyStudio-LICENSE.txt'
Copy-Payload 'live2d\runtime\node_modules\pixi.js\LICENSE' 'licenses\PixiJS-LICENSE.txt'
Copy-Payload 'live2d\runtime\node_modules\pixi-live2d-display\LICENSE' 'licenses\Pixi-Live2D-Display-LICENSE.txt'
Copy-Payload 'installer\licenses\Live2D-proprietary-software-license.html' 'licenses\Live2D-proprietary-software-license.html'
$runtimeFiles=@('main.cjs','preload.cjs','desktop.cjs','walker.cjs','motions.js','model-clock.js','side-motion.js','sideviews.js','postures.js','rig-audit.js','pet.js','pet.html','chat.html','chat.css','chat.js','package.json')
foreach($file in $runtimeFiles){Copy-Payload ('live2d\runtime\'+$file) ('live2d\runtime\'+$file)}
foreach($file in @('vendor\live2dcubismcore.min.js','node_modules\pixi.js\dist\browser\pixi.min.js','node_modules\pixi-live2d-display\dist\cubism4.min.js')){
  Copy-Payload ('live2d\runtime\'+$file) ('live2d\runtime\'+$file)
}
$electronSource=Join-Path $projectRoot 'live2d\runtime\node_modules\electron\dist'
$electronTarget=Join-Path $payloadRoot 'live2d\runtime\node_modules\electron\dist'
New-Item -ItemType Directory -Path $electronTarget -Force | Out-Null
Get-ChildItem -LiteralPath $electronSource -File | Where-Object {$_.Extension -ne '.log'} | ForEach-Object {Copy-Item -LiteralPath $_.FullName -Destination $electronTarget}
foreach($folder in @('locales','resources')){Copy-Item -LiteralPath (Join-Path $electronSource $folder) -Destination (Join-Path $electronTarget $folder) -Recurse}
$manifest=Get-Content -LiteralPath (Join-Path $projectRoot 'live2d\model\GPTDragon.model3.json') -Raw | ConvertFrom-Json
Copy-Payload 'live2d\model\GPTDragon.model3.json' 'live2d\model\GPTDragon.model3.json'
$modelFiles=@($manifest.FileReferences.Moc,$manifest.FileReferences.Physics,$manifest.FileReferences.DisplayInfo,$manifest.FileReferences.UserData)+@($manifest.FileReferences.Textures)
foreach($file in $modelFiles){
  if([string]::IsNullOrWhiteSpace($file)){continue}
  $modelBase=[IO.Path]::GetFullPath((Join-Path $projectRoot 'live2d\model'))+[IO.Path]::DirectorySeparatorChar
  $modelFile=[IO.Path]::GetFullPath((Join-Path $modelBase $file))
  if(-not $modelFile.StartsWith($modelBase,[StringComparison]::OrdinalIgnoreCase)){throw 'Model reference escapes model directory'}
  Copy-Payload ('live2d\model\'+$file) ('live2d\model\'+$file)
}
# Inventory enables exact post-install verification without copying local settings.
foreach($side in @('left','right')){
  Copy-Payload ('live2d\model\sideviews\turn-'+$side+'.png') ('live2d\model\sideviews\turn-'+$side+'.png')
  $relative='sideviews\GPTDragon-side-'+$side+'.model3.json'
  $sidePath=Join-Path $projectRoot ('live2d\model\'+$relative)
  if(-not (Test-Path -LiteralPath $sidePath)){throw ('Side-view model export missing: '+$relative)}
  $sideManifest=Get-Content -LiteralPath $sidePath -Raw | ConvertFrom-Json
  Copy-Payload ('live2d\model\'+$relative) ('live2d\model\'+$relative)
  $sideBase=[IO.Path]::GetFullPath((Split-Path -Parent $sidePath))+[IO.Path]::DirectorySeparatorChar
  foreach($sideFile in (@($sideManifest.FileReferences.Moc,$sideManifest.FileReferences.DisplayInfo)+@($sideManifest.FileReferences.Textures))){
    if([string]::IsNullOrWhiteSpace($sideFile)){continue}
    $resolvedSideFile=[IO.Path]::GetFullPath((Join-Path $sideBase $sideFile))
    if(-not $resolvedSideFile.StartsWith($sideBase,[StringComparison]::OrdinalIgnoreCase)){throw 'Side model reference escapes model directory'}
    Copy-Payload ('live2d\model\sideviews\'+$sideFile) ('live2d\model\sideviews\'+$sideFile)
  }
}
Copy-Payload 'live2d\model\postures-repair\bounds.json' 'live2d\model\postures-repair\bounds.json'
$poseRelative='postures-repair\GPTDragon-postures.model3.json'
$posePath=Join-Path $projectRoot ('live2d\model\'+$poseRelative)
$poseManifest=Get-Content -LiteralPath $posePath -Raw | ConvertFrom-Json
Copy-Payload ('live2d\model\'+$poseRelative) ('live2d\model\'+$poseRelative)
$poseBase=[IO.Path]::GetFullPath((Split-Path -Parent $posePath))+[IO.Path]::DirectorySeparatorChar
foreach($poseFile in (@($poseManifest.FileReferences.Moc,$poseManifest.FileReferences.DisplayInfo,$poseManifest.FileReferences.UserData)+@($poseManifest.FileReferences.Textures))){
  if([string]::IsNullOrWhiteSpace($poseFile)){continue}
  $resolvedPoseFile=[IO.Path]::GetFullPath((Join-Path $poseBase $poseFile))
  if(-not $resolvedPoseFile.StartsWith($poseBase,[StringComparison]::OrdinalIgnoreCase)){throw 'Pose model reference escapes model directory'}
  Copy-Payload ('live2d\model\postures-repair\'+$poseFile) ('live2d\model\postures-repair\'+$poseFile)
}
$inventory=@(Get-ChildItem -LiteralPath $payloadRoot -Recurse -File | ForEach-Object {
  [ordered]@{path=$_.FullName.Substring($payloadRoot.Length+1).Replace('\','/');bytes=$_.Length;sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()}
})
$inventory | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $payloadRoot 'package-manifest.json') -Encoding utf8
if($PortableOnly){
  $portableName=if($FixPreview){'GPTDragonPet-front-posture-fix-preview-x64.zip'}else{'GPTDragonPet-1.1-portable-x64.zip'}
  $portablePath=Join-Path $outputRoot $portableName
  Compress-Archive -LiteralPath (Get-ChildItem -LiteralPath $payloadRoot | ForEach-Object {$_.FullName}) -DestinationPath $portablePath -Force
  $portableHash=(Get-FileHash -LiteralPath $portablePath -Algorithm SHA256).Hash.ToLowerInvariant()
  ($portableHash+'  '+[IO.Path]::GetFileName($portablePath)) | Set-Content -LiteralPath ($portablePath+'.sha256') -Encoding ascii
  [ordered]@{portable=$portablePath;payload=$payloadRoot;files=$inventory.Count;sha256=$portableHash} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $outputRoot 'build-report.json') -Encoding utf8
  Get-Item -LiteralPath $portablePath | Select-Object FullName,Length
  return
}
& $CompilerPath ('/DPayloadDir='+$payloadRoot) ('/DOutputFolder='+$outputRoot) (Join-Path $projectRoot 'installer\GPTDragonPet.iss')
if($LASTEXITCODE -ne 0){throw 'Installer compiler failed'}
$installerPath=Join-Path $outputRoot 'GPTDragonPet-Setup-1.1-x64.exe'
$packageHash=(Get-FileHash -LiteralPath $installerPath -Algorithm SHA256).Hash.ToLowerInvariant()
($packageHash+'  '+[IO.Path]::GetFileName($installerPath)) | Set-Content -LiteralPath ($installerPath+'.sha256') -Encoding ascii
$unpackedBytes=0L
foreach($entry in $inventory){$unpackedBytes+=$entry['bytes']}
[ordered]@{installer=$installerPath;payload=$payloadRoot;files=$inventory.Count;unpackedBytes=$unpackedBytes;sha256=$packageHash} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $outputRoot 'build-report.json') -Encoding utf8
Get-Item -LiteralPath $installerPath | Select-Object FullName,Length
