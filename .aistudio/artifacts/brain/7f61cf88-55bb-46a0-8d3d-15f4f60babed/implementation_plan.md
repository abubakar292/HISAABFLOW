# PTA Device Analyzer & Custom Shop Branding Plan

Implement two high-value commercial features for HISAABFLOW to elevate the platform beyond conventional ledger apps: a dedicated **PTA Status & Device IMEI Analyzer** tool section and a **Custom Profile Picture & Shop Logo Upload System** that renders across all printed bills, receipts, and invoices.

## User Review & Critical Decisions

> [!IMPORTANT]
> The architectural decisions below were confirmed in Phase 1 and define the exact scope:

- **Confirmed Decision 1 (PTA & Device Checker)**: Full IMEI Analyzer with instant GSMA TAC specifications lookup (Brand, Model, Release Date, Technology, Dual-SIM check), simulated warranty/activation calculation, plus 1-tap official PTA DIRBS web verification launcher and pre-filled 8484 SMS shortcut.
- **Confirmed Decision 2 (Integration Scope)**: Implemented as a dedicated, standalone tool section accessible from the sidebar and quick actions (`/device-checker` or `/pta-checker`), keeping sales and stock workflows uncluttered.
- **Confirmed Decision 3 (Shop Logo on Receipts)**: Uploaded shop logo replaces monograms across all standard bills, thermal receipts, A4 invoices, and receipt previews.
- **Confirmed Decision 4 (Profile Picture)**: User profile picture support with upload, change, preview, and removal capabilities in both User Account navigation and Settings.

---

## 1. Overview & Core Concept

