import express from "express";
import authRoutes from "./auth.js";
import panelRoutes from "./panels.js";
import companyRoutes from "./company.js";
import adminRoutes from "./admin.js";
import customerRoutes from "./customers.js";
import installationRoutes from "./installations.js";
import maintenanceRoutes from "./maintenance.js";
import uploadRoutes from "./uploads.js";
import instrumentRoutes from "./instruments.js";
import diagramRoutes from "./diagrams.js";

const router = express.Router();

router.use("/api/auth", authRoutes);
router.use("/api/panels", panelRoutes);
router.use("/api/company", companyRoutes);
router.use("/api/customers", customerRoutes);
router.use("/api/installations", installationRoutes);
router.use("/api/maintenance", maintenanceRoutes);
router.use("/api/uploads", uploadRoutes);
router.use("/api/instruments", instrumentRoutes);
router.use("/api/diagrams", diagramRoutes);
router.use("/api/admin", adminRoutes);

export default router;
