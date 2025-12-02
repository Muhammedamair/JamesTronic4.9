'use client';

import { Card, CardContent } from '@/components/ui/card';

export const TruthPromiseBlock = () => {
  return (
    <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800 mb-6">
      <CardContent className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <h3 className="font-semibold text-gray-800 dark:text-white mb-2">Transparent Delays</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              We show delays as they happen.
            </p>
          </div>
          <div className="text-center">
            <h3 className="font-semibold text-gray-800 dark:text-white mb-2">Proactive Updates</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              We notify before you ask.
            </p>
          </div>
          <div className="text-center">
            <h3 className="font-semibold text-gray-800 dark:text-white mb-2">Honest Solutions</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              We don't hide problems. We solve them.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};