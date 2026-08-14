# TESTING & WORKFLOW RULES

**Phase:** Quality Assurance, CI/CD Workflow, and Living Documentation

**Target Action:** Agent Execution Guidelines for Testing and Committing

---

## 1. Strict Git Workflow & Commit Protocol

The agent MUST treat this repository as a high-stakes production environment.

* **Atomic Commits:** After *every* logical step or feature completion, you must automatically create a Git commit. Do not batch unrelated changes into a single massive commit.
* **Conventional Commits Format:** You must use the Conventional Commits specification.
  * `feat: [description]` for new features (e.g., `feat: implement redis rate limiting`)
  * `fix: [description]` for bug fixes
  * `test: [description]` for adding or updating tests
  * `docs: [description]` for documentation updates
  * `refactor: [description]` for code changes that neither fix a bug nor add a feature

* **No Broken Commits:** Never commit code that breaks the build or fails the test suite.

---

## 2. Living Documentation

Documentation is not an afterthought; it is a strict requirement.

* **Inline Documentation:** Complex business logic, especially in the ML categorization, AST parsing, and SQL sanitization modules, MUST have clear, concise inline comments (JSDoc for TypeScript, Docstrings for Python).
* **API Documentation:** Any change to an endpoint (REST or SSE) MUST be immediately reflected in the API documentation (e.g., updating a `swagger.yaml`, `openapi.json`, or a dedicated `API_DOCS.md` file).
* **README Updates:** If new environment variables, Redis configurations, or ML model dependencies are added, the setup instructions in the `README.md` MUST be updated instantly.

---

## 3. Testing Architecture & Folder Structure

The project MUST contain a dedicated testing environment with a strict folder hierarchy. Create a `/tests` directory at the root of both the `frontend` and `backend` (and `ml_service` if separated).

### Backend / API Testing Setup

* **Framework:** Use `Jest` + `Supertest` (for Node.js/Express) and `PyTest` + `httpx` (for FastAPI/Python).
* **Test Database:** Tests MUST run against an isolated test database (e.g., an in-memory MongoDB instance via `mongodb-memory-server` or a local Postgres test schema) to prevent polluting real data.
* **Structure:**
```text
backend/
├── tests/
│   ├── unit/                 # Isolated function tests (e.g., AST Parser, Z-Score math)
│   ├── integration/          # API endpoint tests (Supertest)
│   │   ├── auth.test.ts
│   │   ├── expense.test.ts
│   │   └── aiAgent.test.ts
│   ├── setup.ts              # DB Teardown/Setup scripts
│   └── mocks/                # Mock data (mock users, mock JWTs, Redis mocks)
```

### Test Coverage Requirements

1. **Auth & Middleware:** Test JWT generation, invalid tokens, and Rate Limiter HTTP 429 rejections.
2. **CRUD API Tests:** Ensure all `GET`, `POST`, `DELETE` routes return correct HTTP status codes (200, 201, 400, 401, 404, 500) and validate response JSON payloads.
3. **ML & AI Guardrails:**
   * Write explicit test cases attempting to inject malicious SQL (e.g., `DROP TABLE users;`). Ensure the `querySanitizer` catches and rejects them.
   * Mock the LLM / OpenAI API response to test the SSE streaming frontend parser without burning API credits.

---

## 4. Test Execution & Validation Rules

* **Run Before Commit:** You must actively run the test scripts (e.g., `npm run test` or `pytest`) via the terminal tool after writing the tests.
* **Output Verification:** Read the output of the test runner. If a test fails, you MUST debug, fix the implementation or the test, and re-run until you achieve 100% passing green tests.
* **Console Cleanliness:** Tests should not bleed `console.log` or errors into the stdout unless a test is actively failing. Silence expected errors during negative test cases.
