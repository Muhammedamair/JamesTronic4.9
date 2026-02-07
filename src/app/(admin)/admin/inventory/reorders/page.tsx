'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { inventoryApi, ReorderRecommendation } from '@/lib/api/inventory';
import {
    Table,
    TableHeader,
    TableRow,
    TableHead,
    TableBody,
    TableCell
} from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from '@/components/ui/textarea';
import {
    CheckCircle,
    XCircle,
    AlertTriangle,
    Package,
    ArrowRight,
    Search,
    RefreshCw,
    ShieldCheck
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';

export default function ReorderQueuePage() {
    const [reorders, setReorders] = useState<ReorderRecommendation[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('proposed');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedReorder, setSelectedReorder] = useState<ReorderRecommendation | null>(null);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [rejectNotes, setRejectNotes] = useState('');
    const [isRejecting, setIsRejecting] = useState(false);

    const supabase = createClient();

    const fetchReorders = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await inventoryApi.getReorders(statusFilter === 'all' ? undefined : statusFilter);

            if (error) {
                toast({
                    title: 'Error fetching reorders',
                    description: error,
                    variant: 'destructive'
                });
            } else {
                setReorders(data || []);
            }
        } catch (err) {
            console.error('Fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, [statusFilter]);

    useEffect(() => {
        fetchReorders();
    }, [fetchReorders]);

    const handleApprove = async (id: string) => {
        setProcessingId(id);
        try {
            await inventoryApi.approveReorder(id);

            toast({ title: 'Reorder Approved', description: 'Order moved to approved status' });

            // Refresh list and close sheet
            fetchReorders();
            if (selectedReorder?.id === id) setSelectedReorder(null);

        } catch (err: any) {
            toast({
                title: 'Approval Failed',
                description: err.message,
                variant: 'destructive'
            });
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (id: string, notes: string) => {
        if (!notes.trim()) {
            toast({ title: 'Notes Required', description: 'Please provide a reason for rejection', variant: 'destructive' });
            return;
        }

        setProcessingId(id);
        try {
            await inventoryApi.rejectReorder(id, notes);

            toast({ title: 'Reorder Rejected', description: 'Recommendation has been rejected' });

            // Refresh list and close sheet/dialog
            fetchReorders();
            if (selectedReorder?.id === id) setSelectedReorder(null);
            setIsRejecting(false);
            setRejectNotes('');

        } catch (err: any) {
            toast({
                title: 'Rejection Failed',
                description: err.message,
                variant: 'destructive'
            });
        } finally {
            setProcessingId(null);
        }
    };

    const filteredReorders = reorders.filter(r => {
        if (!searchQuery) return true;
        // Search in evidence JSON logic (or future joined part name)
        // For now, search ID or basic available fields since part name might be in evidence
        const partId = r.part_id.toLowerCase();
        return partId.includes(searchQuery.toLowerCase());
    });

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'proposed':
                return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Proposed</Badge>;
            case 'approved':
                return <Badge className="bg-green-600">Approved</Badge>;
            case 'rejected':
                return <Badge variant="destructive">Rejected</Badge>;
            case 'ordered':
                return <Badge className="bg-purple-600">Ordered</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    return (
        <div className="space-y-6 p-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Reorder Queue</h1>
                    <p className="text-muted-foreground">
                        Review and approve AI-generated reorder recommendations
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="proposed">Proposed</SelectItem>
                            <SelectItem value="approved">Approved</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                            <SelectItem value="all">All Status</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button variant="outline" size="icon" onClick={fetchReorders} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle>Reorder Recommendations</CardTitle>
                        <div className="relative w-64">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search part ID..."
                                className="pl-8"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Part ID</TableHead>
                                <TableHead>Location</TableHead>
                                <TableHead>Qty</TableHead>
                                <TableHead>Risk</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8">
                                        Loading recommendations...
                                    </TableCell>
                                </TableRow>
                            ) : filteredReorders.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                        No recommendations found for this filter
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredReorders.map((reorder) => (
                                    <TableRow key={reorder.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setSelectedReorder(reorder)}>
                                        <TableCell>
                                            <div className="font-medium">
                                                {format(new Date(reorder.created_at), 'MMM d, yyyy')}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {format(new Date(reorder.created_at), 'HH:mm')}
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-mono text-sm">
                                            {reorder.part_id.substring(0, 8)}...
                                        </TableCell>
                                        <TableCell>{reorder.location_id.substring(0, 8)}...</TableCell>
                                        <TableCell className="font-bold">{reorder.recommended_qty}</TableCell>
                                        <TableCell>
                                            {reorder.stockout_risk_score >= 80 ? (
                                                <Badge variant="destructive">{reorder.stockout_risk_score}%</Badge>
                                            ) : (
                                                <span className="text-muted-foreground">{reorder.stockout_risk_score}%</span>
                                            )}
                                        </TableCell>
                                        <TableCell>{getStatusBadge(reorder.status)}</TableCell>
                                        <TableCell>
                                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedReorder(reorder); }}>
                                                Review
                                                <ArrowRight className="ml-2 h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Evidence Drawer */}
            <Sheet open={!!selectedReorder} onOpenChange={(open) => !open && setSelectedReorder(null)}>
                <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
                    {selectedReorder && (
                        <>
                            <SheetHeader className="mb-6">
                                <SheetTitle>Reorder Details</SheetTitle>
                                <SheetDescription>
                                    ID: {selectedReorder.id}
                                </SheetDescription>
                                <div className="flex gap-2 mt-2">
                                    {getStatusBadge(selectedReorder.status)}
                                    <Badge variant="outline">Risk: {selectedReorder.stockout_risk_score}%</Badge>
                                </div>
                            </SheetHeader>

                            <div className="space-y-6">
                                {/* Primary Action Block - Only show for proposed */}
                                {selectedReorder.status === 'proposed' && (
                                    <Card className="border-blue-200 bg-blue-50/50">
                                        <CardContent className="pt-6 space-y-4">
                                            <div className="flex gap-4">
                                                {!isRejecting ? (
                                                    <>
                                                        <Button
                                                            className="flex-1 bg-green-600 hover:bg-green-700"
                                                            onClick={() => handleApprove(selectedReorder.id)}
                                                            disabled={!!processingId}
                                                        >
                                                            {processingId === selectedReorder.id ? (
                                                                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                                            ) : (
                                                                <CheckCircle className="mr-2 h-4 w-4" />
                                                            )}
                                                            Approve Order ({selectedReorder.recommended_qty} units)
                                                        </Button>
                                                        <Button
                                                            variant="destructive"
                                                            onClick={() => setIsRejecting(true)}
                                                            disabled={!!processingId}
                                                        >
                                                            <XCircle className="mr-2 h-4 w-4" />
                                                            Reject
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <div className="w-full space-y-3">
                                                        <h4 className="font-semibold text-sm">Reason for Rejection</h4>
                                                        <Textarea
                                                            placeholder="Enter reason (e.g., Stock count incorrect, awaiting new model)"
                                                            value={rejectNotes}
                                                            onChange={(e) => setRejectNotes(e.target.value)}
                                                        />
                                                        <div className="flex gap-2">
                                                            <Button
                                                                variant="destructive"
                                                                className="flex-1"
                                                                onClick={() => handleReject(selectedReorder.id, rejectNotes)}
                                                                disabled={!!processingId}
                                                            >
                                                                Confirm Rejection
                                                            </Button>
                                                            <Button variant="outline" onClick={() => setIsRejecting(false)}>
                                                                Cancel
                                                            </Button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}

                                {/* Audit Trail - Show if approved/rejected */}
                                {(selectedReorder.status === 'approved' || selectedReorder.status === 'rejected') && (
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm font-medium">Audit Trail</CardTitle>
                                        </CardHeader>
                                        <CardContent className="text-sm">
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="text-muted-foreground">Action By:</div>
                                                <div>{selectedReorder.approved_by || 'Unknown'}</div>

                                                <div className="text-muted-foreground">Timestamp:</div>
                                                <div>{selectedReorder.approved_at ? format(new Date(selectedReorder.approved_at), 'PPpp') : '—'}</div>

                                                {selectedReorder.notes && (
                                                    <>
                                                        <div className="text-muted-foreground">Notes:</div>
                                                        <div>{selectedReorder.notes}</div>
                                                    </>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}

                                {/* Evidence Data */}
                                <div className="grid gap-4">
                                    <h3 className="font-semibold text-lg flex items-center gap-2">
                                        <ShieldCheck className="h-5 w-5" />
                                        AI Evidence
                                    </h3>

                                    <div className="grid grid-cols-2 gap-4">
                                        <Card>
                                            <CardHeader className="p-4 pb-2">
                                                <CardTitle className="text-xs font-medium text-muted-foreground">Current Stock</CardTitle>
                                            </CardHeader>
                                            <CardContent className="p-4 pt-0">
                                                <div className="text-xl font-bold">
                                                    {(selectedReorder.evidence as any)?.current_available ?? '—'}
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card>
                                            <CardHeader className="p-4 pb-2">
                                                <CardTitle className="text-xs font-medium text-muted-foreground">Suggested Dealer</CardTitle>
                                            </CardHeader>
                                            <CardContent className="p-4 pt-0">
                                                <div className="text-sm font-medium truncate">
                                                    {(selectedReorder.evidence as any)?.dealer_name ?? 'Best Available'}
                                                </div>
                                                {(selectedReorder.evidence as any)?.dealer_trust && (
                                                    <Badge variant="outline" className="mt-1">
                                                        Trust: {(selectedReorder.evidence as any).dealer_trust}%
                                                    </Badge>
                                                )}
                                            </CardContent>
                                        </Card>

                                        <Card className="col-span-2">
                                            <CardHeader className="p-4 pb-2">
                                                <CardTitle className="text-xs font-medium text-muted-foreground">Forecast Driver</CardTitle>
                                            </CardHeader>
                                            <CardContent className="p-4 pt-0">
                                                <div className="text-sm">
                                                    {(selectedReorder.evidence as any)?.forecast?.primary_reason ?? 'Algorithm Recommendation'}
                                                </div>
                                                <div className="flex gap-2 mt-2">
                                                    <Badge variant="secondary">
                                                        Confidence: {(selectedReorder.evidence as any)?.forecast_confidence ?? 0}%
                                                    </Badge>
                                                    <Badge variant="secondary">
                                                        Window: {(selectedReorder.evidence as any)?.forecast?.window_days ?? 7}d
                                                    </Badge>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </SheetContent>
            </Sheet>
        </div>
    );
}
