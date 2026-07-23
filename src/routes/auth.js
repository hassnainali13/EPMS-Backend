import express from "express";
import { authenticate, requireUser } from "../middleware/auth.js";
import {
  signup,
  login,
  verifyEmail,
  resendOtp,
  forgotPassword,
  verifyForgotPasswordOtp,
  resetPasswordHandler,
  refresh,
  getCurrentUser,
  logout,
} from "../controllers/authController.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/verify-email", verifyEmail);
router.post("/resend-otp", resendOtp);
router.post("/forgot-password", forgotPassword);
router.post("/verify-forgot-password-otp", verifyForgotPasswordOtp);
router.post("/reset-password", resetPasswordHandler);
router.post("/login", login);
router.post("/refresh", refresh);
router.get("/me", authenticate, requireUser, getCurrentUser);
router.post("/logout", authenticate, logout);

export default router;
