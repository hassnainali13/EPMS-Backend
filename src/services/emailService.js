import nodemailer from "nodemailer";
import {
  verificationEmailTemplate,
  forgotPasswordEmailTemplate,
} from "../templates/emailTemplates.js";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT || 10000),
  greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT || 10000),
  socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT || 10000),
  tls: {
    rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== "false",
  },
  logger: process.env.SMTP_DEBUG === "true",
  debug: process.env.SMTP_DEBUG === "true",
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
    console.error("Email send failed", {
      code: error.code,
      command: error.command,
      response: error.response,
      message: error.message,
      stack: error.stack,
    });
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
