import express from "express";
import { authenticate, requireUser, authorize } from "../middleware/auth.js";
import {
  listPanels,
  lookupPanel,
  completeInstallation,
  generatePanelId,
  createPanel,
  updatePanel,
  deletePanel,
  generateQr,
  publicPanel,
} from "../controllers/panelController.js";

const router = express.Router();

// admin / authenticated routes
router.get("/", authenticate, requireUser, listPanels);
router.get("/lookup/:panelId", authenticate, requireUser, lookupPanel);
router.get("/generate-id", authenticate, requireUser, generatePanelId);
router.post(
  "/:id/generate-qr",
  authenticate,
  requireUser,
  authorize("company_admin"),
  generateQr,
);
router.put("/complete-installation/:panelId", completeInstallation);
router.post(
  "/",
  authenticate,
  requireUser,
  authorize("company_admin", "employee", "super_admin"),
  createPanel,
);
router.put(
  "/:id",
  authenticate,
  requireUser,
  authorize("company_admin"),
  updatePanel,
);
router.delete(
  "/:id",
  authenticate,
  requireUser,
  authorize("company_admin"),
  deletePanel,
);

// public unauthenticated route
router.get("/public/:panelId", publicPanel);

export default router;
