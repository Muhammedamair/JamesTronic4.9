'use client';

import { useSupabase } from '@/components/shared/supabase-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    CheckCircle2, Clock, ClipboardList, Shield
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────
interface CoachingTask {
    task_id: string;
    tech_id: string;
    created_by_manager_id: string;
    branch_id: string;
    packet_id: string | null;
    ticket_evidence_id: string | null;
    task_text: string;
    status: string;
    due_date: string | null;
    completed_at: string | null;
    created_at: string;
}

// ─────────────────────────────────────────────────────────
// Technician Coaching Tasks View
// GOVERNANCE: Tech sees ONLY their tasks.
//   - No packet JSON, no trends, no labels
//   - No other techs' data
//   - No scores or rankings
// ─────────────────────────────────────────────────────────
export default function TechCoachingView() {
    const { supabase, user } = useSupabase();
    const queryClient = useQueryClient();

    // Feature flag
    const { data: flagEnabled } = useQuery({
        queryKey: ['c23-feature-flag', 'c23_coaching_enabled'],
        queryFn: async () => {
            const { data } = await supabase
                .from('c23_feature_flags')
                .select('enabled')
                .eq('flag_key', 'c23_coaching_enabled')
                .single();
            return data?.enabled ?? false;
        },
        enabled: !!user,
    });

    // Tasks: RLS scopes to own tasks only
    const { data: tasks = [], isLoading } = useQuery<CoachingTask[]>({
        queryKey: ['c23-coaching-tasks'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('c23_coaching_tasks')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data || [];
        },
        enabled: !!user && flagEnabled === true,
    });

    // Complete task mutation
    const completeMutation = useMutation({
        mutationFn: async (taskId: string) => {
            const note = prompt('Optional completion note:') || '';
            const { data, error } = await supabase.rpc('c23_complete_coaching_task', {
                p_task_id: taskId,
                p_completion_note: note,
            });
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['c23-coaching-tasks'] });
        },
    });

    if (flagEnabled === false) {
        return (
            <div className="container mx-auto py-12 px-4 text-center">
                <Shield className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h2 className="text-xl font-semibold text-gray-600 dark:text-gray-300">Coaching Tasks Not Yet Enabled</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-2">
                    This feature will be available soon.
                </p>
            </div>
        );
    }

    const activeTasks = tasks.filter(t => t.status === 'ASSIGNED' || t.status === 'IN_PROGRESS');
    const completedTasks = tasks.filter(t => t.status === 'COMPLETED');

    return (
        <div className="container mx-auto py-6 px-4 md:px-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">My Coaching Tasks</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Tasks assigned to help you develop and improve
                    </p>
                </div>
                <div className="flex gap-2">
                    <Badge variant="outline" className="gap-1">
                        <Clock className="h-3 w-3" /> {activeTasks.length} active
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" /> {completedTasks.length} completed
                    </Badge>
                </div>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="w-10 h-10 rounded-full border-4 border-gray-300 border-t-blue-500 animate-spin" />
                </div>
            ) : tasks.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <ClipboardList className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                        <p className="text-gray-500 dark:text-gray-400">No coaching tasks assigned yet.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {/* Active Tasks */}
                    {activeTasks.length > 0 && (
                        <div>
                            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Active Tasks</h2>
                            <div className="space-y-3">
                                {activeTasks.map((task) => (
                                    <Card key={task.task_id} className="border-l-4 border-l-blue-500">
                                        <CardContent className="py-4">
                                            <div className="flex flex-col sm:flex-row justify-between gap-3">
                                                <div className="flex-1">
                                                    <p className="text-sm font-medium">{task.task_text}</p>
                                                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-400">
                                                        <span>Assigned: {new Date(task.created_at).toLocaleDateString()}</span>
                                                        {task.due_date && (
                                                            <span className="text-amber-600 dark:text-amber-400 font-medium">
                                                                Due: {new Date(task.due_date).toLocaleDateString()}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant="default"
                                                    disabled={completeMutation.isPending}
                                                    onClick={() => completeMutation.mutate(task.task_id)}
                                                >
                                                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                                    Complete
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Completed Tasks */}
                    {completedTasks.length > 0 && (
                        <div>
                            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Completed</h2>
                            <div className="space-y-2">
                                {completedTasks.map((task) => (
                                    <Card key={task.task_id} className="border-l-4 border-l-emerald-500 opacity-70">
                                        <CardContent className="py-3">
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <p className="text-sm line-through text-gray-500">{task.task_text}</p>
                                                    <p className="text-xs text-gray-400 mt-1">
                                                        Completed {task.completed_at ? new Date(task.completed_at).toLocaleDateString() : ''}
                                                    </p>
                                                </div>
                                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
