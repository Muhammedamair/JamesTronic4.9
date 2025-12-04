'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Search, Unlock, AlertTriangle, User, Clock } from 'lucide-react';

type DeviceLockData = {
  user: {
    full_name: string;
    phone: string;
    role: string;
  };
  device_lock: {
    user_id: string;
    device_fingerprint_hash: string;
    created_at: string;
    updated_at: string;
    override_allowed: boolean;
  } | null;
  conflicts: Array<{
    id: string;
    user_id: string;
    detected_at: string;
    old_device: string | null;
    new_device: string | null;
    ip_address: string;
    user_agent: string;
  }>;
};

export default function DeviceManagementPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<DeviceLockData | null>(null);
  const [loading, setLoading] = useState(false);
  const [conflicts, setConflicts] = useState<any[]>([]);

  // Search for a user's device information
  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      toast.error('Please enter a user ID or phone number');
      return;
    }

    setLoading(true);
    try {
      // For now, we'll assume the search term is a user ID
      // In a real implementation, we might need to search by phone first to get user ID
      const response = await fetch(`/api/admin/device-unlock?user_id=${encodeURIComponent(searchTerm)}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch device information');
      }

      const data = await response.json();

      if (data.success) {
        setSearchResults(data.data);
        setConflicts(data.data.conflicts);
        toast.success('Device information retrieved successfully');
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error('Error searching for device information:', error);
      toast.error(error.message || 'Failed to fetch device information');
    } finally {
      setLoading(false);
    }
  };

  // Unlock a device
  const handleUnlock = async (userId: string) => {
    if (!confirm('Are you sure you want to unlock this device? The user will be able to log in from a new device.')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/admin/device-unlock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: userId, action: 'unlock' }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to unlock device');
      }

      const data = await response.json();

      if (data.success) {
        toast.success(data.message);
        // Refresh the search results to reflect the change
        handleSearch();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error('Error unlocking device:', error);
      toast.error(error.message || 'Failed to unlock device');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Device Management</h1>
        <p className="text-gray-600 mt-2">
          Monitor and manage device locks for technicians and transporters.
          Enforce single-device policy and resolve conflicts.
        </p>
      </div>

      {/* Search Section */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Search User Device Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="search">User ID or Phone Number</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="search"
                  placeholder="Enter user ID or phone number"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch} disabled={loading}>
                  <Search className="w-4 h-4 mr-2" />
                  {loading ? 'Searching...' : 'Search'}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Section */}
      {searchResults && (
        <div className="space-y-6">
          {/* User Information Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <User className="w-8 h-8 text-blue-600" />
                <div>
                  <CardTitle>Device Lock Information</CardTitle>
                  <p className="text-gray-600 text-sm">
                    {searchResults.user.full_name} ({searchResults.user.phone}) - {searchResults.user.role}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {searchResults.device_lock ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-medium text-gray-900">Current Device Lock</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Fingerprint: <code className="text-xs bg-gray-100 p-1 rounded">
                        {searchResults.device_lock.device_fingerprint_hash.substring(0, 20)}...
                      </code>
                    </p>
                    <p className="text-sm text-gray-600">
                      Locked since: {new Date(searchResults.device_lock.created_at).toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-600">
                      Last updated: {new Date(searchResults.device_lock.updated_at).toLocaleString()}
                    </p>
                    <Badge
                      variant={searchResults.device_lock.override_allowed ? "default" : "secondary"}
                      className="mt-2"
                    >
                      {searchResults.device_lock.override_allowed ? 'Override Allowed' : 'Override Not Allowed'}
                    </Badge>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">Actions</h3>
                    <div className="flex flex-col gap-2 mt-2">
                      <Button
                        variant="destructive"
                        onClick={() => handleUnlock(searchResults.device_lock!.user_id)}
                      >
                        <Unlock className="w-4 h-4 mr-2" />
                        Unlock Device
                      </Button>
                      <p className="text-xs text-gray-500">
                        Unlocking will allow the user to log in from a new device.
                        The current device lock will be removed.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto" />
                  <h3 className="font-medium text-gray-900 mt-2">No Device Lock Found</h3>
                  <p className="text-gray-600">
                    This user does not have an active device lock.
                    They can log in from any device.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Conflicts Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-8 h-8 text-red-600" />
                <div>
                  <CardTitle>Device Conflicts</CardTitle>
                  <p className="text-gray-600 text-sm">
                    Recent conflicts detected for this user
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {conflicts.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date & Time</TableHead>
                        <TableHead>Old Device</TableHead>
                        <TableHead>New Device</TableHead>
                        <TableHead>IP Address</TableHead>
                        <TableHead>User Agent</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {conflicts.map((conflict) => (
                        <TableRow key={conflict.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-gray-500" />
                              {new Date(conflict.detected_at).toLocaleString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            {conflict.old_device ? (
                              <code className="text-xs bg-gray-100 p-1 rounded">
                                {conflict.old_device.substring(0, 15)}...
                              </code>
                            ) : (
                              <span className="text-gray-500">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {conflict.new_device ? (
                              <code className="text-xs bg-gray-100 p-1 rounded">
                                {conflict.new_device.substring(0, 15)}...
                              </code>
                            ) : (
                              <span className="text-gray-500">-</span>
                            )}
                          </TableCell>
                          <TableCell>{conflict.ip_address}</TableCell>
                          <TableCell className="max-w-xs">
                            <span className="text-xs text-gray-600 truncate block">
                              {conflict.user_agent}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Clock className="w-12 h-12 text-gray-400 mx-auto" />
                  <h3 className="font-medium text-gray-900 mt-2">No Conflicts Found</h3>
                  <p className="text-gray-600">
                    No device conflicts have been detected for this user.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent Conflicts Overview */}
      <RecentConflictsOverview />
    </div>
  );
}

// Component for showing recent conflicts across all technicians and transporters
function RecentConflictsOverview() {
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecentConflicts = async () => {
      try {
        const response = await fetch('/api/admin/recent-device-conflicts');
        if (response.ok) {
          const data = await response.json();
          setConflicts(data.conflicts || []);
        } else {
          console.error('Failed to fetch recent conflicts:', response.status);
          setConflicts([]);
        }
      } catch (error) {
        console.error('Error fetching recent conflicts:', error);
        setConflicts([]); // Set empty array if there's an error
      } finally {
        setLoading(false);
      }
    };

    fetchRecentConflicts();
  }, []);

  if (loading) {
    return (
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Recent Device Conflicts</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">Loading recent conflicts...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle>Recent Device Conflicts</CardTitle>
        <p className="text-gray-600">
          Overview of recent device conflicts across all technicians and transporters.
        </p>
      </CardHeader>
      <CardContent>
        {conflicts.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Old Device</TableHead>
                  <TableHead>New Device</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conflicts.map((conflict) => (
                  <TableRow key={conflict.id}>
                    <TableCell className="font-medium">{conflict.user_name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-500" />
                        {new Date(conflict.detected_at).toLocaleString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-gray-100 p-1 rounded">
                        {conflict.old_device}
                      </code>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-gray-100 p-1 rounded">
                        {conflict.new_device}
                      </code>
                    </TableCell>
                    <TableCell>{conflict.ip_address}</TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Navigate to the specific user's device management page
                          window.location.href = `/app/device-management?user=${conflict.user_id}`;
                        }}
                      >
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8">
            <Clock className="w-12 h-12 text-gray-400 mx-auto" />
            <h3 className="font-medium text-gray-900 mt-2">No Recent Conflicts</h3>
            <p className="text-gray-600">
              No device conflicts have been detected recently.
            </p>
          </div>
        )}
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mt-6">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-yellow-400" />
            <p className="ml-3 text-sm text-yellow-700">
              <strong>Notice:</strong> Device conflicts indicate potential security issues.
              Review the conflicts and take appropriate action for affected accounts.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}