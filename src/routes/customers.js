import express from "express";
import { authenticate, requireUser, authorize } from "../middleware/auth.js";
import {
  listCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from "../controllers/customerController.js";

const router = express.Router();

router.get("/", authenticate, requireUser, listCustomers);
router.post(
  "/",
  authenticate,
  requireUser,
  authorize("company_admin", "employee"),
  createCustomer,
);
router.put(
  "/:id",
  authenticate,
  requireUser,
  authorize("company_admin", "employee"),
  updateCustomer,
);
router.delete(
  "/:id",
  authenticate,
  requireUser,
  authorize("company_admin", "employee"),
  deleteCustomer,
);

export default router;
