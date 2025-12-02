'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { zoneApi } from '@/lib/api/zones';
import { SkeletonLoader } from '../shared/SkeletonLoader';
import { ZoneCard } from './ZoneCard';
import { RightDrawer } from '../drawers/RightDrawer';
import { ZoneDrawer } from './ZoneDrawer';

interface ZoneListProps {
  searchTerm?: string;
}

export const ZoneList: React.FC<ZoneListProps> = ({ searchTerm = '' }) => {
  const queryClient = useQueryClient();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedZone, setSelectedZone] = useState<any>(null);
  const [action, setAction] = useState<'create' | 'edit' | null>(null);

  // Fetch zones
  const {
    data: zones,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['zones'],
    queryFn: zoneApi.fetchAll,
  });

  // Filter zones based on search term
  const filteredZones = zones?.filter(zone =>
    zone.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    zone.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (zone.pincodes?.some((pincode: string) => pincode.toLowerCase().includes(searchTerm.toLowerCase())) ?? false)
  ) || [];

  const handleCreateNew = () => {
    setSelectedZone(null);
    setAction('create');
    setIsDrawerOpen(true);
  };

  const handleEdit = (zone: any) => {
    setSelectedZone(zone);
    setAction('edit');
    setIsDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setIsDrawerOpen(false);
    setSelectedZone(null);
    setAction(null);
  };

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['zones'] });
    handleDrawerClose();
  };

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-red-700">Error loading zones: {(error as Error).message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">Zones</h2>
        <button
          onClick={handleCreateNew}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
        >
          Add Zone
        </button>
      </div>

      {/* Zones List */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, index) => (
            <SkeletonLoader key={index} variant="rect" className="h-24" />
          ))}
        </div>
      ) : filteredZones.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
          <p className="text-gray-500 dark:text-gray-400">No zones found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredZones.map((zone) => (
            <ZoneCard
              key={zone.id}
              zone={zone}
              onEdit={handleEdit}
            />
          ))}
        </div>
      )}

      {/* Zone Drawer */}
      <RightDrawer
        isOpen={isDrawerOpen}
        onClose={handleDrawerClose}
      >
        {isDrawerOpen && (
          <ZoneDrawer
            zone={selectedZone}
            action={action}
            onClose={handleDrawerClose}
            onSuccess={handleSuccess}
          />
        )}
      </RightDrawer>
    </div>
  );
};