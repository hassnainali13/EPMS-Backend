import jwt from "jsonwebtoken";
import Company from "../models/Company.js";
import User from "../models/User.js";
import {
  sendVerificationOtp,
  sendForgotPasswordOtp,
  verifyEmail as verifyEmailOtp,
  verifyForgotPasswordOtp as verifyForgotPasswordOtpService,
  resetPassword,
} from "../services/otpService.js";

function createToken(user) {
  return jwt.sign(
    { id: user._id.toString(), email: user.email, role: user.role },
    process.env.JWT_SECRET || "dev-secret",
    { expiresIn: "30d" },
  );
}

function createRefreshToken(user) {
  return jwt.sign(
    { id: user._id.toString() },
    process.env.JWT_REFRESH_SECRET || "dev-refresh-secret",
    { expiresIn: "7d" },
  );
}

function buildUserResponse(user) {
  const company = user?.company || null;
  return {
    id: user?._id || null,
    name: user?.name || "",
    email: user?.email || "",
    role: user?.role || "",
    plan: user?.plan || "FREE",
    blocked: Boolean(user?.blocked),
    isEmailVerified: user?.isEmailVerified ?? true,
    company: company?._id || company || null,
    companyName: company?.name || "",
    companyLogoUrl: company?.logoUrl || "",
  };
}

function hasVerificationOtpState(user) {
  return Boolean(
    user?.verificationOTPHash ||
    user?.verificationOTPExpiresAt ||
    user?.verificationOTPRequestedAt,
  );
}

export async function signup(req, res) {
  try {
    const rawName = req.body.name;
    const rawEmail = req.body.email;
    const rawCompanyName = req.body.companyName || req.body.company;
    const rawCompanyLogoUrl = req.body.companyLogoUrl;
    const password = req.body.password;

    const name = typeof rawName === "string" ? rawName.trim() : "";
    const email =
      typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
    const companyName =
      typeof rawCompanyName === "string" ? rawCompanyName.trim() : "My Company";
    const companyLogoUrl =
      typeof rawCompanyLogoUrl === "string" ? rawCompanyLogoUrl.trim() : "";

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required.",
      });
    }

    if (String(password).length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters.",
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "A user with this email already exists.",
      });
    }

    const existingCompany = await Company.findOne({ email });
    if (existingCompany) {
      return res.status(409).json({
        success: false,
        message: "A company with this email already exists.",
      });
    }

    const slugBase = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    let company;
    let user;
    let emailDeliveryPending = false;

    try {
      company = await Company.create({
        name: companyName,
        email,
        logoUrl: companyLogoUrl || undefined,
        slug: `${slugBase || "company"}-${Date.now()}`,
      });
    } catch (error) {
      if (error?.code === 11000) {
        return res.status(409).json({
          success: false,
          message: "A company with this email already exists.",
        });
      }
      console.error("Company creation failed:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to create company at this time.",
      });
    }

    try {
      user = await User.create({
        name,
        email,
        password,
        role: "company_admin",
        company: company._id,
        companyId: company._id,
        isEmailVerified: false,
      });
    } catch (error) {
      if (company?._id) {
        await Company.findByIdAndDelete(company._id).catch(() => {});
      }

      if (error?.code === 11000) {
        return res.status(409).json({
          success: false,
          message: "A user with this email already exists.",
        });
      }
      console.error("User creation failed:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to create user account at this time.",
      });
    }

    try {
      await sendVerificationOtp(user);
    } catch (error) {
      const message = error?.message || "";
      const isEmailIssue =
        message.includes("SMTP") ||
        message.includes("sendMail") ||
        message.includes("Failed to send") ||
        message.includes("email");

      if (isEmailIssue) {
        emailDeliveryPending = true;
        console.warn(
          "Verification email could not be delivered. Keeping signup pending.",
          message,
        );
      } else {
        console.error("OTP generation or send failed:", error);
        return res.status(500).json({
          success: false,
          message: "Unable to generate or send verification code.",
        });
      }
    }

    const responseUser = user ? buildUserResponse(user) : null;
    return res.status(201).json({
      success: true,
      ok: true,
      requiresEmailVerification: true,
      message: emailDeliveryPending
        ? "Account created successfully. Verification email could not be delivered. Please resend OTP."
        : "Account created successfully. Please verify your email.",
      emailDeliveryPending,
      user: responseUser,
    });
  } catch (error) {
    console.error("Signup error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create account.",
    });
  }
}

