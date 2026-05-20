# AssetTrack Architecture Deep Dive

This document provides a detailed breakdown of each service's design, data model, entry points, and dependencies for learners diving into the codebase.

## Quick Reference

| Service | Tech Stack | Port | Primary Responsibility | Database | Entry Point |
|---------|-----------|------|----------------------|----------|-------------|
| `web` | Astro 6 + React 19 + Bootstrap 5 | 4321 | UI & BFF composition | N/A | `services/web/src/pages/` |
| `assets-svc` | .NET 8 / ASP.NET Core | 5001 | Asset CRUD, search, lifecycle | SQLite `assets` | `services/assets-svc/Program.cs` |
| `workforce-svc` | Java 21 / Spring Boot 3 | 5002 | Employees, assignments | SQLite `employees`, `assignments` | `services/workforce-svc/src/main/java/.../WorkforceApplication.java` |
| `reporting-svc` | Python 3.12 / FastAPI | 5003 | Reports, CSV import | N/A (queries others) | `services/reporting-svc/app/main.py` |
| `notifications-svc` | Python 3.12 / FastAPI | 5004 | Webhook receiver stub | SQLite `webhook_log` (undefined) | `services/notifications-svc/app/main.py` |
| `audit-svc` | Java 11 / Spring Boot 2.7 *(legacy)* | 5005 | Append-only audit log | SQLite `audit_events` | `services/audit-svc/src/main/java/.../AuditApplication.java` |
| `auth-svc` | Java 11 / Spring Boot 2.7 *(legacy)* | 5006 | JWT issuer, JWKS endpoint | SQLite `users` | `services/auth-svc/src/main/java/.../AuthApplication.java` |

---

## Service Details

### Frontend: `web` (Astro 6 SSR + React 19)

**Port:** 4321

**Purpose:** 
- Server-side rendered HTML (Astro)
- React islands for interactive components
- BFF (Backend for Frontend): orchestrates calls to backend services
- Bootstrap 5 styling

**Module structure:**
```
services/web/src/
├── pages/              # Astro SSR routes (filesystem routing)
│   ├── index.astro     # Dashboard
│   ├── assets/         # Assets list page
│   ├── assignments/    # Assignments page
│   ├── employees/      # Employees page
│   └── reports.astro   # Reports page
├── components/         # Reusable Astro + React components
│   └── StatusBadge.astro  # ⚠️ BUGGY: wrong colors
├── lib/
│   └── api/
│       ├── client.ts   # Base HTTP client (with DEV_TOKEN_MODE)
│       ├── assets.ts   # Typed asset service client
│       ├── workforce.ts # Typed workforce client
│       └── ...
└── layouts/            # Page templates
```

**Data flow:**
1. Astro routes fetch data server-side via HTTP clients in `lib/api/`
2. Each route calls backend services (assets-svc, workforce-svc, reporting-svc, etc.)
3. React islands hydrate on the client for interactivity
4. DEV_TOKEN_MODE=true uses a hardcoded token; set to `false` to test real auth flow

