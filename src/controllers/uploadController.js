import multer from "multer";
import cloudinary from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

const upload = multer({ storage: multer.memoryStorage() });

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export { upload };

export async function uploadImage(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "File is required." });
    }

    await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.v2.uploader.upload_stream(
        { resource_type: "image", folder: "epms/panels" },
        (error, result) => {
          if (error) return reject(error);
          res.json({ url: result.secure_url, publicId: result.public_id });
          resolve(result);
        },
      );
      uploadStream.end(req.file.buffer);
    });
  } catch (error) {
    console.error("Uploads error:", error);
    res.status(500).json({ error: error.message });
  }
}

export async function uploadDocument(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: "File is required." });

    await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.v2.uploader.upload_stream(
        { resource_type: "auto", folder: "epms/panels/documents" },
        (error, result) => {
          if (error) return reject(error);
          res.json({ url: result.secure_url });
          resolve(result);
        },
      );
      uploadStream.end(req.file.buffer);
    });
  } catch (error) {
    console.error("Uploads error:", error);
    res.status(500).json({ error: error.message });
  }
}
