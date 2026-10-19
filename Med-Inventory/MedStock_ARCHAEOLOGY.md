# MedStock Archaeology Report

## Project Analysis

**1. What is this project?**
MedStock is a cross-platform medical inventory management application.

**2. What problem was it intended to solve?**
It was designed to help pharmacy staff efficiently track medical products, manage stock levels, monitor expiring items, and maintain company/supplier records.

**3. What evidence in the code supports that interpretation?**
The `replit.md` file explicitly states these features as part of the Phase 1 implementation. Furthermore, the `design_guidelines.md` emphasizes a "professional, clinical, and efficiency-focused interface for pharmacy staff," highlighting critical UI states for low stock (orange badges) and expiring items (yellow/red warnings).

**4. What are the main technologies used?**
- **Frontend:** React Native (Expo)
- **Backend:** Express.js with TypeScript
- **Database:** SQLite (via `better-sqlite3`)
- **State Management:** TanStack Query (React Query)

**5. What is the architecture?**
It follows a decoupled Client-Server architecture. The frontend is a React Native app managed by Expo that runs on mobile or web. It communicates with a backend REST API built in Express.js, which in turn reads and writes to a local SQLite database.

**6. What are the major components?**
- `client/`: Contains all frontend React Native code (screens, components, navigation).
- `server/`: Contains the Express API and direct SQLite database interaction logic.
- `shared/`: Contains shared TypeScript types and Drizzle schemas.
- `data/`: Houses the local `inventory.db` SQLite database file.

**7. What is the data flow?**
The React Native client uses TanStack Query to send HTTP requests to the Express API. The backend processes these requests, queries the SQLite database using `better-sqlite3`, and returns JSON responses back to the client to update the UI.

**8. What can the current implementation actually do?**
Based on Phase 1 documentation, the app features a dashboard with summary statistics and low stock alerts. It supports full CRUD (Create, Read, Update, Delete) operations for companies and products, includes searching and filtering capabilities, and displays visual badges for stock status and expiry warnings.

**9. What appears unfinished?**
While Drizzle ORM and Zod are installed and partially configured (e.g., `drizzle.config.ts`), the backend currently uses direct SQLite queries instead of Drizzle migrations. The documentation notes that Zod is "available but not heavily used yet." Additionally, a `users` table exists in the schema, but authentication has not been implemented.

**10. What appears broken?**
There is no explicit evidence of broken features in the documentation; it appears to be a functional "Phase 1" release.

**11. What appears to be experimental/prototype code?**
The Drizzle configuration and PostgreSQL environment variables (`DATABASE_URL`) act as preparatory/experimental code for a planned migration, as the app currently relies entirely on a local SQLite file. The inclusion of `groq-sdk` in `package.json` suggests experimental AI features might have been explored.

**12. What external APIs/services does it depend on?**
Currently, it depends entirely on local services (local API and SQLite). There are no active external database or API dependencies required for Phase 1.

**13. What configuration or environment variables does it require?**
- `EXPO_PUBLIC_DOMAIN`: API server domain for client requests.
- `REPLIT_DEV_DOMAIN`: Replit development domain.
- `DATABASE_URL`: Connection string for future PostgreSQL migration.

**14. How would I run it locally?**
You would run `npm run all:dev`, which concurrently starts the Expo development server and the Express backend using `tsx`.

**15. What would I see if it runs successfully?**
You would see the Expo bundler terminal output. Upon opening the app, you would see a clinical-themed (blue, white, gray) interface featuring a Dashboard with metric cards, and navigation tabs to manage Products and Companies.

**16. What are the most important files and what does each do?**
- `package.json`: Defines project dependencies and essential run scripts (e.g., `all:dev`).
- `app.json`: Expo configuration, detailing app metadata, icons, and platform settings.
- `replit.md`: The primary documentation outlining architecture, features, and recent changes.
- `design_guidelines.md`: Defines the visual language, typography, colors, and layout rules for the app.
- `server/db.ts` & `server/routes.ts`: Core backend logic and API endpoints.

**17. Is there evidence of the original motivation or design decisions?**
Yes. `design_guidelines.md` extensively documents the motivation to build a UI that "inspires trust and accuracy—critical in medical contexts." `replit.md` also documents architectural decisions, like using WAL mode for SQLite for better concurrency.

**18. What technical concepts was I probably trying to learn?**
You were likely learning how to structure a full-stack monorepo, build cross-platform mobile/web apps using React Native and Expo, manage server state with TanStack Query, and plan for database scalability (transitioning from SQLite to PostgreSQL via Drizzle ORM).

**19. What would be required to turn this into a clean, presentable project?**
You would need to complete the migration to PostgreSQL using Drizzle ORM, fully implement Zod for robust input validation, add user authentication and authorization, and introduce automated tests.

**20. What would you recommend I do with it?**
**Finish**. The project has a solid foundation, clear design guidelines, and a functional Phase 1. Completing the ORM migration and adding auth would make it a strong portfolio piece or a viable SaaS product.

---

## Final Deliverables

### A. 5-Sentence Explanation
MedStock is a cross-platform medical inventory management system designed for pharmacy staff. It allows users to track medical products, manage supplier details, and monitor stock levels in real-time. Built with React Native and Expo, it provides a consistent, professional interface across mobile and web platforms. The backend is powered by Express.js and SQLite, ensuring fast and reliable local data management. It features visual alerts for low stock and expiring items to prevent inventory shortages and waste.

### B. Suggested GitHub README Structure
1. **Title and Badge:** Project name, logo, and build/status badges.
2. **Overview:** A brief description of the project and its primary use case.
3. **Features:** Highlight key capabilities (Dashboard, Stock Alerts, Expiry Warnings, Cross-platform).
4. **Tech Stack:** List the frontend, backend, and database technologies.
5. **Getting Started:** Prerequisites and installation instructions (e.g., `npm install`, `npm run all:dev`).
6. **Environment Variables:** Explanation of `.env` requirements (`EXPO_PUBLIC_DOMAIN`, etc.).
7. **Architecture & Database:** Brief overview of the client-server setup and SQLite schema.
8. **Future Roadmap:** Planned features like PostgreSQL migration, Drizzle integration, and authentication.
9. **License & Contributing:** Standard open-source boilerplate.

### C. 5 Most Important Things to Understand
1. **Monorepo Setup:** The repository holds both the React Native frontend (`client/`) and the Express backend (`server/`), which are run concurrently.
2. **Database State:** The app currently relies on a local SQLite file (`data/inventory.db`) with raw queries, not the configured Drizzle ORM.
3. **State Management:** The frontend relies heavily on TanStack Query to manage server state and cache API responses.
4. **Design System:** There is a strict, documented design language (`design_guidelines.md`) centered around a clinical blue theme and specific UI/UX patterns.
5. **Phase 1 Completion:** The current code represents a completed "Phase 1" MVP focusing on core CRUD operations and basic alerts, without authentication.

### D. Unanswered Questions
- What was the intended use case for the `groq-sdk` dependency (AI integration)?
- Is there a specific PostgreSQL hosting provider intended for the future migration?
- How should database backups be handled given it currently uses local SQLite?
- Was authentication meant to be built in-house or integrated via a third-party provider like Clerk or Firebase?
