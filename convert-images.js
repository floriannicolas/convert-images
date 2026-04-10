#!/usr/bin/env node

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Supported image extensions
const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.tiff', '.bmp', '.avif', '.webp'];

// Supported output formats
const SUPPORTED_FORMATS = ['webp', 'avif', 'jpeg', 'png'];

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function parseArgs(args) {
  const options = {
    input: './',
    output: './converted',
    quality: 75,
    format: 'webp',
    width: null,
    height: null,
    lossless: false,
    recursive: false,
    trim: false,
    fromUrls: null,
    skipExisting: false,
    concurrency: 5,
    retries: 3,
    help: false
  };

  const positional = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '-h' || arg === '--help') {
      options.help = true;
    } else if (arg.startsWith('--input=') || arg.startsWith('-i=')) {
      options.input = arg.split('=')[1];
    } else if (arg.startsWith('--output=') || arg.startsWith('-o=')) {
      options.output = arg.split('=')[1];
    } else if (arg.startsWith('--quality=') || arg.startsWith('-q=')) {
      options.quality = parseInt(arg.split('=')[1]);
    } else if (arg === '-i' || arg === '--input') {
      options.input = args[++i];
    } else if (arg === '-o' || arg === '--output') {
      options.output = args[++i];
    } else if (arg === '-q' || arg === '--quality') {
      options.quality = parseInt(args[++i]);
    } else if (arg === '-l' || arg === '--lossless') {
      options.lossless = true;
    } else if (arg === '-r' || arg === '--recursive') {
      options.recursive = true;
    } else if (arg === '-t' || arg === '--trim') {
      options.trim = true;
    } else if (arg.startsWith('--format=') || arg.startsWith('-f=')) {
      options.format = arg.split('=')[1].toLowerCase();
    } else if (arg === '-f' || arg === '--format') {
      options.format = args[++i].toLowerCase();
    } else if (arg.startsWith('--width=') || arg.startsWith('-w=')) {
      options.width = parseInt(arg.split('=')[1]);
    } else if (arg === '-w' || arg === '--width') {
      options.width = parseInt(args[++i]);
    } else if (arg.startsWith('--height=') || arg.startsWith('-H=')) {
      options.height = parseInt(arg.split('=')[1]);
    } else if (arg === '-H' || arg === '--height') {
      options.height = parseInt(args[++i]);
    } else if (arg === '--from-urls' || arg === '--urls-file') {
      options.fromUrls = args[++i];
    } else if (arg.startsWith('--from-urls=') || arg.startsWith('--urls-file=')) {
      options.fromUrls = arg.split('=').slice(1).join('=');
    } else if (arg === '--skip-existing') {
      options.skipExisting = true;
    } else if (arg === '--concurrency') {
      options.concurrency = parseInt(args[++i]);
    } else if (arg.startsWith('--concurrency=')) {
      options.concurrency = parseInt(arg.split('=')[1]);
    } else if (arg === '--retries') {
      options.retries = parseInt(args[++i]);
    } else if (arg.startsWith('--retries=')) {
      options.retries = parseInt(arg.split('=')[1]);
    } else if (!arg.startsWith('-')) {
      positional.push(arg);
    }
  }

  // Support positional arguments for backward compatibility
  if (positional[0]) options.input = positional[0];
  if (positional[1]) options.output = positional[1];
  if (positional[2]) options.quality = parseInt(positional[2]);

  return options;
}

function showHelp() {
  console.log(`
Usage: node convert-images.js [options] [input] [output] [quality]

Options:
  -i, --input=<dir>       Input folder (default: ./)
  -o, --output=<dir>      Output folder (default: ./converted)
  -f, --format=<fmt>      Output format: webp, avif, jpeg, png (default: webp)
  -q, --quality=<num>     Quality 0-100 (default: 75, ignored if lossless)
  -w, --width=<px>        Resize width (maintains aspect ratio if height not set)
  -H, --height=<px>       Resize height (maintains aspect ratio if width not set)
  -t, --trim              Trim transparent padding from edges
  -l, --lossless          Use lossless compression (default: lossy)
  -r, --recursive         Process subfolders recursively
  -h, --help              Show this help message

URL download options:
  --from-urls=<file>      JSON file with URLs to download and convert
                          Format: [{"url": "...", "name": "output-name"}, ...]
  --skip-existing         Skip files that already exist in the output folder
  --concurrency=<n>       Max parallel downloads (default: 5)
  --retries=<n>           Retry failed downloads N times (default: 3)

Examples:
  node convert-images.js
  node convert-images.js ./photos ./converted
  node convert-images.js -i=./photos -o=./converted -q=70
  node convert-images.js --recursive --format=avif -i=./photos -o=./converted
  node convert-images.js --width=800 -i=./photos -o=./thumbnails
  node convert-images.js --from-urls urls.json -o ./output --format=webp -q=75
`);
}

