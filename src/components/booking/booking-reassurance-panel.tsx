'use client';

import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, MessageCircle, Clock } from 'lucide-react';

export const BookingReassurancePanel = () => {
  return (
    <Card className="bg-gradient-to-r from-green-50 to-teal-50 dark:from-green-900/20 dark:to-teal-900/20 border-green-200 dark:border-green-800 mt-6">
      <CardContent className="p-6">
        <div className="text-center">
          <h3 className="font-semibold text-lg text-gray-800 dark:text-white mb-3">You're in Safe Hands</h3>
          <div className="space-y-3">
            <div className="flex items-start justify-center gap-2">
              <MessageCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <p className="text-gray-700 dark:text-gray-300 text-sm">
                You get updates before problems happen.
              </p>
            </div>
            <div className="flex items-start justify-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <p className="text-gray-700 dark:text-gray-300 text-sm">
                Delays are shown, not hidden.
              </p>
            </div>
            <div className="flex items-start justify-center gap-2">
              <Clock className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <p className="text-gray-700 dark:text-gray-300 text-sm">
                You're not left guessing here.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};