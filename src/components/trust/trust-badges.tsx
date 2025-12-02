'use client';

import { Badge } from '@/components/ui/badge';
import { Shield, UserCheck, Clock, Eye } from 'lucide-react';

export const TrustBadges = () => {
  return (
    <div className="flex flex-wrap gap-2 mt-4">
      <Badge variant="default" className="flex items-center gap-1">
        <Shield className="w-3 h-3" />
        SLA Protected
      </Badge>
      <Badge variant="default" className="flex items-center gap-1">
        <UserCheck className="w-3 h-3" />
        Trusted Technicians
      </Badge>
      <Badge variant="default" className="flex items-center gap-1">
        <Clock className="w-3 h-3" />
        No Silent Delays
      </Badge>
      <Badge variant="default" className="flex items-center gap-1">
        <Eye className="w-3 h-3" />
        Real-Time Tracking
      </Badge>
    </div>
  );
};