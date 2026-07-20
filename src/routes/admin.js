import express from "express";
import { authenticate, requireUser, authorize } from "../middleware/auth.js";
import {
  getOverview,
  updateUser,
  updateSubscriptionPrice,
} from "../controllers/adminController.js";

const router = express.Router();

router.get(
  "/overview",
  authenticate,
  requireUser,
  authorize("super_admin", "company_admin"),
  getOverview,
);

router.patch(
  "/users/:id",
  authenticate,
  requireUser,
  authorize("super_admin"),
  updateUser,
);

router.patch(
  "/subscription-price",
  authenticate,
  requireUser,
  authorize("super_admin"),
  updateSubscriptionPrice,
);

export default router;
