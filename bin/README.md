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

The executables are intentionally ignored by Git because of their size. The build script verifies the selected directory and copies its contents into the platform package. If the selected directory is empty or a checksum is wrong, `prepare:tools` downloads the exact assets declared by that target's GitHub Release manifest and verifies their SHA-256 first. Unix binaries must have executable permission.

Record the source, version, license, and SHA-256 for release binaries using `manifest.example.json` as the template. Do not mix binaries from different operating systems or CPU architectures.

For a release-backed target, add a `release` object with the repository and tag, plus an `asset` name under each tool. Release assets should use the exact filenames expected by the target.
