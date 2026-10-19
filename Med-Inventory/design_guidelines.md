# Medical Inventory Management System - Design Guidelines

## Design Philosophy
Professional, clinical, and efficiency-focused interface for pharmacy staff. Prioritize data density, quick scanning, and clear status indicators. The design should inspire trust and accuracy—critical in medical contexts.

## Color Palette

### Primary Colors
- **Primary Blue**: #2563EB (trustworthy, medical)
- **Primary Blue Hover**: #1D4ED8
- **Primary Blue Light**: #DBEAFE (backgrounds, highlights)

### Semantic Colors
- **Success Green**: #10B981 (sufficient stock, confirmations)
- **Warning Orange**: #F59E0B (low stock alerts)
- **Danger Red**: #EF4444 (critical low stock, deletions, expired items)
- **Info Blue**: #3B82F6 (informational messages)

### Neutral Colors
- **Text Primary**: #111827 (headings, labels)
- **Text Secondary**: #6B7280 (descriptions, metadata)
- **Border**: #E5E7EB (dividers, table borders)
- **Background**: #F9FAFB (page background)
- **Surface**: #FFFFFF (cards, modals, tables)

## Typography

### Font Family
- **Primary**: 'Inter' or system-ui fallback
- **Monospace**: 'JetBrains Mono' for batch numbers, IDs

### Scale
- **Page Title**: 32px, font-weight 700, text-gray-900
- **Section Heading**: 24px, font-weight 600, text-gray-900
- **Card Title**: 18px, font-weight 600, text-gray-800
- **Body**: 14px, font-weight 400, text-gray-700
- **Label**: 13px, font-weight 500, text-gray-700
- **Caption**: 12px, font-weight 400, text-gray-500

## Layout Architecture

### Navigation
- **Sidebar Navigation** (fixed left, 240px width):
  - Logo/Brand at top
  - Main navigation items: Dashboard, Products, Companies, Reports
  - Active state: Blue background (#DBEAFE), bold text
  - Hover state: Light gray background (#F3F4F6)
  - Logout at bottom

### Page Structure
- **Container**: Max-width 1440px, centered, padding 32px
- **Page Header**: Title + action button(s) aligned horizontally
- **Content Cards**: White background, 1px border, 8px border-radius, 16px padding

### Responsive Breakpoints
- Desktop: 1024px+
- Tablet: 768px - 1023px (collapsible sidebar)
- Mobile: <768px (hamburger menu)

## Component Specifications

### Dashboard Cards
- **Metric Cards**: 
  - White background, subtle shadow (0 1px 3px rgba(0,0,0,0.1))
  - Large number display: 36px, font-weight 700
  - Label below: 14px, text-gray-600
  - Icon in top-right corner (24px, colored by metric type)
  - Minimum height: 120px

### Data Tables
- **Header Row**: 
  - Background: #F9FAFB
  - Border-bottom: 2px solid #E5E7EB
  - Text: 12px uppercase, font-weight 600, letter-spacing 0.5px, text-gray-600
  - Padding: 12px 16px
- **Data Rows**: 
  - Border-bottom: 1px solid #E5E7EB
  - Padding: 16px
  - Hover: Background #F9FAFB
  - Alternate row striping: Optional (#FAFBFC)
- **Action Icons**: 
  - 20px size, text-gray-400
  - Hover: Primary blue
  - Grouped in last column with 8px spacing

### Forms
- **Input Fields**:
  - Height: 40px
  - Border: 1px solid #D1D5DB
  - Border-radius: 6px
  - Padding: 8px 12px
  - Focus: Blue border (#2563EB), blue ring (0 0 0 3px rgba(37, 99, 235, 0.1))
- **Labels**: 
  - 13px, font-weight 500, margin-bottom 6px
  - Required indicator: Red asterisk after label
- **Dropdowns**: 
  - Same styling as inputs
  - Chevron icon on right
- **Buttons**:
  - Primary: Blue background, white text, 40px height, 16px horizontal padding, 6px border-radius
  - Secondary: White background, gray border, gray text
  - Danger: Red background, white text
  - Hover: Slightly darker shade
  - Disabled: 50% opacity, cursor not-allowed

### Badges & Status Indicators
- **Low Stock Badge**: 
  - Orange background (#FEF3C7), orange text (#D97706)
  - 6px vertical padding, 12px horizontal padding, fully rounded
  - Small text: 12px, font-weight 500
- **Critical Stock**: 
  - Red background (#FEE2E2), red text (#DC2626)
- **Expiry Warning** (within 3 months):
  - Yellow background (#FEF9C3), yellow text (#CA8A04)
  - Display badge next to expiry date

### Search & Filters
- **Search Bar**: 
  - 320px width minimum
  - Magnifying glass icon inside left
  - Placeholder: "Search products..."
  - Clear button (X) appears when typing
- **Filter Dropdown**: 
  - 200px width
  - Icon + "Filter by Company" label
  - Checkboxes for multi-select
  - Apply/Clear buttons at bottom

### Modals & Dialogs
- **Overlay**: rgba(0, 0, 0, 0.5)
- **Modal Container**: 
  - Max-width: 600px for forms, 400px for confirmations
  - Border-radius: 8px
  - Padding: 24px
  - Box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1)
- **Modal Header**: 
  - 20px title, close button (X) in top-right
  - Border-bottom: 1px solid #E5E7EB, padding-bottom 16px
- **Modal Actions**: 
  - Buttons aligned right
  - Cancel (secondary) + Confirm (primary/danger)
  - 12px spacing between buttons

## Interaction Patterns

### Deletion Confirmation
- Always show modal with product name
- Require explicit "Delete" button click
- Use red danger button
- Message: "Are you sure you want to delete [Product Name]? This action cannot be undone."

### Form Validation
- Inline validation on blur
- Error state: Red border, red text below input
- Success state (optional): Green border, checkmark icon
- Submit button disabled until all required fields valid

### Loading States
- Spinner overlay for page/card loads
- Skeleton screens for table initial load
- Button loading: Spinner replaces text, button disabled

### Empty States
- Centered illustration (simple medical icon, grayscale)
- Heading: "No products found"
- Subtext: "Add your first product to get started"
- Primary action button

## Accessibility Requirements

- Minimum touch target: 40x40px
- Color contrast ratio: 4.5:1 for normal text, 3:1 for large text
- Keyboard navigation: Tab through all interactive elements
- Focus indicators: Blue ring visible on all focusable elements
- ARIA labels on icon-only buttons
- Table headers use `<th>` with scope attributes
- Form inputs associated with labels via `for`/`id`

## Animation & Transitions

- Modal fade-in: 200ms ease-out
- Button hover: 150ms ease
- Dropdown expand: 200ms ease
- Page transitions: None (instant)
- Loading spinners: Continuous rotation