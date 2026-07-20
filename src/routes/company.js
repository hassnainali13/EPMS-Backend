import express from "express";
import { authenticate, requireUser, authorize } from "../middleware/auth.js";
import { getCompany, updateCompany } from "../controllers/companyController.js";

const router = express.Router();

router.get("/", authenticate, requireUser, getCompany);
router.patch(
  "/",
  authenticate,
  requireUser,
  authorize("super_admin", "company_admin"),
  updateCompany,
);

export default router;