### Feature 1: Dedicated PTA & Device Verification Center (`/pta-checker`)
- **What It Does**: Provides Pakistani mobile shop owners with a single screen to verify any device by IMEI (15 digits or barcode scanner).
- **Core Capabilities**:
  1. **IMEI TAC & Hardware Analyzer**: Validates IMEI checksum (Luhn algorithm), parses TAC (Type Allocation Code), and reveals device brand, exact model, network generation (4G/5G), and dual-SIM verification.
  2. **Official PTA Verification**: Official PTA DIRBS requires anti-bot captchas; the tool provides a 1-tap direct launcher to the official PTA DIRBS verification portal with copy-to-clipboard, as well as a pre-filled SMS generator for `8484` (Pakistan's official USSD/SMS PTA verification service).
  3. **Activation & Warranty Lookup**: Provides 1-tap direct lookup links to official brand warranty portals (Apple CheckCoverage, Samsung, Xiaomi, Tecno/Carlcare, Infinix, Vivo, Oppo) with model-specific guidance and shop purchase warranty countdown calculator.
  4. **Device Diagnostic Checklist**: Verification summary card that can be copied or shared with customers on WhatsApp ("Device IMEI: 35... | Model: Tecno Camon 30 | Status: PTA Compliant / Official Verification Ready").

### Feature 2: Custom Profile Picture & Shop Logo Management
- **What It Does**: Allows shop owners to upload, preview, crop/scale, and delete both their personal profile avatar and their business shop logo.
- **Bill & Receipt Output**:
  - The uploaded shop logo dynamically embeds as high-resolution branding on standard print bills (`getBillHtml`), in-app receipt previews (`BillPreviewModal`), and thermal receipt headers.
  - User avatar renders gracefully in the top navigation bar, replacing initials when set.
  - Backwards-compatible image compression (optimized WebP/JPEG data URI) ensures instant persistence in Firebase Firestore and Supabase without external storage bucket dependencies.

---

## 2. User Experience & Visual Design

### Key User Flows

#### A. PTA & IMEI Verification Hub
1. User taps **PTA & Device Check** in the sidebar navigation or dashboard quick tools.
2. User types 15 digits or taps the **Barcode/Camera Scanner** icon to scan the phone's box or back panel barcode.
3. System runs instantaneous checksum validation, decodes the brand/model from the TAC database, and displays a comprehensive hardware card.
4. User selects an action:
   - **Launch Official PTA DIRBS Portal**: Opens DIRBS portal with IMEI auto-copied to clipboard.
   - **SMS to 8484**: Opens phone SMS app pre-populated to 8484 with the 15-digit IMEI.
   - **Check Brand Warranty**: 1-click launcher to Apple/Samsung/Carlcare/Xiaomi warranty portals.
   - **Share Device Check Slip**: Formatted WhatsApp message for the customer.

#### B. Shop Logo & Avatar Upload in Settings
1. User navigates to **Store Settings** (`/settings`).
2. Two dedicated visual upload zones:
   - **Shop Logo**: Displays current logo preview or upload dropzone with recommended dimensions (square 250×250px or banner).
   - **Owner Profile Picture**: Circular avatar with quick "Upload New" and "Remove" buttons.
3. User picks an image file from mobile/desktop; client-side image compressor resizes and normalizes the image to <150KB for fast sync.
4. Real-time preview immediately displays how the logo looks on an invoice header.
5. Saving persists the assets to Firestore and Supabase tenant profiles.

### Visual Identity & Theme
- **Color Tokens**: Primary brand `#522D60`, deep plum accent `#140D19`, surface background `#F9FAFB`, and border `#E5E7EB`.
- **Aesthetic**: Utilitarian, clean typography, zero unnecessary pills, generous 44px+ touch targets on mobile.
- **Responsive Layout**: Designed mobile-first to ensure 100% viewport integrity on handheld devices.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Direct PTA Portal & 8484 Integration vs. Scraping Captcha**:
  - *Chosen Approach*: Official PTA DIRBS uses Cloudflare Turnstile and server-side captchas that block automated web scrapers. We provide instant IMEI TAC spec validation + 1-tap clipboard launch to the official DIRBS portal + pre-formatted SMS to 8484 (the most reliable method used by Pakistani shop owners).
  - *Why*: Ensures 100% legal compliance, zero broken scraper downtime, and fast, infallible operation.
- **Decision 2: Client-Side Compressed Image Storage vs. External Cloud Storage**:
  - *Chosen Approach*: Compressed image storage (canvas resize to max 400px, 85% quality WebP/JPEG) stored directly in the `ShopProfile` record (`logoUrl` and `avatarUrl`).
  - *Why*: No additional paid S3/Firebase Storage buckets or billing constraints needed; instantly persists across devices, synchronizes to Supabase and Google Drive backups automatically.

---

## 4. Technical Architecture & Component Hierarchy

```
┌────────────────────────────────────────────────────────┐
│                      HISAABFLOW                        │
│             Mobile POS & Accounting SaaS               │
└───────────────────────────┬────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│     PTA & Device Hub    │     │   Profile & Logo Suite  │
│   (/pta-device-checker) │     │   (/settings + Navbar)  │
├─────────────────────────┤     ├─────────────────────────┤
│ • Luhn 15-Digit Check   │     │ • Client Image Resizer  │
│ • GSMA TAC Specs Match  │     │ • Avatar Cropper & Drop │
│ • 8484 SMS Deep Link    │     │ • Bill/Receipt Preview  │
│ • Official DIRBS Link   │     │ • Dual DB Sync          │
│ • Brand Warranty Engine │     │   (Firestore+Supabase)  │
└─────────────────────────┘     └───────────┬─────────────┘
                                            │
                                            ▼
                                ┌─────────────────────────┐
                                │   Print & Invoice Sub   │
                                │   • getBillHtml()       │
                                │   • BillPreviewModal    │
                                │   • Thermal ESC/POS     │
                                └─────────────────────────┘
```

### Component & File Strategy
- **New Page**: `/src/pages/PtaDeviceCheckerPage.tsx`
  - Integrated IMEI scanner, TAC lookup tables for major brands (Apple, Samsung, Tecno, Infinix, Xiaomi, Vivo, Oppo, Realme, etc.), official PTA DIRBS button, 8484 SMS launcher, and brand warranty links.
- **Route & Navigation Updates**:
  - Add `/pta-device-checker` route to `src/App.tsx`.
  - Add "PTA & Device Check" item with `ShieldCheck` icon to `src/components/layout/Sidebar.tsx`.
  - Add shortcut card to `src/pages/DashboardPage.tsx`.
- **Profile & Logo Updates**:
  - Update `src/utils/multiTenantService.ts` to include `avatarUrl?: string` on `ShopProfile`.
  - Update `src/pages/SettingsPage.tsx` with dedicated Shop Logo and Profile Photo uploaders, image compression utility, live bill header preview, and remove actions.
  - Update `src/components/layout/Navbar.tsx` to render user avatar image when present (with fallback to initials).
  - Update `src/utils/printBill.ts` and `src/components/ui/BillPreviewModal.tsx` to ensure the uploaded logo is passed and rendered on all bills.
- **Verification**:
  - Run `lint_applet` (`tsc --noEmit`) to verify zero TypeScript errors.
  - Run `compile_applet` (`npm run build`) to ensure production build passes cleanly.
