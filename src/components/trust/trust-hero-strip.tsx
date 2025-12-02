'use client';

import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, Shield, UserCheck, Package } from 'lucide-react';

export const TrustHeroStrip = () => {
  return (
    <div className="flex flex-wrap justify-center gap-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800">
      <div className="flex items-center gap-1">
        <CheckCircle className="w-4 h-4 text-green-600" />
        <span className="text-sm">No silence. No guessing.</span>
      </div>
      <div className="flex items-center gap-1">
        <Clock className="w-4 h-4 text-blue-600" />
        <span className="text-sm">Live tracking.</span>
      </div>
      <div className="flex items-center gap-1">
        <Shield className="w-4 h-4 text-blue-600" />
        <span className="text-sm">SLA protected.</span>
      </div>
      <div className="flex items-center gap-1">
        <UserCheck className="w-4 h-4 text-green-600" />
        <span className="text-sm">Verified technicians.</span>
      </div>
    </div>
  );
};