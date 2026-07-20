import Company from "../models/Company.js";

export async function getCompany(req, res) {
  try {
    const company = req.authUser.company;
    if (!company) return res.status(404).json({ error: "Company not found" });
    res.json({ company });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function updateCompany(req, res) {
  try {
    const companyId = req.authUser.company._id;
    const allowed = [
      "name",
      "email",
      "ownerName",
      "phone",
      "description",
      "expiryDate",
      "subscriptionStatus",
      "industry",
      "address",
      "website",
      "logoUrl",
      "status",
    ];
    const update = {};
    allowed.forEach((key) => {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    });

    const company = await Company.findOneAndUpdate({ _id: companyId }, update, {
      new: true,
    });
    if (!company) return res.status(404).json({ error: "Company not found" });
    res.json({ company });
  } catch (error) {
    if (error?.code === 11000) {
      const keys = Object.keys(error.keyPattern || error.keyValue || {});
      const field = keys.length ? keys[0] : "company";
      return res.status(409).json({ error: `${field} already exists` });
    }
    res.status(500).json({ error: error.message });
  }
}
