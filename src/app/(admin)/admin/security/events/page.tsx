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
import { format } from 'date-fns';

interface SecurityEvent {
  id: string;
  admin_user_id: string;
  event_type: string;
  event_timestamp: string;
  ip_address?: string;
  user_agent?: string;
  metadata?: any;
  severity: string;
}

interface DeviceConflict {
  id: string;
  user_id: string;
  detected_at: string;
  old_device?: string;
  new_device?: string;
  ip_address?: string;
  user_agent?: string;
}

interface OtpRequest {
  id: string;
  phone_e164: string;
  created_at: string;
  channel: string;
  consumed_at?: string;
  ip_address?: string;
  user_agent?: string;
}

export default function SecurityEventsPage() {
  const [events, setEvents] = useState<(SecurityEvent | DeviceConflict | OtpRequest)[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventType, setEventType] = useState<'security_events' | 'device_conflicts' | 'otp_requests'>('security_events');
  const [filters, setFilters] = useState({
    severity: 'all',
    dateRange: 'all',
  });
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  // Fetch security events based on selected type
  useEffect(() => {
    fetchEvents();
  }, [eventType, filters]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      
      let query;
      let data;
      let error;

      // Calculate time range based on filter
      let sinceTime: string | null = null;
      if (filters.dateRange === 'today') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        sinceTime = today.toISOString();
      } else if (filters.dateRange === 'week') {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        sinceTime = oneWeekAgo.toISOString();
      }

      switch (eventType) {
        case 'security_events':
          query = supabase
            .from('admin_security_events')
            .select('*')
            .order('event_timestamp', { ascending: false });

          if (filters.severity !== 'all') {
            query = query.eq('severity', filters.severity);
          }
          
          if (sinceTime) {
            query = query.gte('event_timestamp', sinceTime);
          }
          
          ({ data, error } = await query);
          break;
          
        case 'device_conflicts':
          query = supabase
            .from('device_lock_conflicts')
            .select('*')
            .order('detected_at', { ascending: false });
          
          if (sinceTime) {
            query = query.gte('detected_at', sinceTime);
          }
          
          ({ data, error } = await query);
          break;
          
        case 'otp_requests':
          query = supabase
            .from('login_otp_requests')
            .select('*')
            .order('created_at', { ascending: false });
          
          if (sinceTime) {
            query = query.gte('created_at', sinceTime);
          }
          
          ({ data, error } = await query);
          break;
      }

      if (error) {
        throw new Error(error.message);
      }

      setEvents(data || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching security events:', err);
      setError(`Error fetching security events: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEventTypeChange = (value: string) => {
    setEventType(value as 'security_events' | 'device_conflicts' | 'otp_requests');
  };

  const handleFilterChange = (filterType: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-red-500';
      case 'warning': return 'bg-yellow-500';
      case 'info': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'admin_security_events': return 'bg-purple-500';
      case 'device_lock_conflicts': return 'bg-orange-500';
      case 'login_otp_requests': return 'bg-cyan-500';
      default: return 'bg-gray-500';
    }
  };

  const formatEventData = (event: any) => {
    if (eventType === 'security_events') {
      return event.event_type;
    } else if (eventType === 'device_conflicts') {
      return `Device conflict: ${event.old_device || 'Unknown'} → ${event.new_device || 'Unknown'}`;
    } else {
      return `${event.phone_e164} via ${event.channel}`;
    }
  };

  const getUserId = (event: any) => {
    if (eventType === 'security_events') {
      return event.admin_user_id;
    } else {
      return event.user_id || 'N/A';
    }
  };

  const getTimestamp = (event: any) => {
    if (eventType === 'security_events') {
      return event.event_timestamp;
    } else if (eventType === 'device_conflicts') {
      return event.detected_at;
    } else {
      return event.created_at;
    }
  };

  const getSeverity = (event: any) => {
    if (eventType === 'security_events') {
      return event.severity;
    } else {
      return 'info'; // Default for conflicts and OTP requests
    }
  };

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
          <div>
            <CardTitle className="text-2xl font-bold">Security Events</CardTitle>
            <p className="text-muted-foreground">
              View all security-related events across the platform
            </p>
          </div>
          <Button 
            onClick={fetchEvents}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Refresh'}
          </Button>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          {/* Filter Controls */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium mb-1">Event Type</label>
              <Select 
                value={eventType} 
                onValueChange={handleEventTypeChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select event type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="security_events">Admin Security Events</SelectItem>
                  <SelectItem value="device_conflicts">Device Conflicts</SelectItem>
                  <SelectItem value="otp_requests">OTP Requests</SelectItem>
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
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Date Range</label>
              <Select 
                value={filters.dateRange} 
                onValueChange={(value) => handleFilterChange('dateRange', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select date range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">Last 7 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button 
                variant="outline" 
                onClick={() => window.location.reload()}
                className="w-full"
              >
                Reset Filters
              </Button>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="p-4 flex items-center">
                <div className={`p-3 rounded-full ${getEventTypeColor('admin_security_events')} bg-opacity-20`}>
                  <span className="text-lg font-bold text-center w-8 h-8 flex items-center justify-center">
                    {events.filter(e => 
                      (eventType === 'security_events' && 'event_type' in e) || 
                      (eventType === 'device_conflicts' && 'detected_at' in e) || 
                      (eventType === 'otp_requests' && 'channel' in e)).length
                    }
                  </span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Total Events</p>
                  <p className="text-2xl font-bold">{events.length}</p>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4 flex items-center">
                <div className="p-3 rounded-full bg-blue-500 bg-opacity-20">
                  <span className="text-lg font-bold text-center w-8 h-8 flex items-center justify-center">24h</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Last 24 Hours</p>
                  <p className="text-2xl font-bold">
                    {events.filter(e => {
                      const eventTime = new Date(getTimestamp(e));
                      const now = new Date();
                      const diffInHours = (now.getTime() - eventTime.getTime()) / (1000 * 60 * 60);
                      return diffInHours <= 24;
                    }).length}
                  </p>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4 flex items-center">
                <div className="p-3 rounded-full bg-green-500 bg-opacity-20">
                  <span className="text-lg font-bold text-center w-8 h-8 flex items-center justify-center">7d</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Last 7 Days</p>
                  <p className="text-2xl font-bold">
                    {events.filter(e => {
                      const eventTime = new Date(getTimestamp(e));
                      const now = new Date();
                      const diffInDays = (now.getTime() - eventTime.getTime()) / (1000 * 60 * 60 * 24);
                      return diffInDays <= 7;
                    }).length}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Security Alerts Link */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-medium text-blue-800">Security Alerts</h3>
                <p className="text-sm text-blue-700">For active security alerts and incidents, visit the Security Alerts dashboard</p>
              </div>
              <Button asChild variant="link">
                <a href="/admin/security/alerts">View Security Alerts</a>
              </Button>
            </div>
          </div>

          {/* Events Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Severity</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>User ID</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      {loading ? 'Loading security events...' : 'No security events found'}
                    </TableCell>
                  </TableRow>
                ) : (
                  events.map((event: any) => (
                    <TableRow key={event.id}>
                      <TableCell>
                        <Badge className={`${getSeverityColor(getSeverity(event))} capitalize`}>
                          {getSeverity(event)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">
                          {eventType.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {formatEventData(event)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {getUserId(event)?.substring(0, 8)}...
                      </TableCell>
                      <TableCell>
                        {event.ip_address || 'N/A'}
                      </TableCell>
                      <TableCell>
                        {format(new Date(getTimestamp(event)), 'MMM dd, yyyy HH:mm:ss')}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}