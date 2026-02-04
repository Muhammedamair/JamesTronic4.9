'use client';

import { useState } from 'react';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2 } from 'lucide-react';
import { CreateQuotePayload } from './types';

interface NewQuoteDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (payload: CreateQuotePayload) => void;
    isSubmitting?: boolean;
    serviceCodes?: string[];
    cityId: string;
}

export function NewQuoteDrawer({
    open,
    onOpenChange,
    onSubmit,
    isSubmitting,
    serviceCodes = [],
    cityId,
}: NewQuoteDrawerProps) {
    const [serviceCode, setServiceCode] = useState('');
    const [urgency, setUrgency] = useState<'same_day' | 'next_day' | 'standard'>('standard');
    const [complexity, setComplexity] = useState<'simple' | 'standard' | 'complex'>('standard');
    const [partsCost, setPartsCost] = useState('');
    const [ticketId, setTicketId] = useState('');
    const [customerId, setCustomerId] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const payload: CreateQuotePayload = {
            city_id: cityId,
            service_code: serviceCode,
            urgency,
            complexity,
        };

        if (partsCost && parseFloat(partsCost) > 0) {
            payload.parts_cost = parseFloat(partsCost);
        }
        if (ticketId.trim()) {
            payload.ticket_id = ticketId.trim();
        }
        if (customerId.trim()) {
            payload.customer_id = customerId.trim();
        }

        onSubmit(payload);
    };

    const resetForm = () => {
        setServiceCode('');
        setUrgency('standard');
        setComplexity('standard');
        setPartsCost('');
        setTicketId('');
        setCustomerId('');
    };

    return (
        <Sheet open={open} onOpenChange={(isOpen) => {
            if (!isOpen) resetForm();
            onOpenChange(isOpen);
        }}>
            <SheetContent className="w-[400px] sm:w-[480px]">
                <SheetHeader>
                    <SheetTitle>Create New Quote</SheetTitle>
                    <SheetDescription>
                        Generate a locked pricing quote for the selected service.
                    </SheetDescription>
                </SheetHeader>

                <form onSubmit={handleSubmit} className="space-y-6 mt-6">
                    {/* Service Code */}
                    <div className="space-y-2">
                        <Label htmlFor="service_code">Service Code *</Label>
                        <Select value={serviceCode} onValueChange={setServiceCode} required>
                            <SelectTrigger id="service_code">
                                <SelectValue placeholder="Select a service" />
                            </SelectTrigger>
                            <SelectContent>
                                {serviceCodes.map((code) => (
                                    <SelectItem key={code} value={code}>
                                        {code}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Urgency */}
                    <div className="space-y-3">
                        <Label>Urgency *</Label>
                        <RadioGroup value={urgency} onValueChange={(v: 'same_day' | 'next_day' | 'standard') => setUrgency(v)}>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="standard" id="urgency-standard" />
                                <Label htmlFor="urgency-standard" className="font-normal">Standard</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="next_day" id="urgency-next-day" />
                                <Label htmlFor="urgency-next-day" className="font-normal">Next Day (+20%)</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="same_day" id="urgency-same-day" />
                                <Label htmlFor="urgency-same-day" className="font-normal">Same Day (+50%)</Label>
                            </div>
                        </RadioGroup>
                    </div>

                    {/* Complexity */}
                    <div className="space-y-3">
                        <Label>Complexity *</Label>
                        <RadioGroup value={complexity} onValueChange={(v: 'simple' | 'standard' | 'complex') => setComplexity(v)}>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="simple" id="complexity-simple" />
                                <Label htmlFor="complexity-simple" className="font-normal">Simple (-20%)</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="standard" id="complexity-standard" />
                                <Label htmlFor="complexity-standard" className="font-normal">Standard</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="complex" id="complexity-complex" />
                                <Label htmlFor="complexity-complex" className="font-normal">Complex (+50%)</Label>
                            </div>
                        </RadioGroup>
                    </div>

                    {/* Parts Cost */}
                    <div className="space-y-2">
                        <Label htmlFor="parts_cost">Parts Cost (Optional)</Label>
                        <Input
                            id="parts_cost"
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={partsCost}
                            onChange={(e) => setPartsCost(e.target.value)}
                        />
                    </div>

                    {/* Ticket ID */}
                    <div className="space-y-2">
                        <Label htmlFor="ticket_id">Ticket ID (Optional)</Label>
                        <Input
                            id="ticket_id"
                            placeholder="UUID"
                            value={ticketId}
                            onChange={(e) => setTicketId(e.target.value)}
                        />
                    </div>

                    {/* Customer ID */}
                    <div className="space-y-2">
                        <Label htmlFor="customer_id">Customer ID (Optional)</Label>
                        <Input
                            id="customer_id"
                            placeholder="UUID"
                            value={customerId}
                            onChange={(e) => setCustomerId(e.target.value)}
                        />
                    </div>

                    {/* Submit */}
                    <div className="flex gap-3 pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={!serviceCode || isSubmitting}
                        >
                            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Create Quote
                        </Button>
                    </div>
                </form>
            </SheetContent>
        </Sheet>
    );
}
