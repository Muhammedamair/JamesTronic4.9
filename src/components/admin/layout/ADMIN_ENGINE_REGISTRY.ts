/**
 * ADMIN ENGINE REGISTRY
 * =====================
 * Single source of truth for all admin sidebar navigation.
 * 
 * Rules:
 * 1. All hrefs MUST be /admin/... (no /app/... mixing)
 * 2. Sidebar renders ONLY from this registry
 * 3. Engines are grouped by functional area
 * 4. Role gating is enforced in UI and server middleware
 */

export type AdminRole = 'superadmin' | 'admin' | 'manager' | 'staff' | 'agent' | 'technician' | 'transporter' | 'dealer';

export type EngineStatus = 'live' | 'stub' | 'hidden';

export type EngineGroup = 'Core' | 'Operations' | 'Finance' | 'Intelligence' | 'Security' | 'Knowledge' | 'System';

export interface AdminEngine {
    id: string;
    label: string;
    href: string;          // MUST be /admin/...
    group: EngineGroup;
    minRole: AdminRole;    // Minimum role required to see this engine
    status: EngineStatus;
    icon: string;          // Lucide icon name
    description?: string;
}

/**
 * Complete list of Admin Engines
 * Organized by functional group for sidebar rendering
 */
export const ADMIN_ENGINES: AdminEngine[] = [
    // ============================================================================
    // CORE - Available to most roles
    // ============================================================================
    {
        id: 'dashboard',
        label: 'Dashboard',
        href: '/admin',
        group: 'Core',
        minRole: 'agent',
        status: 'live',
        icon: 'LayoutDashboard',
        description: 'Admin overview and KPIs',
    },
    {
        id: 'customers',
        label: 'Customers',
        href: '/admin/customers',
        group: 'Core',
        minRole: 'agent',
        status: 'live',
        icon: 'Users',
        description: 'Customer management',
    },

    // ============================================================================
    // OPERATIONS - Workforce and logistics
    // ============================================================================
    {
        id: 'inventory',
        label: 'Inventory',
        href: '/admin/inventory',
        group: 'Operations',
        minRole: 'staff',
        status: 'live',
        icon: 'Package',
        description: 'Parts and stock management',
    },
    {
        id: 'dealers',
        label: 'Dealers',
        href: '/admin/dealers',
        group: 'Operations',
        minRole: 'manager',
        status: 'live',
        icon: 'Building2',
        description: 'Dealer network management',
    },
    {
        id: 'logistics',
        label: 'Logistics',
        href: '/admin/logistics',
        group: 'Operations',
        minRole: 'manager',
        status: 'live',
        icon: 'Truck',
        description: 'Delivery and transport',
    },
    {
        id: 'supply-chain',
        label: 'Supply Chain',
        href: '/admin/supply-chain',
        group: 'Operations',
        minRole: 'manager',
        status: 'live',
        icon: 'Link',
        description: 'Supply chain visibility',
    },
    {
        id: 'dark-stores',
        label: 'Dark Stores',
        href: '/admin/dark-stores',
        group: 'Operations',
        minRole: 'manager',
        status: 'live',
        icon: 'Warehouse',
        description: 'Micro-fulfillment centers',
    },
    {
        id: 'workforce',
        label: 'Workforce',
        href: '/admin/workforce',
        group: 'Operations',
        minRole: 'manager',
        status: 'live',
        icon: 'HardHat',
        description: 'Technician and transporter management',
    },
    {
        id: 'scheduling',
        label: 'Scheduling',
        href: '/admin/scheduling',
        group: 'Operations',
        minRole: 'staff',
        status: 'live',
        icon: 'Calendar',
        description: 'Appointment scheduling',
    },
    {
        id: 'call-center',
        label: 'Call Center',
        href: '/admin/call-center',
        group: 'Operations',
        minRole: 'agent',
        status: 'live',
        icon: 'Headphones',
        description: 'Call center operations',
    },

    // ============================================================================
    // FINANCE - Revenue, pricing, settlements
    // ============================================================================
    {
        id: 'finance',
        label: 'Finance',
        href: '/admin/finance',
        group: 'Finance',
        minRole: 'manager',
        status: 'live',
        icon: 'Banknote',
        description: 'Financial overview',
    },
    {
        id: 'revenue',
        label: 'Revenue',
        href: '/admin/revenue',
        group: 'Finance',
        minRole: 'manager',
        status: 'live',
        icon: 'TrendingUp',
        description: 'Revenue tracking',
    },
    {
        id: 'pricing',
        label: 'Pricing',
        href: '/admin/pricing',
        group: 'Finance',
        minRole: 'admin',
        status: 'live',
        icon: 'Tags',
        description: 'Dynamic pricing engine',
    },
    {
        id: 'expansion',
        label: 'Expansion',
        href: '/admin/expansion',
        group: 'Finance',
        minRole: 'admin',
        status: 'live',
        icon: 'MapPin',
        description: 'Market expansion planning',
    },

    // ============================================================================
    // INTELLIGENCE - AI, predictions, analytics
    // ============================================================================
    {
        id: 'ai-brain',
        label: 'AI Brain',
        href: '/admin/ai-brain',
        group: 'Intelligence',
        minRole: 'admin',
        status: 'live',
        icon: 'Brain',
        description: 'AI decision engine',
    },
    {
        id: 'assistant',
        label: 'Assistant',
        href: '/admin/assistant',
        group: 'Intelligence',
        minRole: 'staff',
        status: 'live',
        icon: 'Bot',
        description: 'AI assistant interface',
    },
    {
        id: 'predictions',
        label: 'Predictions',
        href: '/admin/predictions',
        group: 'Intelligence',
        minRole: 'manager',
        status: 'live',
        icon: 'LineChart',
        description: 'Demand and trend predictions',
    },
    {
        id: 'performance',
        label: 'Performance',
        href: '/admin/performance',
        group: 'Intelligence',
        minRole: 'manager',
        status: 'live',
        icon: 'Activity',
        description: 'Performance analytics',
    },

    // ============================================================================
    // SECURITY - Compliance, fraud, access control
    // ============================================================================
    {
        id: 'security',
        label: 'Security',
        href: '/admin/security',
        group: 'Security',
        minRole: 'admin',
        status: 'live',
        icon: 'Shield',
        description: 'Security dashboard',
    },
    {
        id: 'security-events',
        label: 'Security Events',
        href: '/admin/security-events',
        group: 'Security',
        minRole: 'admin',
        status: 'live',
        icon: 'ShieldAlert',
        description: 'Security event log',
    },
    {
        id: 'fraud',
        label: 'Fraud Detection',
        href: '/admin/fraud',
        group: 'Security',
        minRole: 'admin',
        status: 'live',
        icon: 'AlertTriangle',
        description: 'Fraud monitoring',
    },
    {
        id: 'compliance',
        label: 'Compliance',
        href: '/admin/compliance',
        group: 'Security',
        minRole: 'admin',
        status: 'live',
        icon: 'FileCheck',
        description: 'Regulatory compliance',
    },

    // ============================================================================
    // KNOWLEDGE - Guides, skills, documentation
    // ============================================================================
    {
        id: 'repair-guides',
        label: 'Repair Guides',
        href: '/admin/repair-guides',
        group: 'Knowledge',
        minRole: 'staff',
        status: 'live',
        icon: 'BookOpen',
        description: 'Repair documentation',
    },
    {
        id: 'skills',
        label: 'Skills Matrix',
        href: '/admin/skills',
        group: 'Knowledge',
        minRole: 'manager',
        status: 'live',
        icon: 'Award',
        description: 'Technician skills tracking',
    },

    // ============================================================================
    // SYSTEM - Infrastructure, uptime, notifications
    // ============================================================================
    {
        id: 'uptime',
        label: 'Uptime',
        href: '/admin/uptime',
        group: 'System',
        minRole: 'admin',
        status: 'live',
        icon: 'Server',
        description: 'System health monitoring',
    },
    {
        id: 'notifications',
        label: 'Notifications',
        href: '/admin/notifications',
        group: 'System',
        minRole: 'staff',
        status: 'live',
        icon: 'Bell',
        description: 'Notification management',
    },
];

