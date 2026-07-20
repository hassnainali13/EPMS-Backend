import dotenv from "dotenv";
import cloudinary from "cloudinary";

dotenv.config();

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function testUpload() {
  try {
    console.log("Cloudinary config:", {
      cloud: process.env.CLOUDINARY_CLOUD_NAME ? "set" : "not-set",
      key: process.env.CLOUDINARY_API_KEY ? "set" : "not-set",
    });
    const res = await cloudinary.v2.uploader.upload(
      "https://via.placeholder.com/150",
      { folder: "epms/test" },
    );
    console.log("Upload result:", res.secure_url);
  } catch (err) {
    console.error("Cloudinary upload failed:", err);
  }
}

testUpload();
