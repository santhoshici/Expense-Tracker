# Expense Tracker - Resume Context

## One-Line Resume Summary

Built a full-stack MERN expense tracker with JWT-protected user sessions, income and expense management, dashboard analytics, chart visualizations, profile image uploads, and Excel export support.

## Project Overview

Expense Tracker is a full-stack personal finance web application that helps users track income, expenses, and spending patterns from a clean dashboard. Users can sign up, log in, add financial transactions, view summaries, analyze recent activity through charts, and download income or expense data as Excel files.

This branch focuses only on the expense tracking product. It does not include the AI diary or todo modules from the other branch.

## Tech Stack

### Frontend

- React 19
- Vite
- React Router
- Axios
- Tailwind CSS
- Recharts
- React Icons
- React Hot Toast
- Moment.js

### Backend

- Node.js
- Express.js
- MongoDB with Mongoose
- JWT for protected API access
- bcryptjs for password hashing
- Multer for profile image uploads
- xlsx for Excel report generation
- dotenv for environment variables
- CORS middleware
- **ioredis** for distributed rate limiting (with in-memory token-bucket fallback)
- **@google/generative-ai** (Gemini 3.6 Flash) for AI-powered financial copilot
- Custom query sanitizer for MongoDB pipeline injection protection

### AI/ML Layer

- **Gemini 3.6 Flash** (Google Generative AI SDK) for natural-language financial queries
- **Rule-based fallback engine** — works without API key, parses keywords and builds MongoDB aggregation pipelines
- **Auto-categorization** — keyword scoring predicts expense categories
- **Anomaly detection** — z-score + 3× median rule flags outlier expenses
- **Optional Python FastAPI microservice** — TF-IDF categorizer + IsolationForest (backend falls back gracefully if unavailable)

### Rate Limiting & Caching

- **Redis (Upstash)** — distributed token-bucket rate limiting via Lua scripts
- **In-memory fallback** — per-process token bucket when Redis is unreachable
- **Connection-state tracking** — `ready`/`end`/`reconnecting` events prevent retry storms
- **`maxRetriesPerRequest: 1`** — commands fail fast instead of hanging for 20 retries

### Database

- MongoDB / MongoDB Atlas
- Mongoose models for users, income records, expense records, and AI quota tracking
- Collections: `users`, `incomes`, `expenses`, `useraiquotas`

## Core Features

## Expense Copilot (AI Financial Assistant)

The app includes a Gemini-powered AI copilot that understands natural language questions about the user's finances and renders interactive charts.

Implemented behavior:

- Floating chat panel accessible from all dashboard pages (bottom-right).
- **Theme-aware**: adapts to light/dark mode automatically (uses Tailwind CSS semantic classes, not hardcoded colors).
- Natural language → MongoDB aggregation pipeline → chart-ready JSON.
- Multi-turn conversation memory (last 5 turns sent as context to Gemini).
- Chat history persisted to `localStorage` per user.
- Structured JSON response with `explanation`, `chartType`, `chartTitle`, `data[]`, and `summaryMetrics`.
- Dynamic chart rendering (bar, line, pie) via `DynamicChartRenderer` component.
- Rule-based fallback engine when `GEMINI_API_KEY` is missing or Gemini fails.
- Every generated pipeline is sanitized (`QuerySanitizer`); forbidden stages (`$out`, `$merge`, `$unionWith`) are rejected, and `userId` match is forced.
- Per-user daily AI quota tracking (`UserAIQuota` model with TTL index).

Relevant files:

- `backend/controller/aiController.js` — AI endpoints (query, categorize, anomaly, health)
- `backend/src/services/geminiService.js` — Gemini 3.6 Flash integration + rule fallback
- `backend/src/services/querySanitizer.js` — MongoDB pipeline injection protection
- `backend/src/services/redisService.js` — thin Redis cache wrapper
- `backend/models/UserAIQuota.js` — daily AI quota tracking
- `backend/routes/aiRoutes.js` — AI API routes with rate limiting
- `frontend/expense-tracker/src/components/AI/AnalyticsChatbot.jsx` — chat UI
- `frontend/expense-tracker/src/components/AI/DynamicChartRenderer.jsx` — JSON-driven Recharts renderer
- `frontend/expense-tracker/src/components/AI/AgentStateBadge.jsx` — loading state badge
- `frontend/expense-tracker/src/types/analytics.ts` — TypeScript types for AI response

