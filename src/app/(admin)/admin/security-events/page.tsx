'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Shield, Clock, AlertTriangle, CheckCircle, Filter } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface SecurityEvent {
  id: string;
  admin_user_id: string;
  event_type: string;
  event_timestamp: string;
  ip_address: string;
  user_agent: string;
  metadata: any;
  severity: 'info' | 'warning' | 'error';
}

export default function AdminSecurityDashboard() {
  const { toast } = useToast();
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    eventType: '',
    severity: '',
    days: '7'
  });

  useEffect(() => {
    fetchSecurityEvents();
  }, [filters]);

  const fetchSecurityEvents = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        limit: '50',
        ...(filters.eventType && { event_type: filters.eventType }),
        ...(filters.severity && { severity: filters.severity }),
        days: filters.days
      });

      const response = await fetch(`/api/admin/security-events/recent?${queryParams}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch security events');
      }
      
      const data = await response.json();
      
      if (data.success) {
        setEvents(data.events);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Error fetching security events:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch security events',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getSeverityVariant = (severity: string) => {
    switch (severity) {
      case 'error': return 'destructive';
      case 'warning': return 'default';
      default: return 'secondary';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error': return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default: return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const eventTypeOptions = [
    'MFA_SETUP_COMPLETED',
    'MFA_CHALLENGE_PASSED',
    'MFA_CHALLENGE_FAILED',
    'ANOMALY_NEW_IP',
    'ANOMALY_NEW_DEVICE',
    'ANOMALY_ODD_HOUR_LOGIN',
    'ADMIN_RECOVERY_REQUESTED',
    'ADMIN_RECOVERY_APPROVED'
  ];

  return (
    <div className="container mx-auto py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Shield className="h-8 w-8 text-blue-600" />
          Admin Security Dashboard
        </h1>
        <p className="text-muted-foreground mt-2">
          Monitor security events and anomalies for admin accounts
        </p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
          <CardDescription>
            Filter security events by type, severity, and timeframe
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Event Type</label>
              <Select 
                value={filters.eventType} 
                onValueChange={(value) => setFilters({...filters, eventType: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Types</SelectItem>
                  {eventTypeOptions.map(option => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-1 block">Severity</label>
              <Select 
                value={filters.severity} 
                onValueChange={(value) => setFilters({...filters, severity: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Severities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Severities</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-1 block">Days</label>
              <Select 
                value={filters.days} 
                onValueChange={(value) => setFilters({...filters, days: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Last 24 Hours</SelectItem>
                  <SelectItem value="7">Last 7 Days</SelectItem>
                  <SelectItem value="30">Last 30 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-end">
              <Button 
                variant="outline" 
                onClick={() => {
                  setFilters({
                    eventType: '',
                    severity: '',
                    days: '7'
                  });
                }}
              >
                Reset Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{events.length}</div>
            <p className="text-xs text-muted-foreground">In selected period</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Severity</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {events.filter(e => e.severity === 'error').length}
            </div>
            <p className="text-xs text-muted-foreground">Critical events</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Anomalies</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {events.filter(e => e.event_type.includes('ANOMALY')).length}
            </div>
            <p className="text-xs text-muted-foreground">Detected anomalies</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">MFA Events</CardTitle>
            <Shield className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {events.filter(e => e.event_type.includes('MFA')).length}
            </div>
            <p className="text-xs text-muted-foreground">MFA related events</p>
          </CardContent>
        </Card>
      </div>

      {/* Events List */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Security Events</CardTitle>
          <CardDescription>
            {events.length} events found in the selected time period
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No security events found matching your criteria
            </div>
          ) : (
            <div className="space-y-4">
              {events.map((event) => (
                <div 
                  key={event.id} 
                  className="flex items-start space-x-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="mt-0.5">
                    {getSeverityIcon(event.severity)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium truncate">{event.event_type}</h3>
                      <Badge variant={getSeverityVariant(event.severity)}>
                        {event.severity.toUpperCase()}
                      </Badge>
                    </div>
                    
                    <p className="text-sm text-muted-foreground mt-1">
                      {formatDate(event.event_timestamp)}
                    </p>
                    
                    <div className="mt-2 text-sm">
                      <p><span className="font-medium">IP:</span> {event.ip_address || 'N/A'}</p>
                      {event.metadata && Object.keys(event.metadata).length > 0 && (
                        <p className="mt-1">
                          <span className="font-medium">Metadata:</span> {JSON.stringify(event.metadata)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}