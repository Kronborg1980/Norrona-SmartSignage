`test-video.mp4` is a generated 32×32 navy H.264 clip without audio, used only for upload/selection tests. It contains no third-party media.

Generated with:

```sh
ffmpeg -f lavfi -i color=c=navy:s=32x32:d=0.3 -c:v libx264 -pix_fmt yuv420p -movflags +faststart -an test-video.mp4
```