## Rate Limiting

Tiered token-bucket rate limiting with Redis and in-memory fallback.

Implemented behavior:

- REST API: 100 requests/min per user/IP.
- AI endpoints: 10 requests/min + 100 requests/day per user.
- Token-bucket algorithm implemented in Lua (atomic Redis execution).
- In-memory fallback when Redis is unreachable (per-process only).
- Connection state tracking via `ready`/`end`/`reconnecting` events.
- `maxRetriesPerRequest: 1` ensures fast failure instead of 20-retry hangs.
- 429 response includes `retryAfterSeconds`, `limit`, and `remaining`.

Relevant files:

- `backend/src/config/redis.js` — ioredis client + in-memory Map fallback + Lua script
- `backend/src/middleware/rateLimiter.js` — tiered token-bucket middleware

## Auto-Categorization & Anomaly Detection

Implemented behavior:

- When a user adds an expense without a category, the backend predicts one from description + amount.
- Confidence threshold: ≥ 0.65 uses predicted category, else "Uncategorized / Review Required".
- On every expense add, computes z-score vs last 90 days of same-category spend.
- Flags as anomaly if `z > 2.5` or `amount > 3× median`.
- Anomaly fields persisted: `isAnomaly`, `anomalyReason`, `anomalyCheckedAt`.
- Optional Python FastAPI microservice for TF-IDF + IsolationForest (backend calls with 2s timeout, falls back silently).

Relevant files:

- `backend/controller/expenseController.js` — auto-categorize + anomaly check on add
- `backend/controller/aiController.js` — categorize and anomaly API endpoints
- `backend/ml/categorizer.py` — keyword + TF-IDF categorizer
- `backend/ml/anomaly_detector.py` — z-score + IsolationForest
- `backend/ml/main.py` — FastAPI app

## Authentication

The app supports user registration, login, authenticated user lookup, and profile image upload.

Implemented behavior:

- Register with full name, email, password, and optional profile image URL.
- Hash passwords before storing them in MongoDB.
- Generate JWT tokens for user sessions.
- Protect private API routes with middleware that verifies the bearer token.
- Store the frontend token in local storage.
- Attach the JWT token to API requests through an Axios request interceptor.
- Redirect users to login when the API returns an unauthorized response.

Relevant files:

- `backend/controller/authController.js`
- `backend/models/User.js`
- `backend/middleware/authMiddleware.js`
- `backend/routes/authRoutes.js`
- `frontend/expense-tracker/src/utils/axiosInstance.js`
- `frontend/expense-tracker/src/pages/Auth/Login.jsx`
- `frontend/expense-tracker/src/pages/Auth/SignUp.jsx`

## Income Management

Users can create, view, delete, and export income records.

Income record fields:

- Source
- Amount
- Date
- Icon
- User ID

Implemented behavior:

- Add income through a form modal.
- Validate required fields on the frontend.
- Fetch user-specific income records.
- Sort records by date.
- Delete income records.
- Export income records to `income_details.xlsx`.

Relevant files:

- `backend/controller/incomeController.js`
- `backend/models/Income.js`
- `backend/routes/incomeRoutes.js`
- `frontend/expense-tracker/src/pages/Dashboard/Income.jsx`
- `frontend/expense-tracker/src/components/Income`

## Expense Management

Users can create, view, delete, and export expense records.

Expense record fields:

- Category
- Amount
- Date
- Icon
- User ID

Implemented behavior:

- Add expense through a form modal.
- Validate required fields on the frontend.
- Fetch user-specific expense records.
- Sort records by date.
- Delete expense records.
- Export expense records to `expense_details.xlsx`.

Relevant files:

