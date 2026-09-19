# yt-dlp-downloader

To install dependencies:

```bash
bun install
```

To run:

```bash
bun dev
```

This project was created using `bun create tui`. [create-tui](https://git.new/create-tui) is the easiest way to get started with OpenTUI.



```text
-t mp3                          -f 'ba[acodec^=mp3]/ba/b' -x --audio-format
                                mp3

-t aac                          -f
                                'ba[acodec^=aac]/ba[acodec^=mp4a.40.]/ba/b'
                                -x --audio-format aac

-t mp4                          --merge-output-format mp4 --remux-video mp4
                                -S vcodec:h264,lang,quality,res,fps,hdr:12,a
                                codec:aac

-t mkv                          --merge-output-format mkv --remux-video mkv

-t sleep                        --sleep-subtitles 5 --sleep-requests 0.75
                                --sleep-interval 10 --max-sleep-interval 20
```

yt-dlp https://www.bilibili.com/video/BV1yq4k6wEU7/?vd_source=03e8776c2b36f6f8873e0a65ad1e4633 --merge-output-format mp4 --remux-video mp4 -S vcodec:h264,lang,quality,res,fps,height:720,hdr:12,acodec:aac

yt-dlp https://www.bilibili.com/video/BV1yq4k6wEU7/?vd_source=03e8776c2b36f6f8873e0a65ad1e4633 -t mp4 
https://www.bilibili.com/video/BV1yq4k6wEU7/?vd_source=03e8776c2b36f6f8873e0a65ad1e4633


yt-dlp https://www.bilibili.com/video/BV175hzzNESY/?spm_id_from=333.337.search-card.all.click&vd_source=03e8776c2b36f6f8873e0a65ad1e4633 -t mp4 --embed-chapters 

yt-dlp --cookies-from-browser chrome https://www.bilibili.com/video/BV175hzzNESY/\?spm_id_from\=333.337.search-card.all.click\&vd_source\=03e8776c2b36f6f8873e0a65ad1e4633 -t mp4 --write-auto-subs --sub-langs en -S res:360 --embed-subs
