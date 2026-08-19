---
name: Fotall-Ma PRO
colors:
  surface: '#faf8ff'
  surface-dim: '#d9d9e2'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3fc'
  surface-container: '#ededf6'
  surface-container-high: '#e7e7f1'
  surface-container-highest: '#e1e2eb'
  on-surface: '#191b22'
  on-surface-variant: '#434653'
  inverse-surface: '#2e3037'
  inverse-on-surface: '#f0f0f9'
  outline: '#737784'
  outline-variant: '#c3c6d5'
  surface-tint: '#1d59c1'
  primary: '#003c90'
  on-primary: '#ffffff'
  primary-container: '#0f52ba'
  on-primary-container: '#bcceff'
  inverse-primary: '#b0c6ff'
  secondary: '#505f76'
  on-secondary: '#ffffff'
  secondary-container: '#d0e1fb'
  on-secondary-container: '#54647a'
  tertiary: '#732900'
  on-tertiary: '#ffffff'
  tertiary-container: '#993900'
  on-tertiary-container: '#ffc0a7'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d9e2ff'
  primary-fixed-dim: '#b0c6ff'
  on-primary-fixed: '#001945'
  on-primary-fixed-variant: '#00419c'
  secondary-fixed: '#d3e4fe'
  secondary-fixed-dim: '#b7c8e1'
  on-secondary-fixed: '#0b1c30'
  on-secondary-fixed-variant: '#38485d'
  tertiary-fixed: '#ffdbcd'
  tertiary-fixed-dim: '#ffb596'
  on-tertiary-fixed: '#360f00'
  on-tertiary-fixed-variant: '#7d2d00'
  background: '#faf8ff'
  on-background: '#191b22'
  surface-variant: '#e1e2eb'
  status-pending: '#F59E0B'
  status-progress: '#3B82F6'
  status-ready: '#10B981'
  status-delivered: '#6366F1'
  alert-critical: '#EF4444'
  surface-ticket: '#F8FAFC'
  tenant-accent: var(--primary-color)
typography:
  kpi-display:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '600'
    lineHeight: 38px
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
  data-mono:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  ticket-body:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 18px
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 30px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 8px
  gutter: 16px
  margin-desktop: 24px
  margin-mobile: 16px
  container-max: 1440px
---

## Brand & Style

The design system for this SaaS platform is rooted in **Corporate / Modern** principles with a focus on **Utility-First Minimalism**. As a B2B tool for dry cleaning management, the UI must evoke reliability, precision, and cleanliness.

The visual language prioritizes high-density information architecture to support rapid decision-making in high-frequency retail and logistics environments. The aesthetic is "invisible"—it recedes to let critical KPIs and order statuses lead the user's eye. Every element serves a functional purpose, utilizing subtle elevations and a disciplined grid to organize complex transactional data.

**Key Stylistic Pillars:**

- **Clarity over Decoration:** Use whitespace to separate logical groupings rather than heavy borders.
- **Data-Driven Hierarchy:** Large, clear typography for financial metrics and order counts.
- **Multi-Tenant Flexibility:** The system is designed to be brand-agnostic, allowing tenant-specific primary colors to integrate seamlessly without disrupting the core semantic logic.

## Colors

The color strategy employs a **Semantic Mapping** model. While the primary blue represents the platform's reliability, the true intelligence of the system lies in its status-driven palette.

- **Primary Blue:** Used for navigation, primary actions, and branding. In multi-tenant environments, this hex is replaced by the tenant's brand color.
- **Status Colors:** These are rigid and globally consistent. **Amber (Pending)**, **Blue (Progress)**, **Emerald (Ready)**, and **Indigo (Delivered)** guide the operational flow.
- **Alert Red:** Reserved exclusively for late orders and critical system errors to ensure immediate attention in the "Zone d’alertes."
- **Neutrals:** A range of cool grays (Slate) provides structure without the harshness of pure black, maintaining a clean, professional "sterile" feel.

## Typography

**Inter** is the workhorse of the system, chosen for its exceptional legibility on small screens and high-density data tables.

- **KPI Display:** Large, bold weights are used for the Dashboard's primary counters.
- **Monospacing:** **JetBrains Mono** is utilized for Order IDs, QR code references, and Service Codes (`SRV-01`). This ensures character distinction and alignment in technical contexts.
- **Thermal Print Optimization:** For receipts, use `ticket-body` with increased font weight (500+) to ensure legibility on low-resolution 58mm/80mm thermal printers.
- **Case Usage:** Labels for data headers should be in all-caps with slight letter spacing to differentiate them from interactive data points.

## Layout & Spacing

The system uses an **8px linear scale** for consistent rhythm.

- **Desktop (Web):** A 12-column fluid grid. Dashboards use a "Bento Box" layout where widgets span 3, 6, or 12 columns based on priority.
- **Tablet (Landscape):** The primary operating mode for point-of-sale. Uses a split-screen view: the left side for service selection and the right for the active "basket" or order summary.
- **Mobile (Logistics):** A single-column fluid layout with 16px side margins. Navigation is moved to a bottom bar for thumb-accessibility during scanning tasks.
- **Data Density:** In table views, use "Compact" (32px row height) for historical data and "Default" (48px row height) for active order management to facilitate touch interaction.

## Elevation & Depth

Depth is used sparingly to maintain the clean, "flat" SaaS aesthetic. Hierarchy is established primarily through **Tonal Layering** and **Low-contrast Outlines**.

- **Level 0 (Background):** The base canvas uses a subtle off-white (`#F8FAFC`) to reduce eye strain.
- **Level 1 (Cards/Surface):** White surfaces with a 1px border (`#E2E8F0`). No shadows are used here to keep the data grid crisp.
- **Level 2 (Modals/Quick Action):** Used for "Nouvelle Commande" overlays. These feature a soft, diffused ambient shadow (10% opacity, 16px blur) to pull the user's focus away from the background data.
- **Z-Index Strategy:** Biometric and PIN entry screens occupy the highest layer, utilizing a background blur (12px) to obscure sensitive dashboard data behind the security prompt.

## Shapes

The shape language is **Soft (0.25rem)**, reflecting a professional and structured environment.

- **Standard Elements:** Buttons, input fields, and cards use the base 4px radius.
- **Status Badges:** Use a "Pill" shape (full rounding) to clearly distinguish them as non-interactive status indicators vs. interactive square-ish buttons.
- **Data Inputs:** Fields should have a defined 1px border to ensure they are recognizable as entry points in high-light retail environments.

## Components

### Status Badges & Multi-tenant Tokens

- **Status Badges:** Pill-shaped, small-caps text, using a 10% opacity background of the semantic color with a 100% opacity text color for maximum readability.
- **Tenant Accents:** Elements like the active-state sidebar indicator, primary buttons, and the login logo are mapped to the `tenant-accent` token.

### Transactional UI

- **Order Cards:** Feature a "Header-Body-Footer" structure. Header contains the Order ID in `data-mono`; Body shows items; Footer contains the Status Badge and total price.
- **Digital Receipts:** Emulate the physical thermal ticket layout within the app—centered text, dashed dividers, and high-contrast black text on a `surface-ticket` background.

### Navigation & Inputs

- **Role-Based Navigation:** The sidebar dynamically filters links based on permissions (Admin, Caissier, Livreur). Use 20px monochrome icons with the `primary_color` applied only to the active state.
- **KPI Widgets:** Large cards with a "Trend Indicator" (small green/red arrow) and the `kpi-display` font for the primary value.
- **Search Inputs:** Should always include a "Scan" icon at the trailing edge on mobile/tablet to trigger the camera/barcode reader.
