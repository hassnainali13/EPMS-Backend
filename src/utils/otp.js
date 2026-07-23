import crypto from "crypto";
import bcrypt from "bcryptjs";

export function generateOtp() {
  return crypto.randomInt(100000, 1000000);
}

export async function hashOtp(otp) {
  return bcrypt.hash(String(otp), 10);
}

export async function compareOtpHash(otp, hash) {
  return bcrypt.compare(String(otp), hash);
}

export function isOtpExpired(expiresAt) {
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() <= Date.now();
}
