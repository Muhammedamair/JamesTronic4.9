'use client';

import React, { useState, useEffect } from 'react';
import { SkeletonLoader } from '@/components/admin/shared/SkeletonLoader';
import { type TechnicianForAssignment } from '@/lib/api/tickets';
import { ticketApi } from '@/lib/api/tickets';
import { Ticket } from '@/lib/types/ticket';
import { calculateTechnicianLoad, getTechnicianHistory } from '@/lib/utils/performance-sla-utils';
import { cn } from '@/lib/utils';
import { User, Wrench, Clock, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface TechnicianRecommendationListProps {
  onSelect: (id: string) => void;
  selectedId: string | null;
  ticket: Ticket;
}

export const TechnicianRecommendationList: React.FC<TechnicianRecommendationListProps> = ({
  onSelect,
  selectedId,
  ticket
}) => {
  const [technicians, setTechnicians] = useState<TechnicianForAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [technicianStats, setTechnicianStats] = useState<Record<string, any>>({});
  const [sortedTechnicians, setSortedTechnicians] = useState<TechnicianForAssignment[]>([]);

  // Function to calculate technician scores
  const calculateScores = async () => {
    const stats: Record<string, any> = {};
    const statsPromises = technicians.map(async technician => {
      try {
        const load = await calculateTechnicianLoad(technician.id);
        const history = await getTechnicianHistory(technician.id);
        return {
          id: technician.id,
          load,
          history
        };
      } catch (error) {
        console.error(`Error getting stats for technician ${technician.id}:`, error);
        return {
          id: technician.id,
          load: 0,
          history: { performanceScore: 0 }
        };
      }
    });

    const statsResults = await Promise.all(statsPromises);
    statsResults.forEach(stat => {
      stats[stat.id] = {
        load: stat.load,
        performanceScore: stat.history.performanceScore,
        activeTickets: stat.load,
        availability: 10 - stat.load // Assuming max 10 tickets before busy
      };
    });

    setTechnicianStats(stats);
  };

  // Load technicians and calculate scores
  useEffect(() => {
    const loadTechnicians = async () => {
      setIsLoading(true);
      try {
        const assignableTechnicians = await ticketApi.getAssignableTechnicians();
        setTechnicians(assignableTechnicians);
      } catch (error) {
        console.error('Error fetching technicians:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTechnicians();
  }, []);

  // Calculate scores when technicians are loaded
  useEffect(() => {
    if (technicians.length > 0) {
      calculateScores();
    }
  }, [technicians]);

  // Sort technicians based on scores (zone match, workload, performance)
  useEffect(() => {
    if (technicians.length > 0) {
      const sorted = [...technicians].sort((a, b) => {
        const statsA = technicianStats[a.id] || { load: 0, performanceScore: 0, availability: 0 };
        const statsB = technicianStats[b.id] || { load: 0, performanceScore: 0, availability: 0 };

        // Priority 1: Zone match (assumed area match)
        const isATechArea = ticket.customer?.name ?
          a.category_id === ticket.customer.name.toLowerCase() : false;  // Using name instead of area for now
        const isBTechArea = ticket.customer?.name ?
          b.category_id === ticket.customer.name.toLowerCase() : false;  // Using name instead of area for now

        if (isATechArea && !isBTechArea) return -1;
        if (!isATechArea && isBTechArea) return 1;

        // Priority 2: Workload (prefer less loaded technicians)
        if (statsA.load < statsB.load) return -1;
        if (statsA.load > statsB.load) return 1;

        // Priority 3: Performance score
        if (statsA.performanceScore > statsB.performanceScore) return -1;
        if (statsA.performanceScore < statsB.performanceScore) return 1;

        return 0;
      });

      setSortedTechnicians(sorted);
    }
  }, [technicians, technicianStats, ticket]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <SkeletonLoader variant="rect" height="80px" />
        <SkeletonLoader variant="rect" height="80px" />
        <SkeletonLoader variant="rect" height="80px" />
      </div>
    );
  }

  if (sortedTechnicians.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 dark:text-gray-400">No technicians available</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sortedTechnicians.map(technician => {
        const stats = technicianStats[technician.id] || {
          load: 0,
          performanceScore: 0,
          activeTickets: 0,
          availability: 10
        };

        // Determine availability badge color
        let availabilityColor = 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100';
        if (stats.activeTickets >= 6) {
          availabilityColor = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100';
        }
        if (stats.activeTickets >= 8) {
          availabilityColor = 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100';
        }

        return (
          <div
            key={technician.id}
            className={cn(
              'border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md',
              selectedId === technician.id
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                : 'border-gray-200 dark:border-gray-700'
            )}
            onClick={() => onSelect(technician.id)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-500" />
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    {technician.full_name || 'Unknown Technician'}
                  </h4>
                </div>

                <div className="flex items-center gap-4 mt-2 text-sm">
                  <div className="flex items-center">
                    <Wrench className="h-4 w-4 text-gray-400 mr-1" />
                    <span className="text-gray-600 dark:text-gray-300">
                      {stats.activeTickets} active
                    </span>
                  </div>

                  <div className="flex items-center">
                    <TrendingUp className="h-4 w-4 text-gray-400 mr-1" />
                    <span className="text-gray-600 dark:text-gray-300">
                      {stats.performanceScore?.toFixed(1) || '0.0'}%
                    </span>
                  </div>

                  <div className="flex items-center">
                    <Clock className="h-4 w-4 text-gray-400 mr-1" />
                    <Badge className={availabilityColor}>
                      {stats.availability > 5 ? 'Available' : stats.availability > 2 ? 'Busy' : 'Very Busy'}
                    </Badge>
                  </div>
                </div>
              </div>

              {selectedId === technician.id && (
                <div className="flex items-center">
                  <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};