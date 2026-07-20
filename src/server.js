import express from "express";
import cors from "cors";
import env from "./config/env.js";
import { connectDatabase } from "./config/database.js";
import { seedInitialData } from "./config/seed.js";
import routes from "./routes/index.js";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler.js";

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, message: "EPMS API is running" });
});

app.use(routes);
app.use(notFoundHandler);
app.use(errorHandler);

async function start() {
  try {
    await connectDatabase(env.mongoUri);
    console.log("MongoDB connected");
    await seedInitialData();

    const server = app.listen(env.port, () => {
      console.log(`Server listening on port ${env.port}`);
    });

    server.on("error", (error) => {
      if (error.syscall !== "listen") {
        console.error("Server error", error);
        process.exit(1);
      }

      const bind =
        typeof env.port === "string" ? `Pipe ${env.port}` : `Port ${env.port}`;
      if (error.code === "EADDRINUSE") {
        console.error(
          `${bind} is already in use. Please stop the process using this port and restart the server.`,
        );
        process.exit(1);
      }

      console.error("Server error", error);
      process.exit(1);
    });
  } catch (error) {
    console.error("Failed to start server", error);
    process.exit(1);
  }
}

start();
