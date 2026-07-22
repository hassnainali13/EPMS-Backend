import express from "express";
import { authenticate, requireUser, authorize } from "../middleware/auth.js";
import {
  listDiagrams,
  createDiagram,
  updateDiagram,
  deleteDiagram,
} from "../controllers/diagramController.js";

const router = express.Router();

router.get("/", authenticate, requireUser, listDiagrams);
router.post(
  "/",
  authenticate,
  requireUser,
  authorize("company_admin", "employee", "super_admin"),
  createDiagram,
);
router.put(
  "/:id",
  authenticate,
  requireUser,
  authorize("company_admin", "employee", "super_admin"),
  updateDiagram,
);
router.delete(
  "/:id",
  authenticate,
  requireUser,
  authorize("company_admin", "employee", "super_admin"),
  deleteDiagram,
);

export default router;
