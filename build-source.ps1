param([string]$Destination=(Join-Path $PSScriptRoot '..\GPTDragonPet-2.0-source.zip'))
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$sourceRoot=$PSScriptRoot
$destinationPath=[IO.Path]::GetFullPath($Destination)
# Only version-controlled files belong in the public source archive.
$previousEncoding=[Console]::OutputEncoding
try {
 [Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false)
 $paths=@(& git -C $sourceRoot -c core.quotepath=false ls-files --cached)
 if($LASTEXITCODE -ne 0 -or !$paths.Count){throw 'Cannot list version-controlled release files.'}
} finally { [Console]::OutputEncoding=$previousEncoding }
$archiveStream=[IO.File]::Open($destinationPath,[IO.FileMode]::Create)
$archive=New-Object IO.Compression.ZipArchive($archiveStream,[IO.Compression.ZipArchiveMode]::Create)
$count=0
try {
 foreach($relative in $paths){
  $item=Get-Item -LiteralPath (Join-Path $sourceRoot $relative)
  if($item.Extension -eq '.cmo3' -and $item.Length -lt 10000){throw ('Fetch the Git LFS model first: '+$relative)}
  $null=[IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive,$item.FullName,$relative,[IO.Compression.CompressionLevel]::Optimal)
  $count++
 }
} finally { $archive.Dispose(); $archiveStream.Dispose() }
((Get-FileHash -LiteralPath $destinationPath -Algorithm SHA256).Hash.ToLowerInvariant()+'  '+[IO.Path]::GetFileName($destinationPath)) | Set-Content -LiteralPath ($destinationPath+'.sha256') -Encoding ascii
Write-Output ('Source archive created: '+$count+' files; '+$destinationPath)
