'use client';

import { Shield, User, Clock, Eye } from 'lucide-react';

export const TransparencyBanner = () => {
  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
      <h3 className="font-semibold text-gray-800 dark:text-white mb-2 flex items-center gap-2">
        <Shield className="w-4 h-4 text-blue-600" />
        Full Transparency Promise
      </h3>
      <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
        <li className="flex items-start gap-2">
          <Eye className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <span>You will see your technician live</span>
        </li>
        <li className="flex items-start gap-2">
          <Clock className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <span>We alert you before delays</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0">•</span>
          <span>No silence. Ever.</span>
        </li>
        <li className="flex items-start gap-2">
          <User className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <span>You get full SLA visibility</span>
        </li>
      </ul>
    </div>
  );
};