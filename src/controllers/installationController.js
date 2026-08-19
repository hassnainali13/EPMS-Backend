import Installation from "../models/Installation.js";

export async function listInstallations(req, res) {
  try {
    const companyId = req.authUser.company._id;
    const { search, page = 1, limit = 20 } = req.query;
    const filter = { companyId };

    if (search) {
      filter.$or = [
        { location: new RegExp(search, "i") },
        { status: new RegExp(search, "i") },
      ];
    }

    const installations = await Installation.find(filter)
      .populate("engineer", "name email")
      .populate("customer", "name contactPerson email phone")
      .populate("panel", "panelId panelName")
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));
    const total = await Installation.countDocuments(filter);
    res.json({ installations, total });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function createInstallation(req, res) {
  try {
    const companyId = req.authUser.company._id;
    const installation = await Installation.create({
      ...req.body,
      company: companyId,
      companyId,
      createdBy: req.authUser._id,
      updatedBy: req.authUser._id,
    });
    res.status(201).json({ installation });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function updateInstallation(req, res) {
  try {
    const companyId = req.authUser.company._id;
    const installation = await Installation.findOneAndUpdate(
      { _id: req.params.id, companyId },
      { ...req.body, updatedBy: req.authUser._id },
      { new: true },
    );
    if (!installation)
      return res.status(404).json({ error: "Installation not found" });
    res.json({ installation });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function deleteInstallation(req, res) {
  try {
    const companyId = req.authUser.company._id;
    const installation = await Installation.findOneAndDelete({
      _id: req.params.id,
      companyId,
    });
    if (!installation)
      return res.status(404).json({ error: "Installation not found" });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
