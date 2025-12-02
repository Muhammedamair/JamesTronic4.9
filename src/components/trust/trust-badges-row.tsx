'use client';

import { Badge } from '@/components/ui/badge';
import { Shield, UserCheck, Clock, AlertTriangle } from 'lucide-react';

export const TrustBadgesRow = () => {
  return (
    <div className="flex flex-wrap justify-center gap-2 py-4">
      <Badge variant="default" className="flex items-center gap-1">
        <Shield className="w-3 h-3" />
        SLA Protected
      </Badge>
      <Badge variant="default" className="flex items-center gap-1">
        <UserCheck className="w-3 h-3" />
        Verified Techs
      </Badge>
      <Badge variant="default" className="flex items-center gap-1">
        <Clock className="w-3 h-3" />
        Real-Time Updates
      </Badge>
      <Badge variant="default" className="flex items-center gap-1">
        <AlertTriangle className="w-3 h-3" />
        No Silent Delays
      </Badge>
    </div>
  );
};