export const PANEL_TYPE_CODES = {
  "MCC (Motor Control Center)": "MCC",
  "Distribution Board": "DB",
  "PLC Control Panel": "PLC",
  "HV Switchgear": "HV",
  "LV Switchgear": "LV",
  "Power Factor Correction": "PFC",
  "Bus Duct Panel": "BDP",
  "Transfer Switch Panel": "TSP",
  "Lighting Control Panel": "LCP",
  "Feeder Pillar": "FP",
};

function normalizeKey(value) {
  if (!value || typeof value !== "string") return "";
  return value.trim().toLowerCase();
}

export function getPanelTypeCode(panelType) {
  if (!panelType) return null;
  const key = normalizeKey(panelType);
  for (const [name, code] of Object.entries(PANEL_TYPE_CODES)) {
    if (normalizeKey(name) === key) return code;
  }

  for (const code of Object.values(PANEL_TYPE_CODES)) {
    if (normalizeKey(code) === key) return code;
  }

  return null;
}

export default {
  getPanelTypeCode,
  PANEL_TYPE_CODES,
};
