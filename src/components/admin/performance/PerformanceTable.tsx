'use client';

import React, { useState, useEffect } from 'react';
import { PerformanceRecord, performanceAPI } from '@/lib/api/performance';
import { PerformanceCard } from './PerformanceCard';
import { PerformanceFilters } from './PerformanceFilters';
import { motion, AnimatePresence } from 'framer-motion';

interface PerformanceTableProps {
  initialData?: PerformanceRecord[];
}

export const PerformanceTable: React.FC<PerformanceTableProps> = ({ 
  initialData = [] 
}) => {
  const [performances, setPerformances] = useState<PerformanceRecord[]>(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: keyof PerformanceRecord; direction: 'asc' | 'desc' }>({
    key: 'score',
    direction: 'desc'
  });
  const [filters, setFilters] = useState({
    search: '',
    minScore: 0,
    maxScore: 100,
  });

  // Fetch data from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await performanceAPI.getPerformances(
          sortConfig.key,
          sortConfig.direction
        );
        setPerformances(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching performance data:', err);
        setError('Failed to fetch performance data');
      } finally {
        setLoading(false);
      }
    };

    if (initialData.length === 0) {
      fetchData();
    }
  }, [sortConfig]);

  // Handle sorting
  const handleSort = (key: keyof PerformanceRecord) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Apply filters
  const filteredPerformances = performances.filter(tech => {
    const matchesSearch = filters.search === '' || 
      tech.full_name?.toLowerCase().includes(filters.search.toLowerCase()) ||
      tech.email?.toLowerCase().includes(filters.search.toLowerCase());
      
    const matchesScore = tech.score !== undefined && 
      tech.score >= filters.minScore && 
      tech.score <= filters.maxScore;

    return matchesSearch && matchesScore;
  });

  // Render sort indicator
  const getSortIndicator = (key: keyof PerformanceRecord) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  if (loading && performances.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PerformanceFilters 
        filters={filters} 
        onFiltersChange={setFilters} 
      />
      
      <div className="overflow-hidden rounded-lg border border-gray-200 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 bg-gray-50 font-semibold text-gray-700 border-b">
          <div className="md:col-span-3 flex items-center cursor-pointer" onClick={() => handleSort('full_name')}>
            Technician {getSortIndicator('full_name')}
          </div>
          <div className="md:col-span-2 flex items-center cursor-pointer" onClick={() => handleSort('score')}>
            Score {getSortIndicator('score')}
          </div>
          <div className="md:col-span-1 flex items-center cursor-pointer" onClick={() => handleSort('jobs_completed')}>
            Jobs {getSortIndicator('jobs_completed')}
          </div>
          <div className="md:col-span-2 flex items-center cursor-pointer" onClick={() => handleSort('sla_met')}>
            SLA Met {getSortIndicator('sla_met')}
          </div>
          <div className="md:col-span-2 flex items-center cursor-pointer" onClick={() => handleSort('sla_breached')}>
            SLA Breached {getSortIndicator('sla_breached')}
          </div>
          <div className="md:col-span-2 flex items-center cursor-pointer" onClick={() => handleSort('rating_avg')}>
            Rating {getSortIndicator('rating_avg')}
          </div>
        </div>
        
        <div className="divide-y divide-gray-200">
          <AnimatePresence>
            {filteredPerformances.map((tech) => (
              <motion.div
                key={tech.technician_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
              >
                <PerformanceCard performance={tech} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
      
      {filteredPerformances.length === 0 && (
        <div className="text-center py-10 text-gray-500">
          No technicians found matching the current filters
        </div>
      )}
    </div>
  );
};