#ifndef PayloadDir
  #error PayloadDir must be supplied by build-installer.ps1
#endif
#ifndef OutputFolder
  #error OutputFolder must be supplied by build-installer.ps1
#endif
#define PetVersion "1.1"

[Setup]
AppId={{2A7D71DF-13CB-4E14-B665-421C58AC6078}
AppName=龙娘桌宠 Live2D
AppVersion={#PetVersion}
VersionInfoVersion=1.1.0.0
AppVerName=龙娘桌宠 Live2D {#PetVersion}
VersionInfoDescription=龙娘桌宠 Live2D 安装程序
DefaultDirName={localappdata}\Programs\GPTDragonPet
DefaultGroupName=龙娘桌宠 Live2D
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0.19041
WizardStyle=modern
SetupIconFile={#PayloadDir}\assets\pet.ico
UninstallDisplayIcon={app}\assets\pet.ico
UninstallDisplayName=龙娘桌宠 Live2D
OutputDir={#OutputFolder}
OutputBaseFilename=GPTDragonPet-Setup-{#PetVersion}-x64
Compression=lzma2
SolidCompression=yes
LZMANumBlockThreads=2
CloseApplications=yes
RestartApplications=no
SetupLogging=yes
InfoBeforeFile=安装须知.txt
DisableWelcomePage=no
UsePreviousTasks=yes

[Languages]
Name: "chinesesimplified"; MessagesFile: "compiler:Languages\ChineseSimplified.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "创建桌面快捷方式"; GroupDescription: "快捷方式："

[Files]
Source: "{#PayloadDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\龙娘桌宠 Live2D"; Filename: "{app}\GPTPet.exe"; WorkingDir: "{app}"; IconFilename: "{app}\assets\pet.ico"
Name: "{group}\和 GPT 聊天"; Filename: "{app}\GPTPet.exe"; Parameters: "--chat"; WorkingDir: "{app}"; IconFilename: "{app}\assets\pet.ico"
Name: "{group}\使用说明"; Filename: "{app}\使用说明.txt"
Name: "{group}\卸载龙娘桌宠"; Filename: "{uninstallexe}"
Name: "{autodesktop}\龙娘桌宠 Live2D"; Filename: "{app}\GPTPet.exe"; WorkingDir: "{app}"; IconFilename: "{app}\assets\pet.ico"; Tasks: desktopicon

[Run]
Filename: "{app}\GPTPet.exe"; Description: "启动龙娘桌宠"; WorkingDir: "{app}"; Flags: nowait postinstall skipifsilent

[Code]
function InitializeSetup(): Boolean;
var
  Release: Cardinal;
begin
  Result := RegQueryDWordValue(HKLM, 'SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full', 'Release', Release);
  if Result then Result := Release >= 528040;
  if not Result then
    MsgBox('桌宠需要 Microsoft .NET Framework 4.8 或更新版本。请先安装该运行环境，再运行安装包。', mbError, MB_OK);
end;