function getImageFiles(dir, recursive, baseDir = dir) {
  const files = fs.readdirSync(dir);
  let images = [];

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory() && recursive) {
      images = images.concat(getImageFiles(filePath, recursive, baseDir));
    } else if (stat.isFile()) {
      const ext = path.extname(file).toLowerCase();
      if (SUPPORTED_EXTENSIONS.includes(ext)) {
        const relativePath = path.relative(baseDir, filePath);
        images.push({ filePath, relativePath });
      }
    }
  }

  return images;
}

async function convertImage(inputPath, outputPath, { format, quality, lossless, width, height, trim }) {
  try {
    const formatOptions = lossless ? { lossless: true } : { quality };
    let pipeline = sharp(inputPath);

    // Trim transparent padding before resize
    if (trim) {
      pipeline = pipeline.trim();
    }

    // Apply resize if width or height is specified
    if (width || height) {
      pipeline = pipeline.resize(width, height, { fit: 'inside', withoutEnlargement: true });
    }

    switch (format) {
      case 'avif':
        pipeline = pipeline.avif(formatOptions);
        break;
      case 'jpeg':
        pipeline = pipeline.jpeg({ quality });
        break;
      case 'png':
        pipeline = pipeline.png({ quality });
        break;
      case 'webp':
      default:
        pipeline = pipeline.webp(formatOptions);
        break;
    }

    await pipeline.toFile(outputPath);
    return true;
  } catch (error) {
    console.error(`Error converting ${inputPath}: ${error.message}`);
    return false;
  }
}

