import express from "express";
import { authenticate, requireUser, authorize } from "../middleware/auth.js";
import {
  listInstallations,
  createInstallation,
  updateInstallation,
  deleteInstallation,
} from "../controllers/installationController.js";

const router = express.Router();

router.get("/", authenticate, requireUser, listInstallations);
router.post(
  "/",
  authenticate,
  requireUser,
  authorize("company_admin", "employee"),
  createInstallation,
);
router.put(
  "/:id",
  authenticate,
  requireUser,
  authorize("company_admin", "employee"),
  updateInstallation,
);
router.delete(
  "/:id",
  authenticate,
  requireUser,
  authorize("company_admin", "employee"),
  deleteInstallation,
);

export default router;