**Key limitations:**
- No centralized error handling (each page handles its own)
- DEV_TOKEN_MODE bypasses auth entirely in development
- StatusBadge.astro has incorrect color mappings (Exercise #8)

**Tech stack notes:**
- Astro 6 with Node.js adapter for SSR
- React 19 for interactive components (optional hydration)
- No database — all data fetched from backend services

---

### Assets Service (`.NET 8 / ASP.NET Core`)

**Port:** 5001

**Purpose:**
- CRUD operations for assets (laptops, monitors, phones, etc.)
- Search & filter by type, status, tags
- Asset lifecycle tracking (active → retired/lost)
- Stats by status

**Module structure:**
```
services/assets-svc/
├── Program.cs          # Minimal APIs setup + Swagger
├── Endpoints/
│   └── AssetEndpoints.cs   # REST routes (GET, POST, PUT, DELETE)
├── Models/
│   └── Asset.cs        # Domain model
├── Data/
│   ├── AssetsDb.cs     # SQLite connection + schema init
│   └── SeedData.cs     # Seeded test data
└── Tests/
    └── AssetsService.Tests.csproj  # ⚠️ Only smoke test
```

**Data model:**
```
assets table:
  id INTEGER PRIMARY KEY
  asset_tag TEXT UNIQUE      # E.g., "LAPTOP-001"
  asset_type TEXT            # "laptop", "monitor", "phone", etc.
  manufacturer TEXT
  model TEXT
  serial_number TEXT
  purchase_date TEXT         # ISO 8601
  warranty_expiry TEXT       # ISO 8601
  status TEXT                # "active", "retired", "lost", etc.
  notes TEXT
```

**Key endpoints:**
- `GET /assets` — list all (supports search query param)
- `GET /assets/{id}` — fetch one
- `GET /assets/by-tag/{tag}` — ⚠️ **Not wired** (Exercise #10)
- `GET /assets/stats` — count by status
- `POST /assets` — ⚠️ **No validation** (Exercise #7)
- `PUT /assets/{id}` — update
- `DELETE /assets/{id}` — soft delete
- `GET /health` — health check
- `GET /swagger` — API docs

**Data access:**
- **Dapper** ORM (lightweight, SQL-mapping library)
- Direct SQL queries, not Entity Framework
- Singleton `AssetsDb` instance manages connections
- SQLite at path `$ASSETS_DB_PATH` (default: `./data/assets.db`)

**Key limitations:**
- ⚠️ POST /assets accepts any input (no DTO validators)
- ⚠️ GET /assets/by-tag/{tag} declared but not mapped
- ⚠️ No JWT validation (accepts all requests unauthenticated)
- ⚠️ CORS set to AllowAnyOrigin
- Tests minimal: only 1 smoke test (Exercise #2)

**Tech stack notes:**
- .NET 8 with nullable reference types enabled
- Dapper 2.1.35 for ORM
- Microsoft.Data.Sqlite for SQLite driver
- Swashbuckle for Swagger UI

---

### Workforce Service (Java 21 / Spring Boot 3)

**Port:** 5002

**Purpose:**
- Employee CRUD (department, contact info, hire date)
- Assignment lifecycle (asset → employee → return)
- Triggers notifications when assignments change
- ⚠️ Should trigger audit events (commented out)

**Module structure:**
```
services/workforce-svc/src/main/java/com/contoso/workforce/
├── WorkforceApplication.java      # Spring Boot entry point
├── HttpClientsConfig.java         # REST client bean setup
├── employee/
│   ├── Employee.java              # JPA entity
│   ├── EmployeeRepository.java    # JPA Repository
│   └── EmployeeController.java    # REST endpoints
├── assignment/
│   ├── Assignment.java            # JPA entity
│   ├── AssignmentRepository.java  # JPA Repository
│   ├── AssignmentService.java     # Business logic (⚠️ audit hook commented)
│   └── AssignmentController.java  # REST endpoints
├── HealthController.java          # Health check
└── test/
    └── WorkforceApplicationTests.java  # Smoke test only
```

**Data model:**
```
employees table:
  id INTEGER PRIMARY KEY
  name TEXT
  email TEXT
  department TEXT           # E.g., "Engineering", "Sales"
  hire_date TEXT             # ISO 8601

assignments table:
  id INTEGER PRIMARY KEY
  employee_id INTEGER        # FK to employees
  asset_id INTEGER           # Reference to assets-svc
  assigned_date TEXT         # ISO 8601
  returned_date TEXT         # NULL until returned
```

**Key endpoints:**
- `GET /employees` — list all
- `GET /employees/{id}` — fetch one
- `POST /employees` — create
- `PUT /employees/{id}` — update
- `DELETE /employees/{id}` — delete
- `GET /assignments` — list all
- `POST /assignments` — assign asset to employee (⚠️ audit hook commented)
- `PUT /assignments/{id}/return` — return asset (⚠️ audit hook commented)
- `GET /health` — health check

**Data access:**
- **JPA/Hibernate** with Spring Data repositories
- Uses `jakarta.persistence.*` imports (Spring Boot 3 convention)
- SQLite via Hibernate dialect
- SQLite at path `$WORKFORCE_DB_PATH` (default: `./data/workforce.db`)

**External service calls:**
- ⚠️ `POST http://NOTIFICATIONS_SVC_URL/notify` — on assignment create/return
  - No timeout configured
  - No retry logic
  - No circuit breaker → if notifications-svc is down, assignment creation fails
- ⚠️ `POST http://AUDIT_SVC_URL/events` — on assignment changes (COMMENTED OUT in AssignmentService.java)
  - Hook is partially wired but disabled
  - Exercise #13 asks to uncomment + complete

**Key limitations:**
- ⚠️ No timeout/retry on external calls (RestClient)
- ⚠️ No error boundaries — external call failures propagate to user
- ⚠️ Audit hook commented out (Exercise #13)
- No circuit breaker for resilience
- Tests minimal: only smoke test

**Tech stack notes:**
- Java 21 with Spring Boot 3.5.3
- Spring Data JPA + Hibernate
- SQLite JDBC driver
- Spring Boot validation & web starters

---

### Reporting Service (Python 3.12 / FastAPI)

**Port:** 5003

**Purpose:**
- Reports on asset warranty, utilization, etc.
- CSV bulk import of assets
- Queries assets-svc and workforce-svc for data

**Module structure:**
```
services/reporting-svc/
├── app/
│   ├── main.py          # FastAPI app setup
│   ├── routers/
│   │   ├── reports.py   # GET /reports/* endpoints
│   │   └── imports_.py  # POST /imports/assets (⚠️ crashes on bad CSV)
│   └── legacy/
│       └── format_helpers.py  # ⚠️ Old Python idioms (% formatting, no types)
├── pyproject.toml       # Dependencies
└── tests/               # ⚠️ EMPTY (Exercise #11)
```

**Key endpoints:**
- `GET /reports/warranty-expiring` — assets expiring soon (query param: `days=30`)
- `GET /reports/utilization` — assets per employee/department
- `POST /imports/assets` — ⚠️ **Crashes on first bad row** (Exercise #6)
  - Expects CSV: asset_tag, asset_type, manufacturer, model, serial_number, purchase_date, warranty_expiry
  - Should return `{ "imported": N, "skipped": M, "errors": [...] }`
  - Currently returns raw exception on any malformed row
- `GET /health` — health check

**Data access:**
- No local database; queries assets-svc and workforce-svc via HTTP
- Optional local SQLite for caching (not used)

**External service calls:**
- `GET http://ASSETS_SVC_URL/assets` — fetch all assets for reports
- `GET http://WORKFORCE_SVC_URL/employees` — fetch employees for reports
- ⚠️ No timeout configured

**Key limitations:**
- ⚠️ CSV import crashes on first malformed row; no per-row error handling (Exercise #6)
- ⚠️ format_helpers.py uses deprecated Python idioms:
  - `%` formatting instead of f-strings
  - `os.path.join` instead of `pathlib.Path`
  - No type hints anywhere
  - Violates PEP 257 docstring style
- ⚠️ tests/ directory completely empty (Exercise #11)
- No error boundaries on external calls

**Tech stack notes:**
- FastAPI 0.136.1 with Uvicorn
- Pydantic 2.13.4 for validation
- httpx 0.28.1 for HTTP client
- pytest available but tests not written

---

### Notifications Service (Python 3.12 / FastAPI)

**Port:** 5004

**Purpose:**
- Receive webhook notifications from other services
- Dispatch to email/Slack (stubs; not implemented)
- Log webhook deliveries

**Module structure:**
```
services/notifications-svc/
├── app/
│   └── main.py          # FastAPI app; POST /notify endpoint
└── pyproject.toml
```

**Key endpoints:**
- `POST /notify` — receive webhook (body: `{ "event_type": "...", "entity": {...} }`)
  - ⚠️ Email dispatch is stub (print only)
  - ⚠️ Slack dispatch is stub (print only)
  - No actual email/Slack delivery
- `GET /health` — health check

**Data access:**
- Optional SQLite for webhook log (schema not defined; not currently used)

**Key limitations:**
- ⚠️ Email and Slack integrations are stubs (only `print()` statements)
- ⚠️ Webhook log schema undefined; no persistence
- No retry on delivery failure
- No validation of event payloads

**Tech stack notes:**
- FastAPI 0.136.1 with Uvicorn
- Pydantic 2.13.4 for validation

---

### Audit Service (Java 11 / Spring Boot 2.7 — *Legacy / Intentionally Vulnerable*)

**Port:** 5005

**Purpose:**
- Append-only audit log for assignment changes
- Query audit events by date range or entity ID

**Module structure:**
```
services/audit-svc/src/main/java/com/contoso/audit/
├── AuditApplication.java    # Spring Boot entry point
├── AuditController.java     # REST endpoints
├── AuditRepository.java     # ⚠️ SQL INJECTION vulnerability
├── DataInit.java            # Schema initialization
└── test/
    └── AuditApplicationTests.java  # Smoke test only
```

**Data model:**
```
audit_events table:
  id INTEGER PRIMARY KEY
  event_type TEXT          # "assignment_created", "assignment_returned", etc.
  entity_type TEXT         # "assignment"
  entity_id INTEGER
  timestamp TEXT           # ISO 8601
  details TEXT             # JSON details
```

**Key endpoints:**
- `POST /events` — append audit event
  - Body: `{ "eventType": "...", "entityType": "...", "entityId": ..., "details": {...} }`
- `GET /events/search` — ⚠️ **SQL injection** (Exercise #3)
  - Query params: `from_date`, `to_date`, `entity_id`
  - AuditRepository.search() concatenates params directly into SQL LIKE clauses
  - `' OR 1=1 --` will bypass filters and return all rows
- `GET /health` — health check

**Data access:**
- **Raw JDBC** via Spring's JdbcTemplate
- ⚠️ **NO prepared statements** → SQL injection vulnerability
- SQLite at path `$AUDIT_DB_PATH` (default: `./data/audit.db`)

**Key limitations:**
- ⚠️ **SQL injection vulnerability** in `AuditRepository.search()` (Exercise #3)
  - Concatenates user input directly into LIKE clauses
  - Example: `WHERE details LIKE '%' + userInput + '%'`
- ⚠️ **Spring Boot 2.7** (EOL Dec 2023)
- ⚠️ **Java 11** (EOL Sep 2026)
- No prepared statements used
- Tests minimal: only smoke test

**Tech stack notes:**
- Spring Boot 2.7.18 (intentionally outdated)
- Java 11 (intentionally outdated)
- Spring JDBC (no ORM)
- SQLite JDBC driver

**Modernization path (Exercise #9):**
- Upgrade Spring Boot to 3.x + Java 21
- Migrate `javax.*` imports to `jakarta.*`
- Update Dockerfile base image
- Run `mvn verify`

---

### Auth Service (Java 11 / Spring Boot 2.7 — *Legacy / Intentionally Vulnerable*)

**Port:** 5006

**Purpose:**
- Issue RS256 JWTs
- Expose JWKS endpoint (public keys for verification)
- User lookup (username/password validation)

**Module structure:**
```
services/auth-svc/src/main/java/com/contoso/auth/
├── AuthApplication.java    # Spring Boot entry point
├── TokenController.java    # JWT issue + JWKS endpoints
├── JwtIssuer.java          # RS256 JWT generation (⚠️ old JJWT)
├── UserRepository.java     # ⚠️ SQL INJECTION vulnerability
├── DataInit.java           # Schema initialization + seeded users
└── test/
    └── AuthApplicationTests.java  # Smoke test only
```

**Data model:**
```
users table:
  id INTEGER PRIMARY KEY
  username TEXT UNIQUE
  password_hash TEXT        # Bcrypt hash (seeded with test data)
  email TEXT
```

**Key endpoints:**
- `POST /token` — issue JWT
  - Body: `{ "username": "...", "password": "..." }`
  - Returns: `{ "access_token": "eyJ...", "token_type": "Bearer" }`
  - RS256 signed with service private key
- `GET /.well-known/jwks` — JWKS (public keys for verification)
  - Returns JWK Set with one RSA public key
  - Other services **should** fetch & cache this to validate JWTs
  - ⚠️ **assets-svc does NOT validate** (Exercise #14)
- `GET /health` — health check

**Data access:**
- **Raw JDBC** via Spring's JdbcTemplate
- ⚠️ **NO prepared statements** → SQL injection vulnerability
- SQLite at path `$AUTH_DB_PATH` (default: `./data/auth.db`)

**Key limitations:**
- ⚠️ **SQL injection vulnerability** in `UserRepository.findByUsername()` (Exercise #3)
  - Concatenates username directly into WHERE clause
  - Example: `WHERE username = '` + username + `'`
- ⚠️ **Spring Boot 2.7** (EOL Dec 2023)
- ⚠️ **Java 11** (EOL Sep 2026)
- ⚠️ **JJWT 0.11.5** (old major version; API changed significantly in newer releases)
- ⚠️ Consumers (**assets-svc**) do NOT validate JWTs (Exercise #14)
- No prepared statements used
- Tests minimal: only smoke test

**Tech stack notes:**
- Spring Boot 2.7.18 (intentionally outdated)
- Java 11 (intentionally outdated)
- Spring JDBC (no ORM)
- JJWT 0.11.5 (io.jsonwebtoken:jjwt-api/impl/jackson)
- SQLite JDBC driver

**Seeded users (from DataInit.java):**
- `alice` / `password123`
- `bob` / `password123`

**Modernization path (Exercise #12):**
- Upgrade Spring Boot to 3.x + Java 21
- Migrate `javax.*` imports to `jakarta.*`
- Upgrade JJWT to newer major version (breaking API changes)
- Update Dockerfile base image
- Run `mvn verify`
- ⚠️ Do NOT break the JSON shape of `GET /.well-known/jwks`

---

## Data Flow Examples

### Example 1: Create Assignment (Happy Path)

```
1. User clicks "Assign Asset" on web (Astro page)
   ↓
2. web → POST http://localhost:5002/assignments
   {
     "employeeId": 123,
     "assetId": 456,
     "assignedDate": "2025-05-20"
   }
   ↓
3. workforce-svc AssignmentService.createAssignment()
   a. Validates employee + asset exist (via repository queries)
   b. Creates Assignment entity
   c. Saves to SQLite
   d. ⚠️ Calls audit-svc (COMMENTED OUT - Exercise #13)
   e. Calls notifications-svc to send webhook
      (no timeout/retry - will fail if svc is down)
   f. Returns 201 Created
   ↓
4. web receives response, re-renders assignments page
```

**Failure modes:**
- If notifications-svc is down → assignment creation fails (no error boundary)
- If audit-svc is down → doesn't matter (hook is commented out)
- If asset_id doesn't exist → 404

---

### Example 2: Search Assets by Tag (Broken Endpoint)

```
1. User tries to GET http://localhost:4321/assets/LAPTOP-001
   ↓
2. web → GET http://localhost:5001/assets/by-tag/LAPTOP-001
   ↓
3. assets-svc
   a. AssetEndpoints.cs has route declared but NOT MAPPED
   b. Returns 404 NotFound (or routes to wrong endpoint)
   ↓
4. web shows "Asset not found"
```

**Fix (Exercise #10):**
- Wire the endpoint in AssetEndpoints.cs
- Query assets table by asset_tag
- Add tests for the endpoint

---

### Example 3: CSV Import (Crash on Bad Row)

```
1. User uploads sample_import.csv
   Row 1: LAPTOP-001, laptop, Dell, XPS 13, ABC123, 2025-01-01, 2027-01-01 ✓
   Row 2: MONITOR-001, monitor, LG, 27UL500, DEF456, 2025-01-01, <malformed date>
   ↓
2. reporting-svc POST /imports/assets
   a. Opens CSV
   b. Iterates rows: row 1 processed OK
   c. Processes row 2
   d. Fails to parse <malformed date>
   e. ⚠️ Crashes entire import (no try/except per row)
   f. Returns 500 Internal Server Error with stack trace
   ↓
3. User sees error; no clear feedback on what failed
```

**Fix (Exercise #6):**
- Wrap row processing in try/except
- Collect errors
- Return: `{ "imported": 1, "skipped": 1, "errors": [{ "row": 2, "reason": "..." }] }`

---

### Example 4: SQL Injection (audit-svc)

```
1. Attacker queries: GET http://localhost:5005/events/search?entity_id=' OR 1=1 --
   ↓
2. audit-svc AuditRepository.search()
   a. Builds SQL: SELECT * FROM audit_events WHERE entity_id LIKE '%' + entity_id + '%'
   b. entity_id = "' OR 1=1 --"
   c. Full SQL: SELECT * FROM audit_events WHERE entity_id LIKE '%' OR 1=1 --'
   d. WHERE clause always true → returns ALL rows
   ↓
3. Attacker sees entire audit log (data leak)
```

**Fix (Exercise #3):**
- Use PreparedStatement with bind parameters
- `String sql = "SELECT * FROM audit_events WHERE entity_id LIKE ?"`;
- `preparedStatement.setString(1, "%" + entity_id + "%")`;

---

## Key Architectural Patterns

### Each Service Owns Its Database
- No shared database
- Services call each other via REST/JSON
- No cross-service transactions (eventual consistency model)

### BFF Pattern (web service)
- web is the only entry point for the UI
- web orchestrates calls to backend services
- Simplifies client-side complexity

### Missing Resilience Patterns
- ⚠️ No timeout on external HTTP calls
- ⚠️ No retry logic
- ⚠️ No circuit breaker
- ⚠️ Cascading failures (if audit-svc is down, services calling it may timeout)

### Auth Token Flow
- auth-svc issues RS256 JWTs
- Other services should validate via JWKS endpoint
- ⚠️ assets-svc does NOT validate (Exercise #14)

### No API Gateway
- Each service has its own port
- web composes calls directly
- No centralized rate limiting, auth enforcement, or logging

---

## Recommended Reading Order for Learners

1. **Understand the Codebase** (Exercise #1)
   - Read this file (ARCHITECTURE.md)
   - Skim each service's README.md
   - Trace 1 user action (e.g., "create assignment") through the code

2. **Pick an exercise based on interest:**
   - **Security** → #3 (SQL injection), #14 (JWT validation)
   - **Modernization** → #4 (Python), #9/#12 (Spring Boot)
   - **Testing** → #2 (xUnit), #11 (pytest)
   - **Features** → #5/#7/#10/#15 (new endpoints, validation)
   - **Bug fixes** → #6/#8 (error handling, UI)

3. **Each exercise is self-contained** — you don't need to complete others first.

---

## Common Commands

```bash
# Start everything
npm run dev

# Start single service (from repo root)
npm run dev:web
npm run dev:assets
npm run dev:workforce
npm run dev:reporting
npm run dev:notifications
npm run dev:audit
npm run dev:auth

# Run tests (per-service)
cd services/assets-svc && dotnet test
cd services/workforce-svc && ./mvnw test
cd services/reporting-svc && pytest tests/

# Build single service
cd services/auth-svc && ../../scripts/with-java11 ./mvnw package
```

---

## Glossary

- **JPA**: Java Persistence API (ORM abstraction)
- **Dapper**: Lightweight .NET ORM (SQL-mapping)
- **FastAPI**: Python async web framework
- **Spring Boot**: Java framework for microservices
- **SQLite**: File-based relational database
- **Swagger/OpenAPI**: API documentation standard
- **CORS**: Cross-Origin Resource Sharing (browser security)
- **JWT**: JSON Web Token (stateless auth)
- **JWKS**: JSON Web Key Set (public keys for JWT verification)
- **Prepared Statement**: SQL query template with bind parameters (prevents SQL injection)
