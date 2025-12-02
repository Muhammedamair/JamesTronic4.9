'use client';

import { Clock } from 'lucide-react';

interface SLAPreviewProps {
  deviceCategory?: string;
}

export const SLAPreview = ({ deviceCategory }: SLAPreviewProps) => {
  const getSLADuration = () => {
    if (!deviceCategory) {
      return 'Standard timeframe applies';
    }

    switch (deviceCategory.toLowerCase()) {
      case 'mobile':
        return '24 hours';
      case 'laptop':
        return '48 hours';
      case 'television':
      case 'microwave':
        return '72 hours';
      default:
        return 'Standard timeframe applies';
    }
  };

  return (
    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 mb-4">
      <div className="flex items-start gap-2">
        <Clock className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
        <div>
          <h3 className="font-semibold text-gray-800 dark:text-white">Service SLA Commitment</h3>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            SLA commitment: <span className="font-semibold">{getSLADuration()}</span> from technician assignment
          </p>
        </div>
      </div>
    </div>
  );
};