export async function login(req, res) {
  try {
    const rawEmail = req.body.email;
    const { password } = req.body;
    const email =
      typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await User.findOne({ email }).populate("company");
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    if (user.blocked)
      return res.status(403).json({ error: "Account is suspended" });

    const matched = await user.comparePassword(password);
    if (!matched) return res.status(401).json({ error: "Invalid credentials" });

    const isVerified = user.isEmailVerified ?? true;
    const hasOtpState = hasVerificationOtpState(user);

    if (!isVerified && hasOtpState) {
      return res.status(403).json({
        error: "Please verify your email before logging in.",
        requiresVerification: true,
        email,
        message: "Please verify your email before logging in.",
      });
    }

    if (!isVerified) {
      user.isEmailVerified = true;
      user.verificationOTPHash = null;
      user.verificationOTPExpiresAt = null;
      user.verificationOTPRequestedAt = null;
      await user.save();
    }

    const token = createToken(user);
    const refreshToken = createRefreshToken(user);
    return res.json({
      token,
      refreshToken,
      user: buildUserResponse(user),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function verifyEmail(req, res) {
  try {
    const rawEmail = req.body.email;
    const { otp } = req.body;
    const email =
      typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";

    if (!email || !otp) {
      return res.status(400).json({ error: "Email and OTP are required" });
    }

    const user = await User.findOne({ email }).populate("company");
    if (!user) return res.status(404).json({ error: "User not found" });

    const verifiedUser = await verifyEmailOtp(user, otp);
    const token = createToken(verifiedUser);
    const refreshToken = createRefreshToken(verifiedUser);

    return res.json({
      ok: true,
      message: "Email verified successfully.",
      token,
      refreshToken,
      user: buildUserResponse(verifiedUser),
    });
  } catch (error) {
    if (error.message === "Email already verified") {
      return res.status(400).json({ error: error.message });
    }
    if (error.message === "OTP has expired") {
      return res.status(400).json({ error: "OTP has expired" });
    }
    if (error.message === "Invalid OTP") {
      return res.status(400).json({ error: "Invalid OTP" });
    }
    if (error.message === "No OTP found") {
      return res.status(400).json({ error: "No OTP found" });
    }
    res.status(500).json({ error: error.message || "Failed to verify email" });
  }
}

export async function resendOtp(req, res) {
  try {
    const rawEmail = req.body.email;
    const email =
      typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.isEmailVerified) {
      return res.status(400).json({ error: "Email already verified" });
    }

    let emailDeliveryPending = false;
    try {
      await sendVerificationOtp(user);
    } catch (error) {
      if (error.message?.includes("Please wait")) {
        return res.status(429).json({ error: error.message });
      }
      if (
        error.message?.includes("SMTP") ||
        error.message?.includes("email") ||
        error?.code === "EAUTH"
      ) {
        emailDeliveryPending = true;
        console.warn(
          "Verification resend email could not be delivered.",
          error.message,
        );
      } else {
        return res
          .status(500)
          .json({ error: error.message || "Failed to resend OTP" });
      }
    }

    return res.json({
      ok: true,
      message: emailDeliveryPending
        ? "Verification code could not be delivered right now. Please try again later."
        : "Verification code resent successfully.",
      emailDeliveryPending,
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to resend OTP" });
  }
}

export async function forgotPassword(req, res) {
  try {
    const rawEmail = req.body.email;
    const email =
      typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";

    if (!email) return res.status(400).json({ error: "Email is required" });

    let emailDeliveryPending = false;
    try {
      await sendForgotPasswordOtp(email);
    } catch (error) {
      if (error.message === "Email not found") {
        return res.status(404).json({ error: error.message });
      }
      if (error.message?.includes("Please wait")) {
        return res.status(429).json({ error: error.message });
      }
      if (
        error.message?.includes("SMTP") ||
        error.message?.includes("email") ||
        error?.code === "EAUTH"
      ) {
        emailDeliveryPending = true;
        console.warn(
          "Password reset email could not be delivered.",
          error.message,
        );
      } else {
        return res
          .status(500)
          .json({ error: error.message || "Failed to send reset email" });
      }
    }

    return res.json({
      ok: true,
      message: emailDeliveryPending
        ? "Password reset code could not be delivered right now. Please try again later."
        : "Password reset code sent successfully.",
      emailDeliveryPending,
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: error.message || "Failed to send reset email" });
  }
}

export async function verifyForgotPasswordOtp(req, res) {
  try {
    const rawEmail = req.body.email;
    const { otp } = req.body;
    const email =
      typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";

    if (!email || !otp) {
      return res.status(400).json({ error: "Email and OTP are required" });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });

    await verifyForgotPasswordOtpService(user, otp);
    return res.json({ ok: true, message: "OTP verified successfully." });
  } catch (error) {
    if (error.message === "OTP has expired") {
      return res.status(400).json({ error: "OTP has expired" });
    }
    if (error.message === "Invalid OTP") {
      return res.status(400).json({ error: "Invalid OTP" });
    }
    if (error.message === "No OTP found") {
      return res.status(400).json({ error: "No OTP found" });
    }
    res.status(500).json({ error: error.message || "Failed to verify OTP" });
  }
}

export async function resetPasswordHandler(req, res) {
  try {
    const rawEmail = req.body.email;
    const { otp, newPassword } = req.body;
    const email =
      typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";

    if (!email || !otp || !newPassword) {
      return res
        .status(400)
        .json({ error: "Email, OTP and new password are required" });
    }

    if (String(newPassword).length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters" });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });

    await resetPassword(user, otp, newPassword);
    return res.json({ ok: true, message: "Password reset successfully." });
  } catch (error) {
    if (error.message === "OTP has expired") {
      return res.status(400).json({ error: "OTP has expired" });
    }
    if (error.message === "Invalid OTP") {
      return res.status(400).json({ error: "Invalid OTP" });
    }
    if (error.message === "No OTP found") {
      return res.status(400).json({ error: "No OTP found" });
    }
    res
      .status(500)
      .json({ error: error.message || "Failed to reset password" });
  }
}

export async function refresh(req, res) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: "Refresh token is required" });
    }
    const payload = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || "dev-refresh-secret",
    );
    const user = await User.findById(payload.id);
    if (!user) return res.status(401).json({ error: "Invalid refresh token" });
    const token = createToken(user);
    return res.json({ token });
  } catch (error) {
    return res.status(401).json({ error: "Invalid refresh token" });
  }
}

export async function getCurrentUser(req, res) {
  const safeUser = {
    id: req.authUser._id,
    name: req.authUser.name,
    email: req.authUser.email,
    role: req.authUser.role,
    plan: req.authUser.plan,
    blocked: req.authUser.blocked,
    isEmailVerified: Boolean(req.authUser.isEmailVerified),
    company: req.authUser.company?._id || req.authUser.company,
    companyName: req.authUser.company?.name || "",
    companyLogoUrl: req.authUser.company?.logoUrl || "",
    createdAt: req.authUser.createdAt,
  };
  res.json({ user: safeUser });
}

export function logout(_req, res) {
  res.json({ ok: true });
}
