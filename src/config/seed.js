import Company from "../models/Company.js";
import User from "../models/User.js";
import Panel from "../models/Panel.js";
import env from "./env.js";

export async function seedInitialData() {
  let company = await Company.findOne({ slug: env.adminCompanySlug });
  if (!company) {
    company = await Company.create({
      name: env.adminCompanyName,
      email: env.adminCompanyEmail,
      slug: env.adminCompanySlug,
      industry: env.adminCompanyIndustry,
      address: env.adminCompanyAddress,
    });
  }

  const adminUser = await User.findOne({ email: env.adminEmail });
  if (!adminUser) {
    await User.create({
      name: env.adminName,
      email: env.adminEmail,
      password: env.adminPassword,
      role: "super_admin",
      plan: "PREMIUM",
      company: company._id,
      companyId: company._id,
    });
  }

  const panelCount = await Panel.countDocuments();
  if (panelCount === 0) {
    const year = new Date().getFullYear().toString().slice(-2);
    const initials =
      company.name
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, " ")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => word[0])
        .join("")
        .toUpperCase()
        .slice(0, 3) || "CMP";
    const panelId = `${initials}${year}-MCC-0001`;

    await Panel.create({
      panelId,
      panelName: "Main MCC Panel",
      panelType: "MCC",
      manufacturingDate: "2024-01-10",
      installationDate: "2024-02-01",
      company: company._id,
      companyId: company._id,
      customer: "Siemens Gulf",
      installer: "ElectraWorks",
      manufacturer: "PanelCraft",
      installationLocation: "Dubai, UAE",
      description: "Seeded demo panel",
      status: "Installed",
      qrGenerated: true,
    });
  }
}
