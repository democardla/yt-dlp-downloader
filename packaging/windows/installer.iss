; YT-DLP Downloader Windows installer
; Build with scripts/build-installer.ts so the application payload is staged
; from the target-specific directory build.

#ifndef AppVersion
  #define AppVersion "0.1.0"
#endif
#ifndef AppLabel
  #define AppLabel "0.1.0"
#endif
#ifndef AppPayload
  #define AppPayload "..\\..\\dist\\apps\\win32-x64\\YT-DLP-Downloader"
#endif
#ifndef AppOutputDir
  #define AppOutputDir "..\\..\\dist\\installers"
#endif

[Setup]
AppId={{B8A8E4E4-8E8C-4F1A-B1B6-5A7F4C7C1A42}
AppName=YT-DLP Downloader
AppVersion={#AppVersion}
AppVerName=YT-DLP Downloader {#AppLabel}
AppPublisher=democardla
AppPublisherURL=https://github.com/democardla/yt-dlp-downloader
AppSupportURL=https://github.com/democardla/yt-dlp-downloader
AppUpdatesURL=https://github.com/democardla/yt-dlp-downloader/releases
DefaultDirName={localappdata}\Programs\YT-DLP Downloader
DisableDirPage=no
DefaultGroupName=YT-DLP Downloader
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir={#AppOutputDir}
OutputBaseFilename=YT-DLP-Downloader-Setup-{#AppLabel}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayIcon={app}\YT-DLP-Downloader.exe
ChangesAssociations=no

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "创建桌面快捷方式"; GroupDescription: "附加快捷方式："; Flags: unchecked

[Files]
Source: "{#AppPayload}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "portable.flag"

[Icons]
Name: "{autoprograms}\YT-DLP Downloader"; Filename: "{app}\YT-DLP-Downloader.exe"; WorkingDir: "{app}"
Name: "{autodesktop}\YT-DLP Downloader"; Filename: "{app}\YT-DLP-Downloader.exe"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "{app}\YT-DLP-Downloader.exe"; Description: "启动 YT-DLP Downloader"; WorkingDir: "{app}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; User settings and download history are kept in %APPDATA% and are not
; removed by uninstall, so reinstalling does not lose user data.
Type: filesandordirs; Name: "{app}"
