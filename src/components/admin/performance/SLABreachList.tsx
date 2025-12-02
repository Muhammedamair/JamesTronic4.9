'use client';

import React, { useState, useEffect } from 'react';
import { SLARecord, performanceAPI } from '@/lib/api/performance';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';

interface SLABreachListProps {
  technicianId?: string;
  limit?: number;
}

export const SLABreachList: React.FC<SLABreachListProps> = ({ 
  technicianId, 
  limit = 10 
}) => {
  const [slaHistory, setSlaHistory] = useState<SLARecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'met' | 'breached'>('breached');

  // Fetch SLA history
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        let data: SLARecord[] = [];
        if (technicianId) {
          // Fetch specific technician's SLA history
          data = await performanceAPI.getTechnicianSLAHistory(
            technicianId,
            limit,
            0,
            undefined,
            undefined,
            filter === 'all' ? undefined : filter
          );
        } else {
          // Fetch all technicians' SLA history (for admin view)
          // This would require a different API endpoint in a real implementation
          // For now, we'll just show an empty state or mock data
          data = [];
        }
        
        setSlaHistory(data);
      } catch (err) {
        console.error('Error fetching SLA history:', err);
        setError('Failed to fetch SLA history');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [technicianId, filter, limit]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          {filter === 'met' ? 'SLA Met' : filter === 'breached' ? 'SLA Breaches' : 'All SLA Records'}
        </h3>
        <div className="flex space-x-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            All
          </Button>
          <Button
            variant={filter === 'met' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('met')}
          >
            Met
          </Button>
          <Button
            variant={filter === 'breached' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('breached')}
          >
            Breached
          </Button>
        </div>
      </div>

      {slaHistory.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No {filter === 'breached' ? 'breach' : filter} records found
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket</TableHead>
                <TableHead>SLA Target (min)</TableHead>
                <TableHead>Completion (min)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence>
                {slaHistory.map((record) => (
                  <motion.tr
                    key={record.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <TableCell className="font-medium">
                      {record.ticket_summary || 'N/A'}
                    </TableCell>
                    <TableCell>
                      {record.sla_target_minutes}
                    </TableCell>
                    <TableCell>
                      {record.completion_minutes || 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={record.sla_met ? 'default' : 'destructive'}
                      >
                        {record.sla_met ? 'Met' : 'Breached'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(record.created_at || '').toLocaleDateString()}
                    </TableCell>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};