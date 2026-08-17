require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const { connectWithRetry, isDBConnected } = require("./config/db");
const app = express();
const { restRateLimiter } = require("./src/middleware/rateLimiter");
const authRoutes = require("./routes/authRoutes");
const incomeRoutes = require("./routes/incomeRoutes");
const expenseRoutes = require("./routes/expenseRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const aiRoutes = require("./routes/aiRoutes");

const { requestLogger, errorHandler } = require("./middleware/loggerMiddleware");

/*
 * Graceful degradation pattern:
 * The server starts immediately and begins accepting requests on /health.
 * MongoDB connection is attempted asynchronously via connectWithRetry().
 * If the database is unreachable (e.g. paused cluster, DNS issues), the
 * server continues running in degraded mode — health checks still respond
 * and the server is ready for Render / load-balancer pings. Any endpoint
 * that requires a live database connection will fail with a 500 error,
 * which the existing error handler surfaces to the client.
 */

app.use(
    cors({
        origin: process.env.CLIENT_URL || "*",
        methods: ["GET", "POST", "PUT", "DELETE"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);

app.use(express.json());
app.use(requestLogger);

app.get("/health", (_req, res) => {
    res.json({
        status: "ok",
        db: isDBConnected(),
        timestamp: new Date().toISOString(),
    });
});

app.use("/api/v1", restRateLimiter);

connectWithRetry();

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/income", incomeRoutes);
app.use("/api/v1/expense", expenseRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);
app.use("/api/v1/ai", aiRoutes);

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Central error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
