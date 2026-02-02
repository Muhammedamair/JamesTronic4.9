'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, ThumbsUp, ThumbsDown, CheckCircle2, XCircle } from 'lucide-react';
import { timeAgo } from '@/lib/utils/time';
import { useToast } from '@/hooks/use-toast';

interface AiRecommendation {
  id: string;
  created_at: string;
  recommendation_type: string;
  entity_type: string | null;
  entity_id: string | null;
  title: string;
  description: string;
  confidence_score: number;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXECUTED';
}

type StatusFilter = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED';

interface AiRecommendationsTableProps {
  refreshTrigger?: number;
}

export function AiRecommendationsTable({ refreshTrigger }: AiRecommendationsTableProps = {}) {
  const [recommendations, setRecommendations] = useState<AiRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('ALL');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [reviewDialog, setReviewDialog] = useState<{ id: string, action: 'approve' | 'reject', note: string } | null>(null);
  const { toast = (p: { title: string, description: string, variant?: string }) => console.log(p) } = useToast();

  useEffect(() => {
    fetchRecommendations();
  }, [filterStatus, refreshTrigger]);

  function openReviewDialog(id: string, action: 'approve' | 'reject') {
    setReviewDialog({ id, action, note: '' });
  }

  async function fetchRecommendations() {
    setLoading(true);
    const supabase = createClient();

    let query = supabase
      .from('ai_recommendations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (filterStatus !== 'ALL') {
      query = query.eq('status', filterStatus);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to fetch recommendations:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load recommendations',
      });
    } else {
      setRecommendations(data || []);
    }

    setLoading(false);
  }

  async function executeReview() {
    if (!reviewDialog) return;

    const { id: recommendationId, action, note } = reviewDialog;
    const status = action === 'approve' ? 'APPROVED' : 'REJECTED';
    setProcessingId(recommendationId);

    // Default note if empty
    const finalNote = note.trim() || `${action === 'approve' ? 'Approved' : 'Rejected'} by admin via AI Brain cockpit`;

    try {
      // 1. Optimistic Update
      const previousRecommendations = [...recommendations];
      setRecommendations(prev => prev.map(r =>
        r.id === recommendationId
          ? { ...r, status: status as any, reviewed_at: new Date().toISOString() }
          : r
      ));

      // Close dialog immediately for better UX
      setReviewDialog(null);

      const response = await fetch(`/api/admin/ai-brain/recommendations/${recommendationId}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          review_note: finalNote,
        }),
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: `Recommendation ${status.toLowerCase()} successfully`,
        });
        // State already updated optimistically
      } else {
        // Rollback on failure
        setRecommendations(previousRecommendations);
        const error = await response.json();
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error.error || `Failed to ${action} recommendation`,
        });
      }
    } catch (error) {
      // Rollback on network error
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Network error occurred',
      });
      // Force re-fetch to ensure consistency
      fetchRecommendations();
    }

    setProcessingId(null);
  }

  function handleReview(recommendationId: string, action: 'approve' | 'reject') {
    openReviewDialog(recommendationId, action);
  }

  function getUrgencyColor(urgency: string) {
    switch (urgency?.toLowerCase()) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'APPROVED':
        return <Badge className="bg-green-100 text-green-800 border-green-200"><CheckCircle2 className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'REJECTED':
        return <Badge className="bg-red-100 text-red-800 border-red-200"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      case 'PENDING':
        return <Badge variant="secondary">Pending</Badge>;
      case 'EXECUTED':
        return <Badge>Executed</Badge>;
      default:
        // Fallback for any mixed case or older data
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex justify-between items-center">
        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as StatusFilter)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Status</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : recommendations.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No recommendations found
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Urgency</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recommendations.map((rec) => (
                <TableRow key={rec.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{rec.title}</div>
                      <div className="text-sm text-muted-foreground line-clamp-1">
                        {rec.description}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{rec.recommendation_type}</TableCell>
                  <TableCell>
                    <Badge className={getUrgencyColor(rec.urgency)}>
                      {(rec.urgency ?? 'low').toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full"
                          style={{ width: `${(rec.confidence_score ?? 0) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {(() => {
                          const confidence = Number(rec.confidence_score ?? 0);
                          return Number.isFinite(confidence) ? `${Math.round(confidence * 100)}%` : '—';
                        })()}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(rec.status)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {timeAgo(rec.created_at)}
                  </TableCell>
                  <TableCell>
                    {rec.status === 'PENDING' && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-600 hover:bg-green-50"
                          onClick={() => handleReview(rec.id, 'approve')}
                          disabled={processingId === rec.id}
                        >
                          {processingId === rec.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <><ThumbsUp className="h-4 w-4 mr-1" />Approve</>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:bg-red-50"
                          onClick={() => handleReview(rec.id, 'reject')}
                          disabled={processingId === rec.id}
                        >
                          <ThumbsDown className="h-4 w-4 mr-1" />Reject
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Review Confirmation Dialog */}
      <Dialog open={!!reviewDialog} onOpenChange={(open) => !open && setReviewDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewDialog?.action === 'approve' ? 'Approve Recommendation' : 'Reject Recommendation'}
            </DialogTitle>
            <DialogDescription>
              Add an optional note for this decision. This will be recorded in the audit log.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Textarea
              placeholder="Enter review notes (optional)..."
              value={reviewDialog?.note || ''}
              onChange={(e) => setReviewDialog(prev => prev ? { ...prev, note: e.target.value } : null)}
              className="min-h-[100px]"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialog(null)}>Cancel</Button>
            <Button
              variant={reviewDialog?.action === 'approve' ? 'default' : 'destructive'}
              onClick={executeReview}
              disabled={!!processingId}
            >
              {processingId ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirm {reviewDialog?.action === 'approve' ? 'Approval' : 'Rejection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
