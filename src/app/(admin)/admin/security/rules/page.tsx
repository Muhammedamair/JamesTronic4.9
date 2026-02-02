'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
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
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface SecurityAlertRule {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  severity: string;
  source_type: string;
  condition: any;
  created_at: string;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export default function SecurityRulesPage() {
  const [rules, setRules] = useState<SecurityAlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch security alert rules
  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('security_alert_rules')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      setRules(data || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching security rules:', err);
      setError(`Error fetching security rules: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRule = async (ruleId: string, currentActive: boolean) => {
    try {
      const { error } = await supabase
        .from('security_alert_rules')
        .update({ is_active: !currentActive })
        .eq('id', ruleId);

      if (error) {
        throw new Error(error.message);
      }

      // Refresh the rules list
      await fetchRules();
    } catch (err) {
      console.error('Error toggling rule:', err);
      alert(`Error toggling rule: ${(err as Error).message}`);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-red-500';
      case 'warning': return 'bg-yellow-500';
      case 'info': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getSourceTypeColor = (sourceType: string) => {
    switch (sourceType) {
      case 'admin_security_events': return 'bg-purple-500';
      case 'device_lock_conflicts': return 'bg-orange-500';
      case 'login_otp_requests': return 'bg-cyan-500';
      default: return 'bg-gray-500';
    }
  };

  const formatCondition = (condition: any): string => {
    if (!condition) return '{}';
    
    const parts = [];
    
    if (condition.event_type) {
      parts.push(`event_type: ${condition.event_type}`);
    }
    
    if (condition.window_minutes) {
      parts.push(`window: ${condition.window_minutes} min`);
    }
    
    if (condition.threshold) {
      parts.push(`threshold: ${condition.threshold}`);
    }
    
    if (condition.group_by) {
      parts.push(`group_by: ${condition.group_by}`);
    }
    
    return parts.join(', ');
  };

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Security Alert Rules</CardTitle>
          <p className="text-muted-foreground">
            Configure and manage the rules that trigger security alerts
          </p>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          {/* Rules Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Active</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {loading ? 'Loading security rules...' : 'No security rules found'}
                    </TableCell>
                  </TableRow>
                ) : (
                  rules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Switch
                            id={`rule-${rule.id}`}
                            checked={rule.is_active}
                            onCheckedChange={() => handleToggleRule(rule.id, rule.is_active)}
                          />
                          <Label htmlFor={`rule-${rule.id}`} className="sr-only">
                            Toggle rule
                          </Label>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {rule.name}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {rule.description}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${getSeverityColor(rule.severity)} capitalize`}>
                          {rule.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${getSourceTypeColor(rule.source_type)} capitalize`}>
                          {rule.source_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatCondition(rule.condition)}
                      </TableCell>
                      <TableCell>
                        {new Date(rule.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <h3 className="font-medium text-blue-800 mb-2">Default Security Rules</h3>
            <ul className="list-disc pl-5 space-y-1 text-sm text-blue-700">
              <li><strong>MULTIPLE_ADMIN_MFA_FAILURES</strong>: Triggers if an admin has 5+ MFA failures within 15 minutes</li>
              <li><strong>DEVICE_CONFLICT_STORM</strong>: Triggers if a user has 3+ device conflicts within 30 minutes</li>
              <li><strong>OTP_ABUSE_SINGLE_NUMBER</strong>: Triggers if 10+ OTP requests come from the same phone in 10 minutes</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}