- `backend/controller/expenseController.js`
- `backend/models/Expense.js`
- `backend/routes/expenseRoutes.js`
- `frontend/expense-tracker/src/pages/Dashboard/Expense.jsx`
- `frontend/expense-tracker/src/components/Expense`

## Dashboard Analytics

The dashboard provides a financial overview for the logged-in user.

Dashboard data includes:

- Total balance
- Total income
- Total expense
- Recent transactions
- Last 30 days of expenses
- Last 60 days of income
- Chart-ready data for financial visualization

Backend logic:

- Uses MongoDB aggregation to calculate total income and total expense.
- Calculates total balance as income minus expense.
- Fetches recent income and expense transactions.
- Combines income and expense data into one recent transaction feed.
- Returns compact dashboard data to the frontend.

Frontend logic:

- Displays financial totals with reusable info cards.
- Uses chart components for visual summaries.
- Shows recent transactions, recent income, and expense trends.

Relevant files:

- `backend/controller/dashboardController.js`
- `backend/routes/dashboardRoutes.js`
- `frontend/expense-tracker/src/pages/Dashboard/Home.jsx`
- `frontend/expense-tracker/src/components/Dashboard`
- `frontend/expense-tracker/src/components/Charts`

## Excel Export

The app supports downloading income and expense records as Excel files.

Implementation:

- Backend queries records for the authenticated user.
- Data is converted into worksheet format using the `xlsx` package.
- Backend generates an Excel file.
- Frontend downloads the file as a blob.

Export endpoints:

- `GET /api/v1/income/downloadexcel`
- `GET /api/v1/expense/downloadexcel`

Resume framing:

- Implemented server-side Excel report generation for financial transaction data and frontend blob-based downloads.

## Image Upload

The app supports profile image upload during authentication flows.

Implementation:

- Uses Multer disk storage.
- Accepts JPEG, PNG, and GIF files.
- Saves uploaded files under `backend/uploads`.
- Serves uploads statically through Express.
- Returns a public image URL to the frontend.

Relevant files:

- `backend/middleware/uploadMiddleware.js`
- `backend/routes/authRoutes.js`
- `frontend/expense-tracker/src/utils/uploadImage.js`
- `frontend/expense-tracker/src/components/Inputs/ProfilePhotoSelector.jsx`

## Frontend Architecture

The frontend is organized around pages, reusable components, contexts, and utility modules.

Main routes:

- `/` - landing page
- `/login` - login
- `/signup` - registration
- `/dashboard` - financial overview
- `/income` - income management
- `/expense` - expense management

Frontend structure:

- `pages/Auth` contains authentication screens.
- `pages/Dashboard` contains dashboard, income, and expense pages.
- `components/Dashboard` contains dashboard widgets.
- `components/Income` contains income forms, charts, and lists.
- `components/Expense` contains expense forms, charts, and lists.
- `components/Charts` wraps Recharts visualizations.
- `components/layouts` contains shared dashboard and auth layouts.
- `utils/apiPaths.js` centralizes API endpoints.
- `utils/axiosInstance.js` centralizes API calls and token handling.
- `context/UserContext.jsx` manages user state.
- `context/ThemeContext.jsx` manages light/dark mode.

## Backend Architecture

The backend follows a controller-route-model structure.

Backend flow:

1. `server.js` configures Express, CORS, JSON parsing, static uploads, routes, and MongoDB connection.
2. Route files define API endpoints.
3. Auth middleware verifies JWT tokens for private routes.
4. Controllers handle business logic.
5. Mongoose models define MongoDB collections.

Backend structure:

- `config/db.js` connects to MongoDB (includes DNS proxy detection and override for local VPN/ad-blocker setups).
- `src/config/redis.js` — ioredis client + in-memory Map fallback + Lua token-bucket script.
- `src/middleware/rateLimiter.js` — tiered rate limiting (REST, AI, AI-daily).
- `src/services/geminiService.js` — Gemini 3.6 Flash integration with rule-based fallback.
- `src/services/querySanitizer.js` — MongoDB pipeline sanitization + userId injection.
- `src/services/redisService.js` — thin Redis cache wrapper.
- `models` contains User, Income, Expense, and UserAIQuota schemas.
- `routes` defines API endpoints.
- `controller` contains endpoint handlers (including `aiController.js` for AI endpoints).
- `middleware` contains auth, upload, and logger middleware.
- `ml` contains optional Python FastAPI microservice.

