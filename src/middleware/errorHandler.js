export function notFoundHandler(_req, res) {
  res.status(404).json({ error: "Route not found" });
}

export function errorHandler(err, _req, res, _next) {
  console.error(err.stack || err);
  res.status(err.statusCode || 500).json({
    error: err.message || "Internal server error",
  });
}
