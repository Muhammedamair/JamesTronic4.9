'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Smartphone, Monitor, Tv } from 'lucide-react';

interface ExpectationPanelProps {
  deviceCategory?: string;
}

export const ExpectationPanel = ({ deviceCategory }: ExpectationPanelProps) => {
  // Determine the appropriate SLA based on device category
  const getSLAInfo = () => {
    if (!deviceCategory) {
      return {
        title: 'Service Timeframe',
        description: 'Service timeframes vary by device category. Standard SLAs apply.',
        icon: <Clock className="w-5 h-5" />
      };
    }

    switch (deviceCategory.toLowerCase()) {
      case 'mobile':
        return {
          title: 'Mobile Repair',
          description: '24 hours SLA from technician assignment',
          icon: <Smartphone className="w-5 h-5" />
        };
      case 'laptop':
        return {
          title: 'Laptop Repair',
          description: '48 hours SLA from technician assignment',
          icon: <Monitor className="w-5 h-5" />
        };
      case 'television':
      case 'microwave':
        return {
          title: 'TV / Large Appliance',
          description: '72 hours SLA from technician assignment',
          icon: <Tv className="w-5 h-5" />
        };
      default:
        return {
          title: 'Service Timeframe',
          description: 'Standard SLA applies based on device type',
          icon: <Clock className="w-5 h-5" />
        };
    }
  };

  const slaInfo = getSLAInfo();

  return (
    <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          {slaInfo.icon}
          What to Expect After Booking
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-gray-700 dark:text-gray-300">
          <span className="font-semibold">{slaInfo.title}:</span> {slaInfo.description}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
          You'll receive real-time updates on your repair progress via our tracking system.
        </p>
      </CardContent>
    </Card>
  );
};