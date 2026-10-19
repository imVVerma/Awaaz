# MedStock - Medical Inventory Management System

## Overview

MedStock is a cross-platform medical inventory management application built with React Native (Expo) for the frontend and Express.js for the backend. The app helps pharmacy staff track products, manage stock levels, monitor expiring items, and maintain company/supplier records. It runs as a mobile app (iOS/Android) and web application from a single codebase.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React Native with Expo SDK 54
- Uses Expo's managed workflow with the new architecture enabled
- File-based navigation using React Navigation (native stack + bottom tabs)
- State management via TanStack Query (React Query) for server state

**Directory Structure**:
- `client/` - All frontend code
- `client/screens/` - Screen components (Dashboard, Products, Companies, etc.)
- `client/components/` - Reusable UI components
- `client/navigation/` - Stack and tab navigators
- `client/hooks/` - Custom React hooks (theming, screen options)
- `client/lib/` - API client and query configuration
- `client/constants/` - Theme colors, spacing, typography

**Theming**: Custom theme system supporting light/dark modes with medical-professional color palette (primary blue #2563EB, semantic colors for stock status)

**Key Libraries**:
- React Native Reanimated for animations
- React Native Gesture Handler for touch interactions
- Expo Vector Icons (Feather icons)
- Keyboard Controller for form handling

### Backend Architecture

**Framework**: Express.js with TypeScript
- REST API serving JSON responses
- CORS configured for Replit domains
- Static file serving for production builds

**Database**: SQLite using better-sqlite3
- Local file-based database stored in `data/inventory.db`
- WAL mode enabled for better concurrency
- Schema defined directly in `server/db.ts` (not using Drizzle migrations for SQLite)

**Database Tables**:
- `companies` - Supplier/manufacturer records
- `products` - Inventory items with stock levels, pricing, expiry dates
- `inventory_transactions` - Stock movement history

**API Endpoints** (in `server/routes.ts`):
- `GET /api/dashboard/stats` - Dashboard metrics
- `GET/POST /api/companies` - Company CRUD
- `GET/POST /api/products` - Product CRUD with company joins
- `GET /api/products/low-stock` - Products below minimum level

### Shared Code

The `shared/` directory contains:
- `types.ts` - TypeScript interfaces for API data (Company, Product, DashboardStats)
- `schema.ts` - Drizzle schema definitions (currently only users table, prepared for PostgreSQL migration)

### Path Aliases

Configured in both `tsconfig.json` and `babel.config.js`:
- `@/*` → `./client/*`
- `@shared/*` → `./shared/*`

## External Dependencies

### Database
- **SQLite** (better-sqlite3) - Local file storage at `data/inventory.db`
- **Drizzle ORM** - Configured for PostgreSQL but SQLite is currently used directly. Drizzle config (`drizzle.config.ts`) expects `DATABASE_URL` for future PostgreSQL migration.

### Build & Development
- **Expo CLI** - Development server and builds
- **tsx** - TypeScript execution for server
- **esbuild** - Server bundling for production

### Environment Variables
- `EXPO_PUBLIC_DOMAIN` - API server domain for client requests
- `REPLIT_DEV_DOMAIN` - Replit development domain
- `DATABASE_URL` - PostgreSQL connection string (for future migration, currently not required)

### Key NPM Packages
- `@tanstack/react-query` - Server state management
- `expo-blur`, `expo-glass-effect` - iOS visual effects
- `react-native-keyboard-controller` - Keyboard-aware form handling
- `zod` - Schema validation (available but not heavily used yet)

## App Features (Phase 1)

### Dashboard Screen
- Displays summary statistics: Total Products, Companies, Low Stock Count, Expiring Soon Count
- Shows list of low stock products with quick view
- Tap on Low Stock card to view all low stock items

### Companies Management
- List view of all companies with product count
- Add new company with name and optional contact info
- Delete companies (also deletes associated products)
- Search companies by name or contact info

### Products Management
- List view of all products with company name, batch number, stock status
- Add/Edit products with full form validation
- Filter products by company
- Search products by name, composition, or batch number
- Stock level badges (green for in-stock, orange for low stock, red for out of stock)
- Expiry date warnings (yellow for expiring soon, red for expired)
- Delete products with confirmation

### Product Data Fields
- Company (required, dropdown)
- Product Name (required)
- Composition (optional)
- Batch Number (required)
- Expiry Date (required, YYYY-MM-DD format)
- MRP and Purchase Price (required, positive numbers)
- Stock Quantity (required, non-negative)
- Minimum Stock Level (required, default 10)

## Recent Changes

### December 2024
- Initial Phase 1 implementation completed
- SQLite database setup with companies, products, and inventory_transactions tables
- Full CRUD API for companies and products
- Dashboard with statistics and low stock alerts
- Company management screens (list, add, delete)
- Product management screens (list, add, edit, delete, search, filter)
- Form validation on both frontend and backend
- Theme system with light/dark mode support