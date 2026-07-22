export function normalizeDiagramPayload(input = {}) {
  const name = String(input?.name || "").trim();
  const url = String(input?.url || "").trim();
  const publicId = String(input?.publicId || "").trim();
  const fileType = String(input?.fileType || "").trim();
  const libraryId = String(input?.libraryId || "").trim();

  const payload = {
    name: name || "Wiring Diagram",
    url,
    publicId,
    fileType,
    source: libraryId ? "library" : "upload",
  };

  if (libraryId) payload.libraryId = libraryId;
  return payload;
}

export async function findOrCreateDiagramForCompany(
  input = {},
  deps = {},
) {
  const normalized = normalizeDiagramPayload(input);
  const companyId = String(input?.companyId || "").trim();
  const findOne = deps.findOne || (() => Promise.resolve(null));
  const create = deps.create || (() => Promise.resolve(null));

  if (!companyId) {
    return null;
  }

  const orConditions = [];
  if (normalized.publicId) orConditions.push({ publicId: normalized.publicId });
  if (normalized.url) orConditions.push({ url: normalized.url });
  if (normalized.libraryId) orConditions.push({ libraryId: normalized.libraryId });

  const query = { companyId };
  if (orConditions.length > 0) {
    query.$or = orConditions;
  }

  const existing = orConditions.length ? await findOne(query) : null;

  if (existing) {
    return existing;
  }

  return create({
    companyId,
    company: companyId,
    name: normalized.name,
    url: normalized.url,
    publicId: normalized.publicId,
    fileType: normalized.fileType,
    source: normalized.source,
    libraryId: normalized.libraryId,
  });
}
