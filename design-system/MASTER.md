# Antigravity UI/UX Pro Max - Design System Master
**Job ID:** C21_P4_UI_SYSTEM  
**Theme:** ExpansionOS (Glass, Data-Dense, High-Contrast)  
**Framework:** TailwindCSS + Shadcn/UI (Radix) + Recharts

---

## 1. Visual Language
**Philosophy:** "Data-Dense, Trust-Centric."
The Pricing Console is a cockpit for managers. It must feel precise, dangerous if misused, and professional.

### Color Palette (Slate & Violet)
- **Background**: `bg-slate-950` (Dark Mode Default)
- **Surface**: `bg-slate-900/50` (Glass panels)
- **Border**: `border-slate-800`
- **Primary**: `text-violet-400` / `bg-violet-600`
- **Success**: `text-emerald-400` (within guardrails)
- **Warning**: `text-amber-400` (near caps)
- **Danger**: `text-rose-400` (blocked/violation)
- **Muted**: `text-slate-400`

### Typography (Inter/JetBrains Mono)
- **Headings**: Inter, tracking-tight, font-semibold
- **Data/Values**: JetBrains Mono (for currency, IDs, codes)
- **Body**: Inter, text-sm

---

## 2. Layout Structure
**Shell:** Dashboard Layout (Sidebar + Topbar + Main Content)
**Page Container:**
- `max-w-7xl mx-auto p-6 space-y-6`
- **Header**: Title (H1), Breadcrumbs, Actions (Right-aligned)
- **Stats Row**: 3-4 Cards (Key Metrics)
- **Main View**: Data Table / Chart / Form
- **Panel**: Slide-over or Drawer for details (Audit Logs)

---

## 3. UI Patterns (Non-Negotiable)

### A. Tables (Data-Dense)
- **Header**: Sticky, `bg-slate-900/90 backdrop-blur`
- **Rows**: Hover effect `hover:bg-slate-800/50`
- **Cells**: `py-2 px-4 text-sm border-b border-slate-800`
- **Actions**: Dropdown menu (last column)
- **Status Badges**: Small, rounded-full, `px-2 py-0.5 text-xs`

### B. Forms (Append-Only)
- **Input**: `bg-slate-950 border-slate-700 focus:ring-violet-500`
- **Read-Only**: `bg-slate-900/50 text-slate-500 cursor-not-allowed`
- **Validation**: Real-time feedback (Guardrail warnings)
- **Impact Preview**: Show "Before vs After" card before submit

### C. Visual Feedback
- **Toast**: Success/Error notifications (Top-right)
- **Loading**: Skeleton loaders (Pulse) for tables/cards
- **Empty States**: Illustration + "Create First..." CTA

---

## 4. Components Registry

| Component | Usage |
|-----------|-------|
| `PageHeader` | Title + Breadcrumbs + Primary Action |
| `StatsCard` | Metric + Trend + Sparkline |
| `DataTable` | Sortable/Filterable list |
| `StatusBadge` | Color-coded state (Active, Pending, Blocked) |
| `PriceInput` | Currency formatted input (₹) |
| `AuditFeed` | Timeline view of changes |
| `DiffView` | Before/After comparison for updates |

---

## 5. Security & Safety
- **Route Guard**: Block non-managers
## 6. Mandatory Refinements (Non-Negotiable)

### A. Palette & Accessibility
- **Tokens**: Use shadcn CSS variables (don't hardcode colors).
- **Contrast**: `text-slate-400` on `bg-slate-950` must pass WCAG AA.
- **High Contrast Mode**: Toggle class `.high-contrast` ensuring max readability.

### B. Safety First UX
- **Append-Only**: Button label must be "Create Revision," NOT "Edit."
- **City Scope Chip**: Every page header MUST show locked City Chip + Tooltip ("RLS Enforced").
- **Typed Confirmation**: Critical actions (Ruleset Activation) require typing "ACTIVATE vX.Y.Z".

### C. Data Integrity
- **Real Preview**: "Impact Preview" MUST call `POST /api/pricing/quote`; no client-side math.
- **Audit Deep-Links**: Every row dropdown MUST include "View Audit Trail" filtered by ID.
- **Performance**: Server-side pagination + filter persistence in URL (`?page=1&limit=50`). No client-side slicing of big data.
