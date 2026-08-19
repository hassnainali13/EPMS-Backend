function normalizeHeaderName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (insideQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (char === "," && !insideQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

export function normalizeText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim().replace(/\s+/g, " ");
}

export function normalizeInstrumentFingerprint(manufacturer, modelNumber) {
  // Fingerprint is no longer used for manufacturer/model duplicates.
  // Keep a simple placeholder in case other code references this.
  return `${normalizeText(manufacturer).toLowerCase()}|${normalizeText(
    modelNumber,
  ).toLowerCase()}`;
}

export function normalizeInstrumentPayload(payload = {}) {
  const source = payload && typeof payload === "object" ? payload : {};
  const normalizedRecord = Object.entries(source).reduce(
    (acc, [key, value]) => {
      acc[normalizeHeaderName(key)] = value;
      return acc;
    },
    {},
  );

  const name =
    normalizeText(normalizedRecord.name) ||
    normalizeText(source.name) ||
    normalizeText(source["instrument name"]) ||
    normalizeText(source["Instrument Name"]) ||
    normalizeText(source["Instrument"]) ||
    normalizeText(source.model) ||
    normalizeText(source["instrument model"]) ||
    normalizeText(source["Instrument Model"]) ||
    normalizeText(source["Model"]) ||
    normalizeText(source.modelNumber) ||
    normalizeText(source.modelnumber) ||
    normalizeText(source["model number"]) ||
    normalizeText(source["Model Number"]);

  const category =
    normalizeText(normalizedRecord.category) ||
    normalizeText(source.category) ||
    normalizeText(source.Category) ||
    normalizeText(source["Category"]);

  const company =
    normalizeText(normalizedRecord.company) ||
    normalizeText(source.company) ||
    normalizeText(source.Company) ||
    normalizeText(source.manufacturer) ||
    normalizeText(source.Manufacturer) ||
    normalizeText(source.brand) ||
    normalizeText(source.Brand) ||
    normalizeText(source["manufacturer"]) ||
    normalizeText(source["Manufacturer"]) ||
    normalizeText(source["brand"]) ||
    normalizeText(source["Brand"]);

  const normalizedPayload = Object.entries(normalizedRecord).reduce(
    (acc, [key, value]) => {
      acc[key] = normalizeText(value);
      return acc;
    },
    {},
  );

  return {
    ...normalizedPayload,
    name,
    category,
    company,
    status:
      normalizeText(normalizedPayload.status || source.status) || "Active",
    companyId: source.companyId || null,
    fingerprint: normalizeInstrumentFingerprint(company, name),
  };
}

export function parseImportRows(content) {
  const lines = String(content || "")
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.replace(/,/g, "").trim() !== "");

  if (lines.length === 0) return [];

  const [headerLine, ...dataLines] = lines;
  const headers = parseCsvLine(headerLine).map((item) =>
    normalizeHeaderName(item),
  );

  return dataLines.map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce((acc, header, index) => {
      acc[header] = normalizeText(values[index] || "");
      return acc;
    }, {});
  });
}
