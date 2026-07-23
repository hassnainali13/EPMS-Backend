import test from "node:test";
import assert from "node:assert/strict";
import {
  generateOtp,
  hashOtp,
  compareOtpHash,
  isOtpExpired,
} from "../src/utils/otp.js";

test("generateOtp returns a six-digit code", () => {
  const otp = generateOtp();
  assert.equal(String(otp).length, 6);
  assert.match(String(otp), /^\d{6}$/);
});

test("hashOtp and compareOtpHash verify the same code", async () => {
  const otp = "123456";
  const hash = await hashOtp(otp);
  const isMatch = await compareOtpHash(otp, hash);
  assert.equal(isMatch, true);
});

test("isOtpExpired checks expiry timestamps", () => {
  const expired = isOtpExpired(Date.now() - 1000);
  const active = isOtpExpired(Date.now() + 60_000);
  assert.equal(expired, true);
  assert.equal(active, false);
});
