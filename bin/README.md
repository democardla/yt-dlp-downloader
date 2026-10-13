# Bundled tools

Place the standalone `ffmpeg`, `ffprobe`, and `yt-dlp` executables in the directory matching the release target:

```text
bin/
├── win32-x64/
│   ├── ffmpeg.exe
│   ├── ffprobe.exe
│   └── yt-dlp.exe
├── win32-arm64/
├── darwin-x64/
├── darwin-arm64/
├── linux-x64/
└── linux-arm64/
```

The executables are intentionally ignored by Git because of their size. The build script verifies the selected directory and copies its contents into the platform package. Unix binaries must have executable permission.

Record the source, version, license, and SHA-256 for release binaries using `manifest.example.json` as the template. Do not mix binaries from different operating systems or CPU architectures.
