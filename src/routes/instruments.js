import express from "express";
import { authenticate, requireUser, authorize } from "../middleware/auth.js";
import multer from "multer";
import {
  listInstruments,
  listPanelOptions,
  createInstrument,
  updateInstrument,
  deleteInstrument,
  importInstruments,
  aiImportInstruments,
} from "../controllers/instrumentController.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get(
  "/",
  authenticate,
  requireUser,
  authorize("super_admin"),
  listInstruments,
);
router.get(
  "/panel-options",
  authenticate,
  requireUser,
  authorize("super_admin", "company_admin"),
  listPanelOptions,
);
router.post(
  "/",
  authenticate,
  requireUser,
  authorize("super_admin"),
  createInstrument,
);
router.put(
  "/:id",
  authenticate,
  requireUser,
  authorize("super_admin"),
  updateInstrument,
);
router.delete(
  "/:id",
  authenticate,
  requireUser,
  authorize("super_admin"),
  deleteInstrument,
);
router.post(
  "/import",
  authenticate,
  requireUser,
  authorize("super_admin"),
  upload.single("file"),
  importInstruments,
);
router.post(
  "/ai-import",
  authenticate,
  requireUser,
  authorize("super_admin"),
  upload.single("file"),
  aiImportInstruments,
);
router.post(
  "/delete-all",
  authenticate,
  requireUser,
  authorize("super_admin"),
  async (req, res, next) => {
    // lazy require to avoid circular deps
    const { deleteAllInstruments } =
      await import("../controllers/instrumentController.js");
    return deleteAllInstruments(req, res, next);
  },
);

export default router;
