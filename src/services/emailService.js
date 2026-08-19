import SibApiV3Sdk from "sib-api-v3-sdk";
import {
  verificationEmailTemplate,
  forgotPasswordEmailTemplate,
} from "../templates/emailTemplates.js";

const brevoApiKey = process.env.BREVO_API_KEY;
const brevoSenderEmail = process.env.BREVO_SENDER_EMAIL;
const brevoSenderName = process.env.BREVO_SENDER_NAME || "EPMS";

if (!brevoApiKey) {
  console.warn(
    "BREVO_API_KEY is not configured. Email sending will fail until it is set.",
  );
}

if (!brevoSenderEmail) {
  console.warn(
    "BREVO_SENDER_EMAIL is not configured. Email sending will fail until it is set.",
  );
}

const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications["api-key"];

if (brevoApiKey) {
  apiKey.apiKey = brevoApiKey;
}

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

async function sendEmail({ to, name, subject, html }) {
  if (!brevoApiKey || !brevoSenderEmail) {
    throw new Error("Failed to send email");
  }

  const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
  sendSmtpEmail.sender = {
    email: brevoSenderEmail,
    name: brevoSenderName,
  };
  sendSmtpEmail.to = [{ email: to, name: name || to }];
  sendSmtpEmail.subject = subject;
  sendSmtpEmail.htmlContent = html;

  try {
    const response = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log("Brevo API response", {
      status: response?.statusCode || "OK",
      messageId: response?.messageId || null,
    });
    return true;
  } catch (error) {
    const status = error?.response?.status || error?.statusCode || "unknown";
    const responseBody = error?.response?.body || error?.body || null;
    const message = error?.message || "Unknown Brevo error";

    console.error("Brevo API Error", {
      Status: status,
      Response: responseBody,
      Message: message,
    });
    throw new Error("Failed to send email");
  }
}

export async function sendVerificationOtpEmail(email, otp) {
  const html = verificationEmailTemplate({ otp });
  const sent = await sendEmail({
    to: email,
    name: email,
    subject: "Verify Your Email Address",
    html,
  });

  if (sent) {
    console.log("Verification email sent successfully");
  }

  return sent;
}

export async function sendForgotPasswordOtpEmail(email, otp) {
  const html = forgotPasswordEmailTemplate({ otp });
  const sent = await sendEmail({
    to: email,
    name: email,
    subject: "Reset Your Password",
    html,
  });

  if (sent) {
    console.log("Password reset email sent successfully");
  }

  return sent;
}
