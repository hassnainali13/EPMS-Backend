import express from "express";
import { authenticate, requireUser, authorize } from "../middleware/auth.js";
import {
  listMaintenances,
  createMaintenance,
  updateMaintenance,
  deleteMaintenance,
} from "../controllers/maintenanceController.js";

const router = express.Router();

router.get("/", authenticate, requireUser, listMaintenances);
router.post(
  "/",
  authenticate,
  requireUser,
  authorize("company_admin", "employee"),
  createMaintenance,
);
router.put(
  "/:id",
  authenticate,
  requireUser,
  authorize("company_admin", "employee"),
  updateMaintenance,
);
router.delete(
  "/:id",
  authenticate,
  requireUser,
  authorize("company_admin", "employee"),
  deleteMaintenance,
);

export default router;
