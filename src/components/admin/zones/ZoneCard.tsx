'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MoreVertical, Pencil, Trash2 } from 'lucide-react';

interface ZoneCardProps {
  zone: {
    id: string;
    name: string;
    description: string | null;
    pincodes: string[] | null;
    created_at: string;
  };
  onEdit: (zone: any) => void;
}

export const ZoneCard: React.FC<ZoneCardProps> = ({ zone, onEdit }) => {
  const handleEdit = () => {
    onEdit(zone);
  };

  return (
    <Card className="border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg font-medium text-gray-900 dark:text-white">
            {zone.name}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleEdit}
            className="h-8 w-8 p-0"
            aria-label="Edit zone"
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
          {zone.description || 'No description provided'}
        </p>
        
        <div className="mb-3">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Pincodes</p>
          {zone.pincodes && zone.pincodes.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {zone.pincodes.slice(0, 5).map((pincode, index) => (
                <span 
                  key={index}
                  className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded"
                >
                  {pincode}
                </span>
              ))}
              {zone.pincodes.length > 5 && (
                <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded">
                  +{zone.pincodes.length - 5} more
                </span>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 italic">No pincodes assigned</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};