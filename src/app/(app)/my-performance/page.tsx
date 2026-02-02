'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { workforceApi } from '@/lib/api/workforce';
import { WorkforceBehaviourScore, WorkforceAttendance, WorkforceIncident } from '@/lib/types/workforce';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
    CheckCircle,
    XCircle,
    MapPin,
    Clock,
    AlertTriangle,
    TrendingUp,
    TrendingDown,
    Shield,
    Activity
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

export default function MyPerformancePage() {
    const router = useRouter();
    const { toast } = useToast();

    const [loading, setLoading] = useState(true);
    const [score, setScore] = useState<WorkforceBehaviourScore | null>(null);
    const [attendance, setAttendance] = useState<WorkforceAttendance | null>(null);
    const [incidents, setIncidents] = useState<WorkforceIncident[]>([]);
    const [checkingIn, setCheckingIn] = useState(false);

    // Fetch Data
    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const [scoreData, attendanceData, incidentsData] = await Promise.all([
                workforceApi.getMyLatestScore(),
                workforceApi.getMyTodayAttendance(),
                workforceApi.getMyIncidents(5)
            ]);

            setScore(scoreData);
            setAttendance(attendanceData);
            setIncidents(incidentsData);
        } catch (error) {
            console.error('Failed to load performance data:', error);
            toast({
                title: 'Error loading data',
                description: 'Could not load your performance profile.',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Check In Handler
    const handleCheckIn = async () => {
        setCheckingIn(true);
        if (!navigator.geolocation) {
            toast({
                title: 'Geolocation Required',
                description: 'Please enable location services to check in.',
                variant: 'destructive',
            });
            setCheckingIn(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    await workforceApi.checkIn(
                        position.coords.latitude,
                        position.coords.longitude
                    );
                    toast({
                        title: 'Checked In',
                        description: `You are now on shift. Time: ${format(new Date(), 'HH:mm')}`,
                    });
                    await loadData(); // Refresh state
                } catch (error) {
                    console.error(error);
                    toast({
                        title: 'Check-in Failed',
                        description: 'Could not verify your location or update status.',
                        variant: 'destructive',
                    });
                } finally {
                    setCheckingIn(false);
                }
            },
            (error) => {
                console.error(error);
                toast({
                    title: 'Location Error',
                    description: 'Unable to retrieve your location.',
                    variant: 'destructive',
                });
                setCheckingIn(false);
            }
        );
    };

    // Check Out Handler
    const handleCheckOut = async () => {
        setCheckingIn(true);
        if (!navigator.geolocation) {
            // Allow force-checkout? No, strict via blueprint.
            toast({
                title: 'Geolocation Required',
                description: 'Please enable location services to check out.',
                variant: 'destructive',
            });
            setCheckingIn(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    await workforceApi.checkOut(
                        position.coords.latitude,
                        position.coords.longitude
                    );
                    toast({
                        title: 'Checked Out',
                        description: `Shift ended. Time: ${format(new Date(), 'HH:mm')}`,
                    });
                    await loadData();
                } catch (error) {
                    console.error(error);
                    toast({
                        title: 'Check-out Failed',
                        description: 'Could not verify your location.',
                        variant: 'destructive',
                    });
                } finally {
                    setCheckingIn(false);
                }
            },
            (error) => {
                console.error(error);
                toast({
                    title: 'Location Error',
                    description: 'Unable to retrieve your location.',
                    variant: 'destructive',
                });
                setCheckingIn(false);
            }
        );
    };

    if (loading) {
        return (
            <div className="p-6 space-y-4 animate-pulse">
                <div className="h-8 bg-muted rounded w-1/3"></div>
                <div className="h-64 bg-muted rounded"></div>
            </div>
        );
    }

    // Determine Overall Status Color
    const getScoreColor = (value: number) => {
        if (value >= 90) return 'text-green-600';
        if (value >= 75) return 'text-yellow-600';
        return 'text-red-600';
    };

    return (
        <div className="container max-w-lg mx-auto p-4 space-y-6 pb-20">

            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">My Performance</h1>
                    <p className="text-muted-foreground text-sm">
                        {format(new Date(), 'EEEE, MMMM do')}
                    </p>
                </div>
                <Badge variant={attendance ? 'default' : 'secondary'} className="h-8 px-3">
                    {attendance ? 'ON SHIFT' : 'OFF SHIFT'}
                </Badge>
            </div>

            {/* Attendance Action */}
            <Card className="border-2 border-primary/10">
                <CardContent className="pt-6">
                    <div className="flex flex-col items-center space-y-4">
                        <div className="text-center space-y-1">
                            <h3 className="font-medium text-lg">
                                {attendance ? 'Currently Working' : 'Ready to Start?'}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                {attendance
                                    ? `Checked in at ${format(new Date(attendance.check_in_at!), 'HH:mm')}`
                                    : 'Please verify your location to start shift'
                                }
                            </p>
                        </div>

                        {attendance ? (
                            <Button
                                size="lg"
                                variant="destructive"
                                className="w-full h-14 text-lg font-semibold shadow-lg"
                                onClick={handleCheckOut}
                                disabled={checkingIn}
                            >
                                {checkingIn ? 'Locating...' : 'Check Out & End Shift'}
                            </Button>
                        ) : (
                            <Button
                                size="lg"
                                className="w-full h-14 text-lg font-semibold shadow-lg bg-green-600 hover:bg-green-700"
                                onClick={handleCheckIn}
                                disabled={checkingIn}
                            >
                                {checkingIn ? 'Locating...' : 'Check In & Start Shift'}
                            </Button>
                        )}

                        <div className="flex items-center text-xs text-muted-foreground">
                            <MapPin className="w-3 h-3 mr-1" />
                            <span>Location verification active</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Daily Score */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center justify-between">
                        Daily Reliability Score
                        <Shield className="w-4 h-4 text-primary" />
                    </CardTitle>
                    <CardDescription>Based on today's jobs & attendance</CardDescription>
                </CardHeader>
                <CardContent>
                    {score ? (
                        <div className="space-y-6">
                            {/* Main Score Dial */}
                            <div className="flex justify-center">
                                <div className={`text-6xl font-black ${getScoreColor(score.composite_score)}`}>
                                    {score.composite_score}
                                </div>
                            </div>

                            {/* Components */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-muted/50 p-3 rounded-lg text-center">
                                    <div className="text-xs text-muted-foreground mb-1">Reliability</div>
                                    <div className="font-bold text-lg">{score.reliability_score}%</div>
                                </div>
                                <div className="bg-muted/50 p-3 rounded-lg text-center">
                                    <div className="text-xs text-muted-foreground mb-1">Punctuality</div>
                                    <div className="font-bold text-lg">{score.punctuality_score}%</div>
                                </div>
                                <div className="bg-muted/50 p-3 rounded-lg text-center">
                                    <div className="text-xs text-muted-foreground mb-1">Quality</div>
                                    <div className="font-bold text-lg">{score.quality_score}%</div>
                                </div>
                                <div className="bg-muted/50 p-3 rounded-lg text-center">
                                    <div className="text-xs text-muted-foreground mb-1">Incidents</div>
                                    <div className="font-bold text-lg text-red-500">
                                        {score.incident_factor > 0 ? `-${score.incident_factor}` : '0'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            No score data generated for today yet.
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Incidents Warning */}
            {incidents.length > 0 && (
                <Card className="border-red-100 bg-red-50/20">
                    <CardHeader>
                        <CardTitle className="text-base text-red-900 flex items-center">
                            <AlertTriangle className="w-4 h-4 mr-2" />
                            Recent Incidents
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {incidents.map((inc) => (
                                <div key={inc.id} className="text-sm border-l-2 border-red-300 pl-3">
                                    <div className="font-medium text-red-950 uppercase text-xs">{inc.incident_type.replace('_', ' ')}</div>
                                    <div className="text-muted-foreground">{inc.description}</div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                        {format(new Date(inc.created_at), 'MMM d, HH:mm')} • {inc.severity} severity
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

        </div>
    );
}
