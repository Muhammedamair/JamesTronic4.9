'use client';

import { useState, useEffect } from 'react';
import { pricingApi } from '@/lib/api/pricing';
import { PricingRule, SurgePricingEvent } from '@/lib/types/pricing';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableHeader,
    TableRow,
    TableHead,
    TableBody,
    TableCell
} from '@/components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { DollarSign, TrendingUp, Calculator, Zap, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

export default function PricingDashboard() {
    const { toast } = useToast();
    const [rules, setRules] = useState<PricingRule[]>([]);
    const [surgeEvents, setSurgeEvents] = useState<SurgePricingEvent[]>([]);
    const [loading, setLoading] = useState(true);

    // Calculator state
    const [calcCategory, setCalcCategory] = useState('tv_repair');
    const [calcLabourHours, setCalcLabourHours] = useState(1);
    const [calcPartsCost, setCalcPartsCost] = useState(0);
    const [calcUrgency, setCalcUrgency] = useState('normal');
    const [calcResult, setCalcResult] = useState<any>(null);
    const [calculating, setCalculating] = useState(false);

    useEffect(() => {
        async function fetchData() {
            try {
                const [rulesData, surgeData] = await Promise.all([
                    pricingApi.getPricingRules(),
                    pricingApi.getActiveSurgeEvents()
                ]);
                setRules(rulesData);
                setSurgeEvents(surgeData);
            } catch (err) {
                console.error('Error fetching pricing data:', err);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    const handleCalculate = async () => {
        setCalculating(true);
        try {
            const result = await pricingApi.calculatePrice(
                calcCategory,
                calcLabourHours,
                calcPartsCost,
                undefined,
                calcUrgency
            );
            setCalcResult(result);
        } catch (err) {
            console.error(err);
            toast({ title: 'Error', description: 'Failed to calculate price.', variant: 'destructive' });
        } finally {
            setCalculating(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return `₹${amount.toFixed(2)}`;
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Pricing Console</h1>
                    <p className="text-muted-foreground">Manage dynamic pricing, surge control, and quotes</p>
                </div>
            </div>

            {/* Active Surge Alert */}
            {surgeEvents.length > 0 && (
                <Card className="border-orange-200 bg-orange-50/30">
                    <CardHeader>
                        <CardTitle className="text-orange-900 flex items-center gap-2">
                            <Zap className="w-4 h-4" /> Active Surge Pricing
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {surgeEvents.map((event) => (
                                <div key={event.id} className="flex justify-between items-center">
                                    <div>
                                        <span className="font-medium">{event.name}</span>
                                        <span className="text-sm text-muted-foreground ml-2">
                                            {event.city || 'All Cities'} • {event.surge_multiplier}x
                                        </span>
                                    </div>
                                    <Badge className="bg-orange-500">
                                        Ends {format(new Date(event.ends_at), 'HH:mm')}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Categories</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{rules.length}</div>
                        <p className="text-xs text-muted-foreground">pricing rules</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Surge Events</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{surgeEvents.length}</div>
                        <p className="text-xs text-muted-foreground">active now</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Default GST</CardTitle>
                        <Calculator className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">18%</div>
                        <p className="text-xs text-muted-foreground">applied to all</p>
                    </CardContent>
                </Card>
            </div>

            {/* Price Calculator */}
            <Card className="border-primary/20">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calculator className="w-4 h-4" /> Price Calculator
                    </CardTitle>
                    <CardDescription>Simulate a price quote with dynamic modifiers</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
                        <Select value={calcCategory} onValueChange={setCalcCategory}>
                            <SelectTrigger>
                                <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="tv_repair">TV Repair</SelectItem>
                                <SelectItem value="ac_repair">AC Repair</SelectItem>
                                <SelectItem value="refrigerator_repair">Refrigerator</SelectItem>
                                <SelectItem value="laptop_repair">Laptop</SelectItem>
                                <SelectItem value="mobile_repair">Mobile</SelectItem>
                            </SelectContent>
                        </Select>

                        <Input
                            type="number"
                            placeholder="Labour Hours"
                            value={calcLabourHours}
                            onChange={(e) => setCalcLabourHours(Number(e.target.value))}
                        />

                        <Input
                            type="number"
                            placeholder="Parts Cost"
                            value={calcPartsCost}
                            onChange={(e) => setCalcPartsCost(Number(e.target.value))}
                        />

                        <Select value={calcUrgency} onValueChange={setCalcUrgency}>
                            <SelectTrigger>
                                <SelectValue placeholder="Urgency" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="normal">Normal</SelectItem>
                                <SelectItem value="high">High (+25%)</SelectItem>
                                <SelectItem value="critical">Critical (+50%)</SelectItem>
                            </SelectContent>
                        </Select>

                        <Button onClick={handleCalculate} disabled={calculating}>
                            {calculating ? 'Calculating...' : 'Calculate'}
                        </Button>
                    </div>

                    {calcResult && (
                        <div className="bg-muted/50 rounded-lg p-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                <div>
                                    <div className="text-xs text-muted-foreground">Diagnostic</div>
                                    <div className="font-medium">{formatCurrency(calcResult.diagnostic_fee)}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground">Labour</div>
                                    <div className="font-medium">{formatCurrency(calcResult.labour_cost)}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground">Parts (w/ markup)</div>
                                    <div className="font-medium">{formatCurrency(calcResult.parts_with_markup)}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground">Transport</div>
                                    <div className="font-medium">{formatCurrency(calcResult.transport_fee)}</div>
                                </div>
                            </div>
                            <div className="border-t pt-3 flex justify-between items-center">
                                <div>
                                    <span className="text-sm">Subtotal: {formatCurrency(calcResult.subtotal)}</span>
                                    {calcResult.modifiers_total > 0 && (
                                        <span className="text-sm text-orange-600 ml-2">
                                            + Modifiers: {formatCurrency(calcResult.modifiers_total)}
                                        </span>
                                    )}
                                    <span className="text-sm text-muted-foreground ml-2">
                                        + GST: {formatCurrency(calcResult.gst_amount)}
                                    </span>
                                </div>
                                <div className="text-2xl font-bold text-green-600">
                                    {formatCurrency(calcResult.grand_total)}
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Pricing Rules Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Base Pricing Rules</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Category</TableHead>
                                <TableHead>Diagnostic</TableHead>
                                <TableHead>Labour/Hr</TableHead>
                                <TableHead>Transport</TableHead>
                                <TableHead>Parts Markup</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8">Loading...</TableCell>
                                </TableRow>
                            ) : rules.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                        No pricing rules configured.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                rules.map((rule) => (
                                    <TableRow key={rule.id}>
                                        <TableCell className="font-medium capitalize">
                                            {rule.category.replace(/_/g, ' ')}
                                        </TableCell>
                                        <TableCell>{formatCurrency(rule.base_diagnostic_fee)}</TableCell>
                                        <TableCell>{formatCurrency(rule.base_labour_per_hour)}</TableCell>
                                        <TableCell>{formatCurrency(rule.base_transport_fee)}</TableCell>
                                        <TableCell>{rule.part_markup_percentage}%</TableCell>
                                        <TableCell>
                                            <Badge className={rule.is_active ? 'bg-green-600' : 'bg-gray-400'}>
                                                {rule.is_active ? 'Active' : 'Inactive'}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
