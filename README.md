# convert-images

A fast CLI tool to batch convert images to modern formats (WebP, AVIF, JPEG, PNG) with compression.

## Installation

```bash
npm install
```

For global usage:
```bash
npm link
```

## Usage

```bash
node convert-images.js [options]
```

Or if installed globally:
```bash
convert-images [options]
```

## Options

| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| `--input=<dir>` | `-i` | Input folder | `./` |
| `--output=<dir>` | `-o` | Output folder | `./converted` |
| `--format=<fmt>` | `-f` | Output format: `webp`, `avif`, `jpeg`, `png` | `webp` |
| `--quality=<num>` | `-q` | Quality 0-100 (ignored if lossless) | `75` |
| `--width=<px>` | `-w` | Resize width (aspect ratio maintained) | |
| `--height=<px>` | `-H` | Resize height (aspect ratio maintained) | |
| `--trim` | `-t` | Trim transparent padding from edges | `false` |
| `--lossless` | `-l` | Use lossless compression | `false` |
| `--recursive` | `-r` | Process subfolders | `false` |
| `--help` | `-h` | Show help | |

### URL Download Options

| Option | Description | Default |
|--------|-------------|---------|
| `--from-urls=<file>` | JSON file with URLs to download and convert | |
| `--skip-existing` | Skip files that already exist in the output folder | `false` |
| `--concurrency=<n>` | Max parallel downloads | `5` |
| `--retries=<n>` | Retry failed downloads N times | `3` |

## Supported Input Formats

JPG, JPEG, PNG, GIF, TIFF, BMP, AVIF, WebP

## Examples

Basic conversion (PNG to WebP):
```bash
node convert-images.js
```

Custom folders:
```bash
node convert-images.js -i=./photos -o=./compressed
```

Convert to AVIF with quality 80:
```bash
node convert-images.js --format=avif --quality=80
```

Lossless WebP:
```bash
node convert-images.js --lossless
```

Process subfolders:
```bash
node convert-images.js --recursive -i=./photos -o=./output
```

Create thumbnails (resize to 400px width):
```bash
node convert-images.js --width=400 -i=./photos -o=./thumbnails
```

Resize to fit within 800x600:
```bash
node convert-images.js -w=800 -H=600 -i=./photos -o=./resized
```

Trim transparent padding from logos:
```bash
node convert-images.js --trim -i=./logos -o=./trimmed
```

All options combined:
```bash
node convert-images.js -r -f=avif -q=70 -i=./photos -o=./compressed
```

### Download from URLs

Create a JSON file with URLs and output names:
```json
[
  {"url": "https://example.com/image1.jpg", "name": "image-1"},
  {"url": "https://example.com/image2.jpg", "name": "image-2"}
]
```

Download, convert, and optimize in one pass:
```bash
convert-images --from-urls urls.json -o ./output --format=webp --quality=75
```

Skip already downloaded files:
```bash
convert-images --from-urls urls.json -o ./output --format=webp --skip-existing
```

Control concurrency and retries:
```bash
convert-images --from-urls urls.json -o ./output --concurrency=10 --retries=5
```

## Output

The tool displays progress and compression stats:

```
Converting 7 image(s) to WEBP (lossy, quality: 75)...

✓ photo1.png → photo1.webp (66.0% smaller)
✓ photo2.jpg → photo2.webp (45.2% smaller)
✓ photo3.png → photo3.webp (78.3% smaller)

Done! 3 converted, 0 failed.

Total: 5.20 MB → 1.85 MB (64.4% smaller)
```

When using `--from-urls`, a JSON manifest is printed at the end:

```
Downloading and converting 3 image(s) to WEBP (concurrency: 5, retries: 3)...

✓ image-1 → image-1.webp (4.2 KB)
✓ image-2 → image-2.webp (9.5 KB)
✗ image-3 — download failed: HTTP 404 Not Found

Done! 2 succeeded, 1 failed.

Manifest:
{
  "succeeded": ["image-1.webp", "image-2.webp"],
  "failed": [{"name": "image-3", "error": "HTTP 404 Not Found"}]
}
```

## License

ISC
