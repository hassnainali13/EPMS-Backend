import dotenv from "dotenv";

dotenv.config();

const env = {
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGO_URI || "",
  jwtSecret: process.env.JWT_SECRET || "dev-secret",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || "dev-refresh-secret",
  installerAccessCode: process.env.INSTALLER_ACCESS_CODE || "",
  adminEmail: process.env.ADMIN_EMAIL || "admin@epms.io",
  adminPassword: process.env.ADMIN_PASSWORD || "Admin@EPMS2024",
  adminName: process.env.ADMIN_NAME || "System Administrator",
  adminCompanyName: process.env.ADMIN_COMPANY_NAME || "ElectraPanel",
  adminCompanyEmail: process.env.ADMIN_COMPANY_EMAIL || "admin@epms.io",
  adminCompanySlug: process.env.ADMIN_COMPANY_SLUG || "electrapanel",
  adminCompanyIndustry: process.env.ADMIN_COMPANY_INDUSTRY || "Electrical",
  adminCompanyAddress: process.env.ADMIN_COMPANY_ADDRESS || "Dubai, UAE",
};

export default env;
