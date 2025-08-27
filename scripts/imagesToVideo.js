import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import unzipper from "unzipper";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputPath = process.argv[2];
const outputPath = process.argv[3] || "output.mov";
const framerate = parseInt(process.argv[4]) || 30;

if (!inputPath) {
  console.error(
    "Usage: node imagesToVideo.js <input_path> <output_path> <framerate>"
  );
  process.exit(1);
}

const tempDir = path.join(__dirname, "temp_images");
const outputMov = path.join(__dirname, outputPath);

// Create temp folder if it doesn't exist
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

function extractZip() {
  return new Promise((resolve, reject) => {
    fs.createReadStream(inputPath)
      .pipe(unzipper.Parse())
      .on("entry", (entry) => {
        const fileName = entry.path;
        const type = entry.type; // 'Directory' or 'File'
        const fullPath = path.join(tempDir, fileName);

        if (type === "Directory") {
          fs.mkdirSync(fullPath, { recursive: true });
          entry.autodrain();
        } else {
          fs.mkdirSync(path.dirname(fullPath), { recursive: true });
          entry.pipe(fs.createWriteStream(fullPath));
        }
      })
      .on("close", resolve)
      .on("error", reject);
  });
}

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
  try {
    await extractZip();
    console.log("ZIP extracted successfully");

    const images = getImagesRecursively(tempDir);

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

    ffmpeg(inputPattern)
      .outputOptions([
        "-c:v prores_ks",
        "-profile:v 3",
        "-pix_fmt yuv422p10le",
        `-r ${framerate}`,
      ])
      .on("start", (cmd) => console.log("FFmpeg started:", cmd))
      .on("error", (err) => console.error("FFmpeg error:", err))
      .on("end", () => {
        console.log("MOV created successfully at", outputMov);
        fs.rmSync(tempDir, { recursive: true, force: true });
      })
      .save(outputMov);
  } catch (err) {
    console.error(err);
  }
};

processImages();
