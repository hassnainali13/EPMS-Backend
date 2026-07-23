export function verificationEmailTemplate({ otp }) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f8fafc; border-radius: 12px;">
      <div style="background: linear-gradient(135deg, #0EA5E9, #0F172A); padding: 24px; border-radius: 12px 12px 0 0; color: white;">
        <h2 style="margin: 0; font-size: 24px;">Verify Your Email Address</h2>
        <p style="margin: 8px 0 0; opacity: 0.9;">Welcome to EPMS</p>
      </div>
      <div style="background: white; padding: 24px; border-radius: 0 0 12px 12px; color: #0F172A;">
        <p style="margin: 0 0 12px;">Use the following verification code to complete your account setup:</p>
        <div style="font-size: 32px; letter-spacing: 6px; font-weight: 700; padding: 16px; background: #f1f5f9; border-radius: 8px; text-align: center; margin: 20px 0;">${otp}</div>
        <p style="margin: 0; color: #64748b; font-size: 14px;">This code expires in 10 minutes. If you did not create this account, you can safely ignore this email.</p>
      </div>
    </div>
  `;
}

export function forgotPasswordEmailTemplate({ otp }) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f8fafc; border-radius: 12px;">
      <div style="background: linear-gradient(135deg, #0EA5E9, #0F172A); padding: 24px; border-radius: 12px 12px 0 0; color: white;">
        <h2 style="margin: 0; font-size: 24px;">Reset Your Password</h2>
        <p style="margin: 8px 0 0; opacity: 0.9;">EPMS account security</p>
      </div>
      <div style="background: white; padding: 24px; border-radius: 0 0 12px 12px; color: #0F172A;">
        <p style="margin: 0 0 12px;">Use the following code to reset your password:</p>
        <div style="font-size: 32px; letter-spacing: 6px; font-weight: 700; padding: 16px; background: #f1f5f9; border-radius: 8px; text-align: center; margin: 20px 0;">${otp}</div>
        <p style="margin: 0; color: #64748b; font-size: 14px;">This code expires in 10 minutes. If you did not request a password reset, please ignore this email.</p>
      </div>
    </div>
  `;
}
