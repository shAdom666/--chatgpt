param([string]$ModelPath)
$ErrorActionPreference='Stop'
$root=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
if(-not $ModelPath){$ModelPath=Join-Path $root 'live2d\model\GPTDragon.natural.cmo3'}
$model=(Resolve-Path -LiteralPath $ModelPath).Path
$editorRoot=Join-Path $root 'tools\Cubism'
$start=New-Object System.Diagnostics.ProcessStartInfo
$start.FileName=Join-Path $editorRoot 'app\jre\bin\java.exe'
$start.WorkingDirectory=$editorRoot
# Use the same official app and libraries as CubismEditor5.bat, with a bounded
# Java heap so its default 100%-of-RAM growth cannot exhaust system commit.
$start.Arguments='-Xms128m -Xmx2048m -classpath "app\lib\*;app\lib\jogl\*" "-Djava.library.path=app\dll64;app\dll64\windows-amd64" -Djogamp.gluegen.UseTempJarCache=false -Dsun.java2d.d3d=false -Duser.language=zh -Djava.locale.providers=COMPAT,SPI com.live2d.cubism.CECubismEditorApp "'+$model+'"'
$start.UseShellExecute=$false
$start.CreateNoWindow=$true
$start.WindowStyle=[System.Diagnostics.ProcessWindowStyle]::Normal
$process=[System.Diagnostics.Process]::Start($start)
'Started official Cubism Editor with a 2 GB heap: '+$process.Id
