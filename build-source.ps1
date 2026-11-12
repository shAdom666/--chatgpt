param([string]$Destination=(Join-Path $PSScriptRoot '..\GPTDragonPet-1.1-source.zip'))
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$sourceRoot=$PSScriptRoot
$destinationPath=[IO.Path]::GetFullPath($Destination)
$archiveStream=[IO.File]::Open($destinationPath,[IO.FileMode]::Create)
$archive=New-Object IO.Compression.ZipArchive($archiveStream,[IO.Compression.ZipArchiveMode]::Create)
$skipDirs=@('.git','node_modules','third_party','_build','dist','.side-render-profile','.posture-render-profile','.codex-attachments','.vs','.vscode')
$count=0
function Add-SourceDirectory([string]$Directory){
 foreach($item in Get-ChildItem -LiteralPath $Directory -Force){
  if($item.PSIsContainer){if($skipDirs -notcontains $item.Name){Add-SourceDirectory $item.FullName};continue}
  $relative=$item.FullName.Substring($sourceRoot.Length+1).Replace('\','/')
  if($item.Name -match '(^\.env|^(local\.)?settings\.json$|\.(log|bak|tmp|pem|key|user|suo)$|\.repaired\.cmo3$|^GPTPetWalkCheck\.exe|^CoreTests\.exe$|^MotionTests\.exe$)'){continue}
  if($relative -match '^tests/(live2d-(?!neutral\.fixture)[^/]+\.json|sideview-render\.json|posture-render\.json)$'){continue}
  if($item.Extension -eq '.cmo3' -and $item.Length -lt 10000){throw ('Editable model may be a Git LFS pointer; fetch the original first: '+$relative)}
  $null=[IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive,$item.FullName,$relative,[IO.Compression.CompressionLevel]::Optimal)
  $script:count++
 }
}
try{Add-SourceDirectory $sourceRoot}finally{$archive.Dispose();$archiveStream.Dispose()}
((Get-FileHash -LiteralPath $destinationPath -Algorithm SHA256).Hash.ToLowerInvariant()+'  '+[IO.Path]::GetFileName($destinationPath)) | Set-Content -LiteralPath ($destinationPath+'.sha256') -Encoding ascii
Write-Output ('Source archive created: '+$count+' files; '+$destinationPath)
