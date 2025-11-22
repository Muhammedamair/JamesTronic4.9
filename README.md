# JamesTronic - Electronic Repair Management System

## Overview

JamesTronic is a comprehensive Progressive Web Application (PWA) for managing electronic repair services. Built with Next.js, Supabase, and TypeScript, it provides real-time synchronization between admin, technician, and transporter views to facilitate efficient repair workflows.

**Live Site**: [https://jamestronic.com](https://jamestronic.com)
**Build Status**: All TypeScript errors resolved and building successfully

## Features

- ✅ **PWA Ready**: Installable application with offline capabilities
- ✅ **Real-time Ticket Synchronization**: Seamless real-time updates when tickets are assigned, unassigned, or have their status changed
- ✅ **Multi-user Roles**: Admin, Technician, and Transporter role-based access control
- ✅ **Ticket Management**: Create, view, update, and delete service tickets
- ✅ **Customer Management**: Store and manage customer information
- ✅ **Status Tracking**: Comprehensive status tracking for repair workflow
- ✅ **WhatsApp Integration**: Direct WhatsApp communication with customers
- ✅ **Responsive Design**: Mobile-first design that scales to desktop
- ✅ **Supabase Backend**: Secure database with Row Level Security (RLS)
- ✅ **TypeScript**: Full type safety throughout the application
- ✅ **Animations**: Smooth, performant animations with Framer Motion
- ✅ **Mobile-Optimized**: Perfect performance on mobile devices with real-time sync
- ✅ **Domain Deployed**: Live at jamestronic.com with proper DNS configuration

## Architecture

- **Frontend**: Next.js 16.0.1 (App Router), React, TypeScript
- **Styling**: Tailwind CSS, Radix UI primitives
- **State Management**: Zustand for client state, TanStack Query for server state
- **Forms**: React Hook Form + Zod
- **Icons**: Lucide React
- **Animations**: Framer Motion
- **Backend**: Supabase (PostgreSQL, Authentication, Storage, Real-time)
- **PWA**: next-pwa plugin with custom caching strategy
- **Database**: PostgreSQL with Row Level Security

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm/yarn

### Installation

1. **Clone the repository and install dependencies:**

```bash
npm install
```

2. **Set up environment variables:**

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

3. **Run the development server:**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Domain Configuration

- **Production Domain**: jamestronic.com
- **Hosting Platform**: Vercel
- **DNS Setup**:
  - A record: @ → 216.198.79.1
  - CNAME record: www → cname.vercel-dns.com
- **SSL Certificate**: Configured and active
- **Status**: Live and accessible at [https://jamestronic.com](https://jamestronic.com)

## Key Functionalities

### Real-time Ticket Synchronization
- Admin assigns ticket → Appears in technician view in real-time
- Technician updates status → Admin view updates in real-time
- Assignment removal → Disappears from technician view in real-time
- Mobile-optimized for consistent updates across all devices

### Role-Based Access Control
- **Admin**: Full system access, manage all tickets and users
- **Technician**: Access to assigned tickets, update status, view details
- **Transporter**: Track transportation of devices between locations
- **Customer**: Self-service portal to track repair status

### User Registration & Approval System
- **Technician Registration**: New technicians register through the login page and appear in the technician management page for approval
- **Transporter Registration**: New transporters register through the login page and appear in the transporter management page for approval
- **Role-Based Approval**: Each role type has its dedicated approval section for better organization
- **Status Tracking**: Pending, approved, and rejected user statuses are tracked in the system

## Project Structure

```
src/
├── app/                 # Next.js App Router pages
│   ├── app/             # Protected routes (dashboard, tickets, etc.)
│   │   ├── layout.tsx   # Layout for protected routes
│   │   ├── page.tsx     # Dashboard page
│   │   ├── tickets/     # Tickets page
│   │   ├── create/      # Create ticket page
│   │   └── customers/   # Customers page
│   ├── tech/            # Technician portal
│   │   └── jobs/        # Technician jobs page with real-time updates
│   ├── transport/       # Transporter portal
│   ├── login/           # Login page
│   ├── layout.tsx       # Root layout with providers
│   └── page.tsx         # Root redirect page
├── components/          # Reusable UI components
│   ├── supabase-provider.tsx # Supabase client provider
│   └── ui/              # Base UI components
├── lib/                 # Utilities and service functions
│   ├── supabase.ts      # Supabase client and types
│   ├── authenticated-service.ts # Services with authenticated client
│   ├── supabase-service.ts # Supabase service functions
│   ├── whatsapp-template.ts # WhatsApp template utility
│   ├── technician-store.ts # Zustand store for technician state
│   └── utils.ts         # Generic utilities
├── middleware.ts        # Next.js middleware for auth
└── public/              # Static assets
```

## Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon key

## Database Schema

The application uses the following main tables:

- `customers` - Customer information (name, phone, area)
- `tickets` - Service tickets (device info, issue details, status)
- `ticket_status_history` - Status change history
- `action_logs` - Action logs for auditing
- `profiles` - User profiles for authentication
- `pending_technicians` - Pending technician registration requests

## Real-time Architecture

The real-time functionality is implemented using:
1. Supabase Realtime subscriptions for live updates
2. React Query for cache management and optimistic updates
3. Zustand for local state synchronization
4. Fallback polling mechanism for network resilience
5. Mobile-optimized rendering for consistent UX

See `REALTIME_SYNC_ARCHITECTURE.md` for detailed implementation.

## Key UI Components

- `TicketCard` - Display individual service tickets with status
- `StatusPill` - Visual indicator for ticket status
- `ActionBar` - Actions for each ticket (WhatsApp, Call, Edit, Delete)
- `FormField` - Reusable form field with validation
- `EmptyState` - Display when no data is available
- `Skeleton` - Loading placeholders

## WhatsApp Integration

The application includes a robust WhatsApp integration with:

- Predefined message templates for different ticket statuses
- E.164 phone number validation
- Dynamic template filling with customer and ticket data
- Deep linking to WhatsApp with prefilled messages

## Build & Deployment

- **Build Command**: `npm run build` - Compiles successfully with no TypeScript errors
- **Type Safety**: All TypeScript errors have been resolved
- **Deployment**: Successfully deployed to Vercel at jamestronic.com
- **DNS**: Properly configured A and CNAME records for domain
- **SSL**: HTTPS certificate active and functional

## TypeScript Fixes Applied

Recent updates include comprehensive TypeScript error resolution:

- Fixed property access error: ticket.issue_details → ticket.issue_summary
- Simplified error type conversion in UI components
- Added missing type annotations for Supabase real-time callbacks
- Corrected import paths in UI components
- Fixed variable reference: subscribed → isSubscribed
- Resolved ArrayBufferView compatibility for applicationServerKey
- Added proper navigator type assertions for iOS-specific properties
- Corrected component props in HamburgerMenu

## Performance & Quality

- Mobile-first responsive design with thumb-friendly targets
- Performance-optimized animations (120-200ms durations)
- Properly implemented accessibility features
- Real-time updates with proper loading states
- Offline-first approach with queued writes
- PWA features (installable, home screen, offline support)

## Development Notes

- All changes should update documentation in the `/docs` folder
- Follow the design principles outlined in `PROMPTBOOK.json`
- Component variants should use `class-variance-authority`
- Form validation is handled with Zod schemas
- Real-time functionality is documented in `REALTIME_SYNC_ARCHITECTURE.md`

## Documentation

Comprehensive documentation for the JamesTronic project:

- `docs/DOCUMENTATION_OVERVIEW.md` - Complete documentation map and overview
- `docs/BACKEND_ARCHITECTURE.md` - Complete database schema, security policies, and backend architecture
- `docs/FILE_STRUCTURE.md` - Frontend code organization and purpose of each file/directory
- `docs/DEV_GUIDE.md` - Development workflow and best practices
- `docs/UX_GUIDE.md` - UI/UX guardrails and design principles
- `docs/ROLE_BASED_APPROVAL_SYSTEM.md` - Role-based user approval system implementation details
- `REALTIME_SYNC_ARCHITECTURE.md` - Real-time synchronization architecture and implementation details

## Learn More

For more information about the technologies used:

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [TanStack Query Documentation](https://tanstack.com/query)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)