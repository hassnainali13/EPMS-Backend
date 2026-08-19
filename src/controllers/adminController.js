import Company from "../models/Company.js";
import User from "../models/User.js";
import Panel from "../models/Panel.js";

export async function getOverview(req, res) {
  try {
    if (req.authUser.role === "super_admin") {
      const users = await User.find().select("-password");
      const companies = await Company.find();
      const panels = await Panel.find();
      return res.json({ users, companies, panels, subscriptionPrice: 49 });
    }

    const companyId = req.authUser.company._id;
    const users = await User.find({ companyId }).select(
      "name email role blocked createdAt",
    );
    const panels = await Panel.find({ companyId }).select(
      "panelId panelName status createdAt",
    );
    const company = await Company.findById(companyId);
    return res.json({ users, panels, company, subscriptionPrice: 49 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function updateUser(req, res) {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function updateSubscriptionPrice(req, res) {
  try {
    res.json({ subscriptionPrice: req.body.subscriptionPrice || 49 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
