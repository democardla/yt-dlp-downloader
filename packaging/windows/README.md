# Windows package

The Windows portable build is a console-subsystem Bun executable placed next to a flat `bin` directory. Double-clicking the executable creates a terminal window in which OpenTUI renders normally.

## Build the installer

Install Inno Setup 6, then run:

```powershell
bun run build:installer:windows
```

The script builds the Windows application, removes the portable data marker, and generates `dist/installers/YT-DLP-Downloader-Setup-<version>.exe`. The installer includes the complete application directory and creates a Start Menu shortcut. Desktop shortcut creation is optional during installation.

If Inno Setup is installed in a custom location, set `INNO_SETUP_COMPILER` to the full path of `ISCC.exe`.

Installed copies do not include `portable.flag`, so configuration and download history are stored in `%APPDATA%\YT-DLP Downloader`. Uninstalling keeps that user data.