## API Summary

Base API path: `/api/v1`

### Auth

- `POST /auth/register` - register a new user
- `POST /auth/login` - log in and receive a JWT token
- `GET /auth/getUser` - fetch authenticated user information
- `GET /auth/users-count` - fetch total registered user count
- `POST /auth/upload-image` - upload a profile image

### Dashboard

- `GET /dashboard` - fetch dashboard totals, recent transactions, and chart data

### Income

- `POST /income/add` - add income
- `GET /income/get` - get authenticated user's income records
- `DELETE /income/:id` - delete income
- `GET /income/downloadexcel` - download income Excel report

### Expense

- `POST /expense/add` - add expense (auto-categorizes if category missing, runs anomaly check)
- `GET /expense/get` - get authenticated user's expense records (includes `isAnomaly`, `anomalyReason`)
- `DELETE /expense/:id` - delete expense
- `GET /expense/downloadexcel` - download expense Excel report

### AI / ML

- `GET /ai/health` - AI engine status (no auth required)
- `POST /ai/categorize` - predict expense category from description + amount
- `POST /ai/anomaly` - check if an expense is an anomaly
- `POST /ai/query` - natural language financial query → structured JSON with chart data

Rate limits: AI endpoints are limited to 10 req/min + 100 req/day per user.

## Data Models

### User

- `fullName`
- `email`
- `password`
- `profileImageUrl`
- `createdAt`
- `updatedAt`

### Income

- `userId`
- `icon`
- `source`
- `amount`
- `date`
- `createdAt`
- `updatedAt`

### Expense

- `userId`
- `icon`
- `category`
- `amount`
- `date`
- `isAnomaly` (boolean, set by anomaly detection)
- `anomalyReason` (string, explanation if flagged)
- `anomalyCheckedAt` (date, when anomaly check ran)
- `createdAt`
- `updatedAt`

### UserAIQuota

- `userId`
- `date` (string, YYYY-MM-DD)
- `count` (number of AI queries today)
- TTL index expires documents after 48 hours

## Architecture Explanation for Interviews

This project uses a MERN architecture. React handles the UI, routing, forms, charts, and dashboard interactions. Axios centralizes API requests and injects the JWT token into protected requests. Express exposes REST APIs for authentication, dashboard analytics, income, expenses, image upload, and Excel export. MongoDB stores user-owned financial records through Mongoose schemas.

The dashboard is calculated mostly on the backend. The API aggregates income and expense totals, calculates balance, fetches recent records, and returns dashboard-ready data. This keeps the frontend focused on rendering charts and cards instead of duplicating financial logic.

## Strong Resume Bullets

- Developed a full-stack MERN expense tracker with authenticated income and expense management, dashboard analytics, chart visualizations, Excel export, and a Gemini-powered AI copilot.
- Designed REST APIs with Express and MongoDB/Mongoose for user-scoped financial records protected by JWT middleware.
- Built a React/Vite frontend with reusable dashboard layouts, modals, cards, forms, chart components, toast notifications, and responsive Tailwind CSS v4 theming (light/dark mode).
- Implemented MongoDB aggregation logic to calculate total income, total expenses, current balance, recent transactions, and time-windowed financial insights.
- Created income and expense CRUD workflows with frontend validation, authenticated backend persistence, and date-sorted transaction lists.
- Implemented server-side Excel report generation with the `xlsx` package and client-side blob downloads for financial records.
- Added profile image upload support using Multer with static file serving through Express.
- Centralized API route definitions and Axios interceptors to simplify authenticated frontend-backend communication.
- Built dashboard visualizations using Recharts to help users understand income, expense, and balance trends.
- Integrated Google Gemini 3.6 Flash for natural-language financial queries with multi-turn conversation memory and dynamic chart rendering.
- Implemented a rule-based fallback engine that builds MongoDB aggregation pipelines from keyword parsing when the Gemini API is unavailable.
- Built a tiered token-bucket rate limiter using Redis (Lua scripts) with automatic in-memory fallback and connection-state tracking.
- Added auto-categorization and real-time anomaly detection (z-score + 3× median rule) on expense creation.
- Secured AI-generated MongoDB pipelines with a custom query sanitizer that rejects dangerous stages (`$out`, `$merge`, `$unionWith`) and forces `userId` scoping.
- Implemented DNS proxy detection and override for MongoDB Atlas SRV lookups (handles local VPN/ad-blocker DNS configurations).
- Made the AI copilot UI fully theme-aware (light/dark mode) using Tailwind CSS semantic classes instead of hardcoded colors.

