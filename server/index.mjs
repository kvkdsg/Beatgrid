import path from "node:path";
import { fileURLToPath } from "node:url";
import pino from "pino";
import { createApp } from "./middleware.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = pino({
	level: process.env.LOG_LEVEL || "info",
	timestamp: pino.stdTimeFunctions.isoTime,
	formatters: {
		level: (label) => ({ severity: label.toUpperCase() }),
	},
	base: undefined,
});

const DIST_DIR = path.resolve(__dirname, "../dist");

const app = createApp({ distDir: DIST_DIR });

const PORT = parseInt(process.env.PORT || "8080", 10);
const HOST = "0.0.0.0";

const server = app.listen(PORT, HOST, () => {
	logger.info({
		msg: "Server ready and listening",
		port: PORT,
		host: HOST,
		env: process.env.NODE_ENV || "production",
		distDir: DIST_DIR,
	});
});

const shutdown = (signal) => {
	logger.info({ msg: "Received shutdown signal", signal });

	server.close((err) => {
		if (err) {
			logger.error({ msg: "Error closing HTTP server", err });
			process.exit(1);
		}
		logger.info("HTTP server closed gracefully");
		process.exit(0);
	});

	setTimeout(() => {
		logger.error("Forced shutdown after timeout (10s)");
		process.exit(1);
	}, 10000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("uncaughtException", (err) => {
	logger.fatal({ msg: "Uncaught exception", err });
	process.exit(1);
});

process.on("unhandledRejection", (reason) => {
	logger.error({ msg: "Unhandled promise rejection", reason });
});
