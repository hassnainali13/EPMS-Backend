import Maintenance from "../models/Maintenance.js";

export async function listMaintenances(req, res) {
  try {
    const companyId = req.authUser.company._id;
    const { search, page = 1, limit = 20 } = req.query;
    const filter = { companyId };

    if (search) {
      filter.$or = [
        { faultDetails: new RegExp(search, "i") },
        { resolution: new RegExp(search, "i") },
        { status: new RegExp(search, "i") },
      ];
    }

    const maintenances = await Maintenance.find(filter)
      .populate("engineer", "name email")
      .populate("panel", "panelId panelName")
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));
    const total = await Maintenance.countDocuments(filter);
    res.json({ maintenances, total });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function createMaintenance(req, res) {
  try {
    const companyId = req.authUser.company._id;
    const maintenance = await Maintenance.create({
      ...req.body,
      company: companyId,
      companyId,
      createdBy: req.authUser._id,
      updatedBy: req.authUser._id,
    });
    res.status(201).json({ maintenance });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function updateMaintenance(req, res) {
  try {
    const companyId = req.authUser.company._id;
    const maintenance = await Maintenance.findOneAndUpdate(
      { _id: req.params.id, companyId },
      { ...req.body, updatedBy: req.authUser._id },
      { new: true },
    );
    if (!maintenance)
      return res.status(404).json({ error: "Maintenance record not found" });
    res.json({ maintenance });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function deleteMaintenance(req, res) {
  try {
    const companyId = req.authUser.company._id;
    const maintenance = await Maintenance.findOneAndDelete({
      _id: req.params.id,
      companyId,
    });
    if (!maintenance)
      return res.status(404).json({ error: "Maintenance record not found" });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
