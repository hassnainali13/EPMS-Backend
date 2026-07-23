import User from "../models/User.js";
import {
  generateOtp,
  hashOtp,
  compareOtpHash,
  isOtpExpired,
} from "../utils/otp.js";
import {
  sendVerificationOtpEmail,
  sendForgotPasswordOtpEmail,
} from "./emailService.js";

const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

function getOtpExpiry() {
  return new Date(Date.now() + OTP_TTL_MS);
}

function getRemainingCooldown(user, requestedAtField) {
  const requestedAt = user[requestedAtField];
  if (!requestedAt) return 0;
  const elapsed = Date.now() - new Date(requestedAt).getTime();
  return Math.max(0, Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000));
}

async function issueOtp(user, type, emailSender) {
  const otp = generateOtp();
  const otpHash = await hashOtp(otp);
  const expiresAt = getOtpExpiry();
  const requestedAtField = `${type}OTPRequestedAt`;

  user[`${type}OTPHash`] = otpHash;
  user[`${type}OTPExpiresAt`] = expiresAt;
  user[requestedAtField] = new Date();
  if (type === "verification") {
    user.isEmailVerified = false;
  }
  await user.save();

  await emailSender(user.email, otp);
  return otp;
}

export async function sendVerificationOtp(user) {
  const remaining = getRemainingCooldown(user, "verificationOTPRequestedAt");
  if (remaining > 0) {
    throw new Error(
      `Please wait ${remaining} seconds before requesting a new OTP`,
    );
  }

  return issueOtp(user, "verification", sendVerificationOtpEmail);
}

export async function sendForgotPasswordOtp(email) {
  const user = await User.findOne({ email });
  if (!user) throw new Error("Email not found");

  const remaining = getRemainingCooldown(user, "forgotPasswordOTPRequestedAt");
  if (remaining > 0) {
    throw new Error(
      `Please wait ${remaining} seconds before requesting a new OTP`,
    );
  }

  return issueOtp(user, "forgotPassword", sendForgotPasswordOtpEmail);
}

export async function verifyOtp(user, otp, field) {
  const hashField = `${field}OTPHash`;
  const expiryField = `${field}OTPExpiresAt`;
  const requestedAtField = `${field}OTPRequestedAt`;
  const otpHash = user[hashField];
  const expiresAt = user[expiryField];

  if (!otpHash || !expiresAt) {
    throw new Error("No OTP found");
  }

  if (isOtpExpired(expiresAt)) {
    throw new Error("OTP has expired");
  }

  const isMatch = await compareOtpHash(otp, otpHash);
  if (!isMatch) {
    throw new Error("Invalid OTP");
  }

  user[hashField] = undefined;
  user[expiryField] = undefined;
  user[requestedAtField] = undefined;
  await user.save();
}

export async function verifyEmail(user, otp) {
  if (user.isEmailVerified) {
    throw new Error("Email already verified");
  }

  await verifyOtp(user, otp, "verification");
  user.isEmailVerified = true;
  await user.save();
  return user;
}

export async function resetPassword(user, otp, newPassword) {
  await verifyOtp(user, otp, "forgotPassword");
  user.password = newPassword;
  await user.save();
}

export async function verifyForgotPasswordOtp(user, otp) {
  await verifyOtp(user, otp, "forgotPassword");
}