async function downloadImage(url, destPath, retries) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, { redirect: 'follow' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(destPath, buffer);
      return { success: true };
    } catch (error) {
      if (attempt < retries) {
        console.log(`  ⟳ Retry ${attempt}/${retries - 1} for ${url}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        return { success: false, error: error.message };
      }
    }
  }
}

async function processUrls(options) {
  const jsonContent = fs.readFileSync(options.fromUrls, 'utf-8');
  let entries;
  try {
    entries = JSON.parse(jsonContent);
  } catch {
    console.error(`Failed to parse JSON file "${options.fromUrls}".`);
    process.exit(1);
  }

  if (!Array.isArray(entries) || entries.length === 0) {
    console.error('URL file must contain a non-empty JSON array.');
    process.exit(1);
  }

  for (const entry of entries) {
    if (!entry.url || !entry.name) {
      console.error('Each entry must have "url" and "name" fields.');
      process.exit(1);
    }
  }

  if (!fs.existsSync(options.output)) {
    fs.mkdirSync(options.output, { recursive: true });
  }

  const ext = options.format === 'jpeg' ? 'jpg' : options.format;
  const manifest = { succeeded: [], failed: [] };

  console.log(`Downloading and converting ${entries.length} image(s) to ${options.format.toUpperCase()} (concurrency: ${options.concurrency}, retries: ${options.retries})...\n`);

  // Process in batches for concurrency control
  for (let i = 0; i < entries.length; i += options.concurrency) {
    const batch = entries.slice(i, i + options.concurrency);
    const results = await Promise.all(batch.map(async (entry) => {
      const outputFileName = `${entry.name}.${ext}`;
      const outputPath = path.join(options.output, outputFileName);

      if (options.skipExisting && fs.existsSync(outputPath)) {
        console.log(`⊘ ${entry.name} — skipped (already exists)`);
        manifest.succeeded.push(outputFileName);
        return;
      }

      const tempPath = path.join(options.output, `.tmp-${entry.name}-${Date.now()}`);
      const dlResult = await downloadImage(entry.url, tempPath, options.retries);

      if (!dlResult.success) {
        console.log(`✗ ${entry.name} — download failed: ${dlResult.error}`);
        manifest.failed.push({ name: entry.name, error: dlResult.error });
        return;
      }

      const success = await convertImage(tempPath, outputPath, options);

      // Clean up temp file
      try { fs.unlinkSync(tempPath); } catch {}

      if (success) {
        const outputStats = fs.statSync(outputPath);
        console.log(`✓ ${entry.name} → ${outputFileName} (${formatBytes(outputStats.size)})`);
        manifest.succeeded.push(outputFileName);
      } else {
        manifest.failed.push({ name: entry.name, error: 'conversion failed' });
      }
    }));
  }

  console.log(`\nDone! ${manifest.succeeded.length} succeeded, ${manifest.failed.length} failed.`);
  console.log('\nManifest:');
  console.log(JSON.stringify(manifest, null, 2));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  // Validate quality
  if (options.quality < 0 || options.quality > 100) {
    console.error('Quality must be between 0 and 100.');
    process.exit(1);
  }

  // Validate format
  if (!SUPPORTED_FORMATS.includes(options.format)) {
    console.error(`Unsupported format "${options.format}". Supported: ${SUPPORTED_FORMATS.join(', ')}`);
    process.exit(1);
  }

  // URL download mode
  if (options.fromUrls) {
    if (!fs.existsSync(options.fromUrls)) {
      console.error(`URL file "${options.fromUrls}" does not exist.`);
      process.exit(1);
    }
    return processUrls(options);
  }

  // Check if input folder exists
  if (!fs.existsSync(options.input)) {
    console.error(`Input folder "${options.input}" does not exist.`);
    process.exit(1);
  }

  // Create output folder if it doesn't exist
  if (!fs.existsSync(options.output)) {
    fs.mkdirSync(options.output, { recursive: true });
  }

  // Get all image files
  const imageFiles = getImageFiles(options.input, options.recursive);

  if (imageFiles.length === 0) {
    console.log('No supported images found in the input folder.');
    process.exit(0);
  }

  const modeInfo = options.lossless ? 'lossless' : `lossy, quality: ${options.quality}`;
  const resizeInfo = options.width || options.height
    ? `, resize: ${options.width || 'auto'}x${options.height || 'auto'}`
    : '';
  const trimInfo = options.trim ? ', trimmed' : '';
  const recursiveInfo = options.recursive ? ', recursive' : '';
  console.log(`Converting ${imageFiles.length} image(s) to ${options.format.toUpperCase()} (${modeInfo}${resizeInfo}${trimInfo}${recursiveInfo})...\n`);

  let successCount = 0;
  let failCount = 0;
  let totalInputSize = 0;
  let totalOutputSize = 0;

  for (const { filePath: inputPath, relativePath } of imageFiles) {
    const ext = options.format === 'jpeg' ? 'jpg' : options.format;
    const outputFileName = path.parse(relativePath).name + '.' + ext;
    const outputRelativeDir = path.dirname(relativePath);
    const outputDir = path.join(options.output, outputRelativeDir);
    const outputPath = path.join(outputDir, outputFileName);

    // Create subdirectory if needed
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const success = await convertImage(inputPath, outputPath, options);

    if (success) {
      const inputStats = fs.statSync(inputPath);
      const outputStats = fs.statSync(outputPath);
      const ratio = 1 - outputStats.size / inputStats.size;
      const sizeInfo = ratio >= 0
        ? `${(ratio * 100).toFixed(1)}% smaller`
        : `${(Math.abs(ratio) * 100).toFixed(1)}% larger`;

      totalInputSize += inputStats.size;
      totalOutputSize += outputStats.size;

      const displayInput = relativePath;
      const displayOutput = path.join(outputRelativeDir, outputFileName);
      console.log(`✓ ${displayInput} → ${displayOutput} (${sizeInfo})`);
      successCount++;
    } else {
      failCount++;
    }
  }

  console.log(`\nDone! ${successCount} converted, ${failCount} failed.`);

  if (successCount > 0) {
    const totalRatio = 1 - totalOutputSize / totalInputSize;
    const totalInfo = totalRatio >= 0
      ? `${(totalRatio * 100).toFixed(1)}% smaller`
      : `${(Math.abs(totalRatio) * 100).toFixed(1)}% larger`;
    console.log(`\nTotal: ${formatBytes(totalInputSize)} → ${formatBytes(totalOutputSize)} (${totalInfo})`);
  }
}

main();