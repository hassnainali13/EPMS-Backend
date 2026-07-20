import express from "express";
import { authenticate, requireUser } from "../middleware/auth.js";
import {
  signup,
  login,
  refresh,
  getCurrentUser,
  logout,
} from "../controllers/authController.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/refresh", refresh);
router.get("/me", authenticate, requireUser, getCurrentUser);
router.post("/logout", authenticate, logout);

export default router;
