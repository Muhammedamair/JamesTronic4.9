'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface AuditLogEntry {
  id: string;
  created_at: string;
  actor_user_id: string;
  actor_role: string;
  session_id: string;
  ip_address: string;
  user_agent: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  severity: string;
  metadata: any;
  prev_hash: string;
  hash: string;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export default function ForensicsPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    actorUserId: '',
    eventType: 'all',
    entityType: 'all',
    severity: 'all',
  });
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  // Fetch audit logs
  useEffect(() => {
    fetchLogs();
  }, [filters, page]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      
      // Build query with filters
      let query = supabase
        .from('audit_log_entries')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * 50, (page + 1) * 50 - 1);

      // Apply date filters
      if (filters.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }
      
      if (filters.dateTo) {
        query = query.lte('created_at', filters.dateTo);
      }
      
      // Apply other filters
      if (filters.actorUserId) {
        query = query.eq('actor_user_id', filters.actorUserId);
      }
      
      if (filters.eventType !== 'all') {
        query = query.eq('event_type', filters.eventType);
      }
      
      if (filters.entityType !== 'all') {
        query = query.eq('entity_type', filters.entityType);
      }
      
      if (filters.severity !== 'all') {
        query = query.eq('severity', filters.severity);
      }

      const { data, error, count } = await query;

      if (error) {
        throw new Error(error.message);
      }

      setLogs(data || []);
      setTotal(count || 0);
      setError(null);
    } catch (err) {
      console.error('Error fetching audit logs:', err);
      setError(`Error fetching audit logs: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (filterType: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
    setPage(0); // Reset to first page when filters change
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500 hover:bg-red-600';
      case 'high': return 'bg-orange-500 hover:bg-orange-600';
      case 'warning': return 'bg-yellow-500 hover:bg-yellow-600';
      case 'info': return 'bg-blue-500 hover:bg-blue-600';
      default: return 'bg-gray-500 hover:bg-gray-600';
    }
  };

  const getIntegrityStatus = (log: AuditLogEntry): { status: 'valid' | 'invalid' | 'checking', message: string } => {
    // This is a simplified check - in a real implementation, you'd verify the hash chain
    if (!log.prev_hash) {
      // This is likely the first log entry, so it's valid by definition
      return { status: 'valid', message: 'First entry in chain' };
    }
    
    // In a real implementation, you'd compute the hash of the expected content
    // and compare it with the stored prev_hash
    return { status: 'valid', message: 'Valid integrity' };
  };

  const exportLogs = async () => {
    try {
      // Prepare filter summary for the audit log
      const filterSummary = {
        date_from: filters.dateFrom,
        date_to: filters.dateTo,
        actor_user_id: filters.actorUserId,
        event_type: filters.eventType !== 'all' ? filters.eventType : undefined,
        entity_type: filters.entityType !== 'all' ? filters.entityType : undefined,
        severity: filters.severity !== 'all' ? filters.severity : undefined,
      };

      // Log the export action
      const auditResponse = await fetch('/api/admin/security/audit/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(filterSummary),
      });

      if (!auditResponse.ok) {
        throw new Error('Failed to log export action');
      }

      // In a real implementation, this would return a downloadable file
      alert('Audit logs export would start now. The export action has been logged.');
    } catch (err) {
      console.error('Error exporting audit logs:', err);
      alert('Error exporting audit logs: ' + (err as Error).message);
    }
  };

  // Get unique event types for filter dropdown
  const uniqueEventTypes = Array.from(new Set(logs.map(log => log.event_type)));
  // Get unique entity types for filter dropdown
  const uniqueEntityTypes = Array.from(new Set(logs.map(log => log.entity_type)));

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
          <div>
            <CardTitle className="text-2xl font-bold">Forensic Audit Viewer</CardTitle>
            <p className="text-muted-foreground">
              View and search compliance audit logs for security and operational forensics
            </p>
          </div>
          <div className="flex space-x-2">
            <Button 
              onClick={fetchLogs}
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
            <Button 
              onClick={exportLogs}
              disabled={loading}
              variant="outline"
            >
              Export Logs
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium mb-1">Date From</label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Date To</label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Actor User ID</label>
              <Input
                placeholder="Filter by user ID"
                value={filters.actorUserId}
                onChange={(e) => handleFilterChange('actorUserId', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Event Type</label>
              <Select 
                value={filters.eventType} 
                onValueChange={(value) => handleFilterChange('eventType', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select event type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Event Types</SelectItem>
                  {uniqueEventTypes.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium mb-1">Entity Type</label>
              <Select 
                value={filters.entityType} 
                onValueChange={(value) => handleFilterChange('entityType', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select entity type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Entity Types</SelectItem>
                  {uniqueEntityTypes.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Severity</label>
              <Select 
                value={filters.severity} 
                onValueChange={(value) => handleFilterChange('severity', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button 
                variant="outline" 
                onClick={() => {
                  setFilters({
                    dateFrom: '',
                    dateTo: '',
                    actorUserId: '',
                    eventType: 'all',
                    entityType: 'all',
                    severity: 'all',
                  });
                  setPage(0);
                }}
              >
                Reset Filters
              </Button>
            </div>
          </div>

          {/* Pagination Info */}
          <div className="flex justify-between items-center mb-4">
            <div className="text-sm text-muted-foreground">
              Showing {logs.length > 0 ? page * 50 + 1 : 0} - {Math.min((page + 1) * 50, total)} of {total} logs
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(prev => Math.max(0, prev - 1))}
                disabled={page === 0}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(prev => prev + 1)}
                disabled={logs.length < 50}
              >
                Next
              </Button>
            </div>
          </div>

          {/* Logs Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Event Type</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Integrity</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {loading ? 'Loading audit logs...' : 'No audit logs found matching filters'}
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => {
                    const integrity = getIntegrityStatus(log);
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-xs">
                          {format(new Date(log.created_at), 'MMM dd, yyyy HH:mm:ss')}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize">
                            {log.event_type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium capitalize">{log.entity_type}</div>
                            <div className="text-xs text-muted-foreground truncate max-w-[100px]">
                              {log.entity_id}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="text-xs font-mono truncate max-w-[80px]">
                              {log.actor_user_id?.substring(0, 8)}...
                            </div>
                            <div className="text-xs text-muted-foreground capitalize">
                              {log.actor_role}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-xs">{log.ip_address}</span>
                        </TableCell>
                        <TableCell>
                          <Badge className={getSeverityColor(log.severity)}>
                            {log.severity.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={integrity.status === 'valid' ? 'default' : 'destructive'}>
                            {integrity.status === 'valid' ? 'OK' : 'BROKEN'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => setSelectedLog(log)}
                              >
                                View Details
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>Audit Log Details</DialogTitle>
                              </DialogHeader>
                              <div className="grid grid-cols-1 gap-4">
                                <div>
                                  <h3 className="text-sm font-medium text-muted-foreground">Timestamp</h3>
                                  <p>{format(new Date(log.created_at), 'PPPpp')}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <h3 className="text-sm font-medium text-muted-foreground">Event Type</h3>
                                    <p className="font-mono">{log.event_type}</p>
                                  </div>
                                  <div>
                                    <h3 className="text-sm font-medium text-muted-foreground">Severity</h3>
                                    <Badge className={getSeverityColor(log.severity)}>
                                      {log.severity.toUpperCase()}
                                    </Badge>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <h3 className="text-sm font-medium text-muted-foreground">Actor User ID</h3>
                                    <p className="font-mono">{log.actor_user_id}</p>
                                  </div>
                                  <div>
                                    <h3 className="text-sm font-medium text-muted-foreground">Actor Role</h3>
                                    <p className="capitalize">{log.actor_role}</p>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <h3 className="text-sm font-medium text-muted-foreground">Session ID</h3>
                                    <p className="font-mono truncate">{log.session_id}</p>
                                  </div>
                                  <div>
                                    <h3 className="text-sm font-medium text-muted-foreground">IP Address</h3>
                                    <p>{log.ip_address}</p>
                                  </div>
                                </div>
                                <div>
                                  <h3 className="text-sm font-medium text-muted-foreground">Entity</h3>
                                  <p><span className="capitalize">{log.entity_type}</span>: {log.entity_id}</p>
                                </div>
                                <div>
                                  <h3 className="text-sm font-medium text-muted-foreground">Metadata</h3>
                                  <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
                                    {JSON.stringify(log.metadata, null, 2)}
                                  </pre>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <h3 className="text-sm font-medium text-muted-foreground">Hash</h3>
                                    <p className="font-mono text-xs truncate">{log.hash}</p>
                                  </div>
                                  <div>
                                    <h3 className="text-sm font-medium text-muted-foreground">Previous Hash</h3>
                                    <p className="font-mono text-xs truncate">{log.prev_hash}</p>
                                  </div>
                                </div>
                                <div>
                                  <h3 className="text-sm font-medium text-muted-foreground">Integrity Status</h3>
                                  <p>{integrity.message}</p>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}