import express from "express";
import {
  upload,
  uploadImage,
  uploadDocument,
} from "../controllers/uploadController.js";

const router = express.Router();

router.post("/image", upload.single("file"), uploadImage);
router.post("/document", upload.single("file"), uploadDocument);

export default router;
