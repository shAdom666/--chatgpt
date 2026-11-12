$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$frameworkRoot = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319'
$compilerPath = Join-Path $frameworkRoot 'csc.exe'
$wpfRoot = Join-Path $frameworkRoot 'WPF'
& (Join-Path $projectRoot 'tools\compile_shader.ps1')
$refs = @('System.dll', 'System.Core.dll', 'System.Net.Http.dll', 'System.Security.dll', 'System.Web.Extensions.dll', 'System.Xaml.dll', 'System.Windows.Forms.dll', 'System.Drawing.dll') | ForEach-Object { '/r:' + (Join-Path $frameworkRoot $_) }
$refs += @('WindowsBase.dll', 'PresentationCore.dll', 'PresentationFramework.dll') | ForEach-Object { '/r:' + (Join-Path $wpfRoot $_) }
& $compilerPath /nologo /utf8output /target:winexe /optimize+ ('/win32manifest:' + (Join-Path $projectRoot 'src\app.manifest')) ('/win32icon:' + (Join-Path $projectRoot 'assets\pet.ico')) ('/out:' + (Join-Path $projectRoot 'GPTPet.exe')) @refs (Join-Path $projectRoot 'src\Core.cs') (Join-Path $projectRoot 'src\Dynamics.cs') (Join-Path $projectRoot 'src\DragonSurface.cs') (Join-Path $projectRoot 'src\App.cs')
if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
& $compilerPath /nologo /utf8output /target:exe ('/out:' + (Join-Path $projectRoot 'tests\CoreTests.exe')) @refs (Join-Path $projectRoot 'src\Core.cs') (Join-Path $projectRoot 'tests\CoreTests.cs')
if ($LASTEXITCODE -ne 0) { throw 'Test build failed' }
& $compilerPath /nologo /utf8output /target:exe ('/out:' + (Join-Path $projectRoot 'tests\MotionTests.exe')) (Join-Path $projectRoot 'src\Dynamics.cs') (Join-Path $projectRoot 'tests\MotionTests.cs')
if ($LASTEXITCODE -ne 0) { throw 'Motion test build failed' }
& $compilerPath /nologo /utf8output /target:winexe ('/win32manifest:' + (Join-Path $projectRoot 'src\app.manifest')) ('/out:' + (Join-Path $projectRoot 'GPTPetWalkCheck.exe')) @refs ('/r:' + (Join-Path $projectRoot 'GPTPet.exe')) (Join-Path $projectRoot 'tests\WalkSmoke.cs')
if ($LASTEXITCODE -ne 0) { throw 'Window movement test build failed' }
Copy-Item -LiteralPath (Join-Path $projectRoot 'GPTPet.exe.config') -Destination (Join-Path $projectRoot 'GPTPetWalkCheck.exe.config')
Write-Output 'Build complete: GPTPet.exe'