## Short Project Pitch

Expense Tracker is a MERN personal finance app that helps users manage income and expenses from a dashboard. It includes JWT-protected routes, MongoDB-backed transaction storage, chart-based analytics, Excel exports, and profile image upload. I built both the React frontend and Express backend, including reusable UI components, REST APIs, Mongoose schemas, and dashboard aggregation logic.

## Technical Challenges and How to Explain Them

### Challenge: Building dashboard analytics from transaction data

I handled aggregation on the backend using MongoDB queries and aggregation pipelines. The API returns total income, total expense, balance, recent transactions, and time-windowed data so the frontend can render charts without recalculating financial logic.

### Challenge: Keeping user financial records isolated

Each income and expense record stores a `userId`. Protected routes use JWT middleware to identify the authenticated user and query records for that user.

### Challenge: Exporting reports

I used the `xlsx` package to convert MongoDB transaction data into Excel sheets and implemented frontend blob downloads so users can save income and expense reports locally.

### Challenge: Reusable dashboard UI

I separated the UI into reusable layouts, cards, chart wrappers, modals, and transaction components. This made the dashboard, income page, and expense page easier to maintain.

## Honest Improvement Notes

These are useful if an interviewer asks what you would improve next:

- The login controller should call `user.comparePassword(password)` before issuing a JWT.
- Income and expense delete operations should verify ownership by deleting with both `_id` and `userId`.
- Excel generation currently writes fixed filenames on the server; streaming generated workbooks directly would be safer for concurrent users.
- Backend validation could be strengthened with a schema validation library.
- Add automated tests for authentication, income CRUD, expense CRUD, dashboard aggregation, and Excel export.
- Add pagination and search for large transaction histories.
- Add budget categories, monthly spending limits, and recurring transaction support.
- Add more robust deployment documentation and environment variable examples.

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `MONGO_URI` | Yes | MongoDB Atlas connection string |
| `JWT_SECRET` | Yes | JWT signing secret (`openssl rand -hex 32`) |
| `CLIENT_URL` | No | Frontend origin for CORS |
| `GEMINI_API_KEY` | No | Google AI Studio key; empty → rule-based fallback |
| `AI_DAILY_QUOTA` | No | Per-user daily AI query limit (default: 10) |
| `REDIS_URL` | No | Upstash Redis URL; empty → in-memory fallback |
| `ML_SERVICE_URL` | No | FastAPI ML service URL; empty → skip |
| `PORT` | No | Server port (default: 8000) |
| `NODE_ENV` | No | `development` or `production` |

### Frontend (`frontend/expense-tracker/.env`)

| Variable | Required | Description |
|---|---|---|
| `VITE_API_BASE_URL` | Yes | Backend API base URL (baked at build time) |

> `.env` files are gitignored and not tracked. Templates are in `.env.example`.

## Keywords for Resume or LinkedIn

MERN Stack, React, Vite, Node.js, Express.js, MongoDB, Mongoose, JWT, REST API, Tailwind CSS v4, Recharts, Axios, Excel Export, Dashboard Analytics, CRUD, Authentication, Multer, Full-Stack Development, Personal Finance App, Google Gemini, Generative AI, Redis, Rate Limiting, Token Bucket, Anomaly Detection, Auto-Categorization, DNS Resolution, In-Memory Fallback, Query Sanitization.

