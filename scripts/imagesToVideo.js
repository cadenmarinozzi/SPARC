import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import unzipper from "unzipper";
import { fileURLToPath } from "url";

// __dirname replacement in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get ZIP path from argv
const zipPath = process.argv[2];
if (!zipPath) {
  console.error("Usage: node zipToMov.js <path_to_zip>");
  process.exit(1);
}

const tempDir = path.join(__dirname, "temp_images");
const outputMov = path.join(__dirname, "output.mov");

// Create temp folder
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

// Extract ZIP
const extractZip = async () => {
  return new Promise((resolve, reject) => {
    fs.createReadStream(zipPath)
      .pipe(unzipper.Extract({ path: tempDir }))
      .on("close", resolve)
      .on("error", reject);
  });
};

// Recursively find image files and return absolute paths
function getImagesRecursively(dir) {
  let results = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      results = results.concat(getImagesRecursively(fullPath));
    } else if (/\.(png|jpe?g)$/i.test(item.name)) {
      results.push(fullPath); // full path of file
    }
  }
  return results.sort();
}

const processImages = async () => {
  await extractZip();
  console.log("ZIP extracted successfully");

  // Read images
  let images = getImagesRecursively(tempDir);

  if (images.length === 0) {
    console.error("No images found in ZIP.");
    process.exit(1);
  }

  // Rename sequentially
  images.forEach((imgPath, i) => {
    const ext = path.extname(imgPath);
    const newName = `frame${i.toString().padStart(4, "0")}${ext}`;
    const newPath = path.join(tempDir, newName); // move all images directly under tempDir
    fs.renameSync(imgPath, newPath);
  });

  const firstExt = path.extname(images[0]);
  const inputPattern = path.join(tempDir, `frame%04d${firstExt}`);

  // Run FFmpeg to MOV
  ffmpeg(inputPattern)
    .outputOptions(["-c:v prores_ks", "-profile:v 3", "-pix_fmt yuv422p10le"])
    .on("start", (cmd) => console.log("FFmpeg started:", cmd))
    .on("error", (err) => console.error("FFmpeg error:", err))
    .on("end", () => {
      console.log("MOV created successfully at", outputMov);
      fs.rmSync(tempDir, { recursive: true, force: true });
    })
    .save(outputMov);
};

processImages().catch((err) => console.error("Error:", err));
