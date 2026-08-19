import Customer from "../models/Customer.js";

export async function listCustomers(req, res) {
  try {
    const companyId = req.authUser.company._id;
    const { search, page = 1, limit = 20 } = req.query;
    const filter = { companyId };
    if (search) {
      filter.$or = [
        { name: new RegExp(search, "i") },
        { contactPerson: new RegExp(search, "i") },
        { email: new RegExp(search, "i") },
        { phone: new RegExp(search, "i") },
        { address: new RegExp(search, "i") },
        { installationLocation: new RegExp(search, "i") },
      ];
    }

    const customers = await Customer.find(filter)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));
    const total = await Customer.countDocuments(filter);
    res.json({ customers, total });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function createCustomer(req, res) {
  try {
    const companyId = req.authUser.company._id;
    const customer = await Customer.create({
      ...req.body,
      company: companyId,
      companyId,
      createdBy: req.authUser._id,
      updatedBy: req.authUser._id,
    });
    res.status(201).json({ customer });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function updateCustomer(req, res) {
  try {
    const companyId = req.authUser.company._id;
    const customer = await Customer.findOneAndUpdate(
      { _id: req.params.id, companyId },
      { ...req.body, updatedBy: req.authUser._id },
      { new: true },
    );
    if (!customer) return res.status(404).json({ error: "Customer not found" });
    res.json({ customer });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function deleteCustomer(req, res) {
  try {
    const companyId = req.authUser.company._id;
    const customer = await Customer.findOneAndDelete({
      _id: req.params.id,
      companyId,
    });
    if (!customer) return res.status(404).json({ error: "Customer not found" });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