/**
 * Get engines filtered by role
 */
export function getEnginesForRole(role: AdminRole | null | undefined): AdminEngine[] {
    if (!role) {
        // Fallback: show nothing if role is missing
        return [];
    }

    const roleHierarchy: Record<AdminRole, number> = {
        superadmin: 100,
        admin: 90,
        manager: 70,
        staff: 50,
        agent: 40,
        technician: 30,
        transporter: 20,
        dealer: 10,
    };

    const userLevel = roleHierarchy[role] || 0;

    return ADMIN_ENGINES.filter((engine) => {
        if (engine.status === 'hidden') return false;
        const requiredLevel = roleHierarchy[engine.minRole] || 0;
        return userLevel >= requiredLevel;
    });
}

/**
 * Get engines grouped by category
 */
export function getEnginesGrouped(role: AdminRole | null | undefined): Record<EngineGroup, AdminEngine[]> {
    const engines = getEnginesForRole(role);
    const groups: Record<EngineGroup, AdminEngine[]> = {
        Core: [],
        Operations: [],
        Finance: [],
        Intelligence: [],
        Security: [],
        Knowledge: [],
        System: [],
    };

    engines.forEach((engine) => {
        groups[engine.group].push(engine);
    });

    return groups;
}

/**
 * Group order for sidebar rendering
 */
export const ENGINE_GROUP_ORDER: EngineGroup[] = [
    'Core',
    'Operations',
    'Finance',
    'Intelligence',
    'Security',
    'Knowledge',
    'System',
];

/**
 * Group display names and icons
 */
export const ENGINE_GROUP_META: Record<EngineGroup, { label: string; icon: string }> = {
    Core: { label: 'Core', icon: 'Home' },
    Operations: { label: 'Operations', icon: 'Settings' },
    Finance: { label: 'Finance', icon: 'Wallet' },
    Intelligence: { label: 'Intelligence', icon: 'Sparkles' },
    Security: { label: 'Security', icon: 'Lock' },
    Knowledge: { label: 'Knowledge', icon: 'BookOpen' },
    System: { label: 'System', icon: 'Cog' },
};
