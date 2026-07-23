import nodemailer from "nodemailer";
import {
  verificationEmailTemplate,
  forgotPasswordEmailTemplate,
} from "../templates/emailTemplates.js";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  }, 
}); 

async function sendMail({ to, subject, html }) {
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
    });
    return true;
  } catch (error) {
    console.error("Email send failed", error);
    throw new Error("Failed to send email");
  }
}

export async function sendVerificationOtpEmail(email, otp) {
  const html = verificationEmailTemplate({ otp });
  return sendMail({
    to: email,
    subject: "Verify Your Email Address",
    html,
  });
}

export async function sendForgotPasswordOtpEmail(email, otp) {
  const html = forgotPasswordEmailTemplate({ otp });
  return sendMail({
    to: email,
    subject: "Reset Your Password",
    html,
  });
}
