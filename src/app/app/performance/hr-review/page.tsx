import HRPerformanceDashboard from '@/components/admin/c23-hr-performance-dashboard';

export const metadata = {
    title: 'HR Review Queue | JamesTronic',
    description: 'Flagged performance packets for HR review — workflow-oriented, not punitive',
};

export default function HRPerformancePage() {
    return <HRPerformanceDashboard />;
}
