# Copilot Instructions for AssetTrack

## Build, test, and lint commands

### Root orchestration
- Install root deps: `npm install`
- Install service deps used by dockerless dev: `npm run install:all`
- Run full local stack (all 7 services): `npm run dev`
- Run full local stack with verbose logs: `npm run dev:verbose`

### web (`services/web`, Astro SSR + React)
- Install deps: `npm install`
- Run dev server: `npm run dev`
- Build: `npm run build`
- Preview production build: `npm run preview`
- Tests/lint: no project test or lint script is defined in `services/web/package.json`

### assets-svc (`services/assets-svc`, .NET 8)
- Run service: `dotnet run`
- Build: `dotnet build`
- Run all tests: `dotnet test`
- Run a single test:
  - By class: `dotnet test --filter "FullyQualifiedName~Contoso.Assets.Tests.AssetsDbTests"`
  - By method: `dotnet test --filter "FullyQualifiedName~Contoso.Assets.Tests.AssetsDbTests.Initialize_creates_assets_table_and_seed_data"`

### workforce-svc (`services/workforce-svc`, Java 21 / Spring Boot 3)
- Run service: `mvn spring-boot:run`
- Build package: `mvn -DskipTests package`
- Run all tests: `mvn test`
- Run a single test class: `mvn -Dtest=WorkforceApplicationTests test`
- Run a single test method: `mvn -Dtest=WorkforceApplicationTests#contextLoads test`

### auth-svc and audit-svc (legacy Java 11 / Spring Boot 2.7)
- Use Java 11 wrapper script from repo root when running locally:
  - `./scripts/with-java11 mvn spring-boot:run`
  - `./scripts/with-java11 mvn -DskipTests package`
- These services currently have no meaningful maintained test suites in this repo.

### reporting-svc (`services/reporting-svc`, FastAPI)
- Install with dev extras: `pip install -e ".[dev]"`
- Run service: `uvicorn app.main:app --reload --port 8080`
- Run tests (when present): `pytest`
- Run a single test (when present): `pytest tests/test_file.py::test_name`
- Lint: `ruff check .`

### notifications-svc (`services/notifications-svc`, FastAPI)
- Install: `pip install -e .`
- Run service: `uvicorn app.main:app --reload --port 8080`
- No repository-defined test/lint command is currently configured.

## High-level architecture

- This repository is a polyglot microservices training app (`AssetTrack`) with one SSR frontend (`web`) and six backend services. Services communicate over REST/JSON and each backend service owns its own SQLite persistence boundary (except `reporting-svc`, which aggregates data from other services over HTTP).
- `web` is an Astro SSR BFF. Data access is server-side via `services/web/src/lib/api/*`; browser code does not call backend services directly.
- Root `npm run dev` is the canonical local workflow. It starts all services as plain processes and wires service URLs and DB paths via environment variables, not Docker networking.
- Auth flow centers on `auth-svc` (`POST /token`, `GET /.well-known/jwks`). Other services are expected to validate JWTs using JWKS, but this is intentionally inconsistent for exercise purposes.
- `workforce-svc` owns assignment lifecycle and calls `notifications-svc` outbound; audit integration exists as a partially wired path intended for course exercises.

## Key codebase conventions

- Mixed Java runtime is intentional:
  - `workforce-svc` runs on Java 21.
  - `auth-svc` and `audit-svc` run on Java 11 and should be started through `scripts/with-java11` when not using the root orchestrator.
- Service URLs are runtime-configured through environment variables (`ASSETS_SVC_URL`, `WORKFORCE_SVC_URL`, `REPORTING_SVC_URL`, `NOTIFICATIONS_SVC_URL`, `AUDIT_SVC_URL`, `AUTH_SVC_URL`). In `web`, use `process.env` access patterns in `src/lib/api/client.ts` to avoid build-time URL baking.
- DB location is environment-variable driven per service (`*_DB_PATH`) with local defaults targeting `/data/*.db`; root dev scripts override these paths into each service’s local `data/` directory.
- This repo intentionally contains “exercise gaps” (security, resilience, modernization, and test coverage). Preserve intentional gaps unless the task explicitly targets them.
