$ErrorActionPreference = 'Stop'
$frameworkPath = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319'
$compileReferences = @('System.dll','System.Core.dll','System.Net.Http.dll','System.Security.dll','System.Web.Extensions.dll') | ForEach-Object { '/r:' + (Join-Path $frameworkPath $_) }
& (Join-Path $frameworkPath 'csc.exe') /nologo /utf8output /target:exe /optimize+ ('/out:'+(Join-Path $PSScriptRoot 'GptBridge.exe')) @compileReferences (Join-Path $PSScriptRoot 'src\Core.cs') (Join-Path $PSScriptRoot 'src\GptBridge.cs')
if ($LASTEXITCODE -ne 0) { throw 'GPT bridge build failed' }
Write-Output 'Live2D GPT bridge compiled'
