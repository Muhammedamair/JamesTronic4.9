'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PerformanceFiltersProps {
  filters: {
    search: string;
    minScore: number;
    maxScore: number;
  };
  onFiltersChange: (filters: {
    search: string;
    minScore: number;
    maxScore: number;
  }) => void;
}

export const PerformanceFilters: React.FC<PerformanceFiltersProps> = ({
  filters,
  onFiltersChange
}) => {
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({
      ...filters,
      search: e.target.value
    });
  };

  const handleMinScoreChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const min = parseInt(e.target.value) || 0;
    // Ensure min doesn't exceed max
    const newMin = Math.min(min, filters.maxScore);
    onFiltersChange({
      ...filters,
      minScore: newMin
    });
  };

  const handleMaxScoreChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const max = parseInt(e.target.value) || 100;
    // Ensure max isn't less than min
    const newMax = Math.max(max, filters.minScore);
    onFiltersChange({
      ...filters,
      maxScore: newMax
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Filter Technicians</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Search Technicians
          </label>
          <Input
            type="text"
            placeholder="Search by name or email..."
            value={filters.search}
            onChange={handleSearchChange}
            className="w-full"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Min Score: {filters.minScore}%
            </label>
            <Input
              type="number"
              min="0"
              max="100"
              value={filters.minScore}
              onChange={handleMinScoreChange}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max Score: {filters.maxScore}%
            </label>
            <Input
              type="number"
              min="0"
              max="100"
              value={filters.maxScore}
              onChange={handleMaxScoreChange}
              className="w-full"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};