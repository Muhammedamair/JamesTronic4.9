'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { BrandLogo } from '@/components/ui/brand-logo';
import { CheckCircle, ChevronDown, ChevronUp, ChevronRight, Wrench, Smartphone, Laptop, Tv } from 'lucide-react';
import { TransparencyBanner } from '@/components/trust/transparency-banner';
import { cn } from '@/lib/utils';
import { TVIcon, MobileIcon, LaptopIcon, ApplianceIcon } from '@/components/home/CategoryCard';

// Reusing constants from DeviceIntakeForm to maintain consistency
const brandOptions = [
    { id: 'lg', name: 'LG', logo: '/brands/lg.svg' },
    { id: 'samsung', name: 'Samsung', logo: '/brands/samsung.svg' },
    { id: 'sony', name: 'Sony', logo: '/brands/sony.svg' },
    { id: 'micromax', name: 'Micromax', logo: '/brands/micromax.svg' },
    { id: 'panasonic', name: 'Panasonic', logo: '/brands/panasonic.svg' },
    { id: 'vu', name: 'Vu', logo: '/brands/vu.svg' },
    { id: 'videocon', name: 'Videocon', logo: '/brands/videocon.svg' },
    { id: 'philips', name: 'Philips', logo: '/brands/philips.svg' },
    { id: 'hassan', name: 'Hassan', logo: '/brands/hassan.svg' },
    { id: 'toshiba', name: 'Toshiba', logo: '/brands/toshiba.svg' },
    { id: 'apple', name: 'Apple', logo: '/brands/apple.svg' },
    { id: 'dell', name: 'Dell', logo: '/brands/dell.svg' },
    { id: 'hp', name: 'HP', logo: '/brands/hp.svg' },
    { id: 'lenovo', name: 'Lenovo', logo: '/brands/lenovo.svg' },
    { id: 'mi', name: 'Xiaomi', logo: '/brands/mi.svg' },
    { id: 'oneplus', name: 'OnePlus', logo: '/brands/oneplus.svg' },
    { id: 'oppo', name: 'Oppo', logo: '/brands/oppo.svg' },
    { id: 'vivo', name: 'Vivo', logo: '/brands/vivo.svg' },
];

const tvSizes = [24, 32, 40, 42, 43, 46, 49, 50, 55, 65, 75, 80, 85, 90, 100, 104];

const commonIssues = {
    television: ['No Picture', 'No Sound', 'Red Light/Power Issues', 'Power Supply Dead', 'Back Light Problem', 'Display Broken', 'Display Lines', 'Motherboard Issues', 'Soundboard Problems', 'Remote Not Working', 'HDMI Port Issues', 'Power Button Not Working'],
    microwave: ['Not Heating', 'Won\'t Start', 'Turntable Not Working', 'Overheating', 'Sparking', 'Noise Problems', 'Door Issues', 'Control Panel Problems', 'Fan Not Working', 'Timer Not Working', 'Light Not Working', 'Power Supply Issues'],
    laptop: ['Battery Not Charging', 'Screen Issues', 'Keyboard Problems', 'Overheating', 'Boot Issues', 'No Power', 'Slow Performance', 'WiFi Problems', 'Sound Issues', 'Touchpad Problems', 'Charging Port Issues', 'Hinge Problems'],
    mobile: ['Battery Issues', 'Screen Broken', 'Charging Problems', 'No Power', 'Touch Issues', 'Camera Problems', 'Sound Issues', 'WiFi/Network Issues', 'Water Damage', 'Slow Performance', 'Battery Drain', 'Software Problems']
};

export interface PublicBookingFormProps {
    initialData?: any;
    onChange: (data: any) => void;
    onSubmit: (formData: any) => void;
}

export const PublicBookingForm: React.FC<PublicBookingFormProps> = ({
    initialData,
    onChange,
    onSubmit
}) => {
    const [step, setStep] = useState(initialData?.deviceCategory ? 2 : 1);
    const [formData, setFormData] = useState({
        customerName: initialData?.customerName || '',
        customerPhone: initialData?.customerPhone || '',
        customerArea: initialData?.customerArea || '',
        customerStreet: initialData?.customerStreet || '',
        deviceCategory: initialData?.deviceCategory || 'television',
        brand: initialData?.brand || '',
        model: initialData?.model || '',
        size: initialData?.size || '',
        issueSummary: initialData?.issueSummary || '',
        issueDetails: initialData?.issueDetails || '',
        commonIssue: initialData?.commonIssue || '',
    });

    const [showBrandSelector, setShowBrandSelector] = useState(false);
    const [showCommonIssues, setShowCommonIssues] = useState(false);

    // Notify parent of changes for cart
    useEffect(() => {
        onChange(formData);
    }, [formData, onChange]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleCategorySelect = (category: string) => {
        setFormData(prev => ({ ...prev, deviceCategory: category, brand: '', model: '', size: '', issueSummary: '', issueDetails: '' }));
        setStep(2);
    };

    const handleBrandSelect = (brand: string) => {
        setFormData(prev => ({ ...prev, brand }));
        setShowBrandSelector(false);
    };

    const handleCommonIssueSelect = (issue: string) => {
        setFormData(prev => ({ ...prev, commonIssue: issue }));
        setShowCommonIssues(false);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const finalFormData = {
            ...formData,
            issueSummary: formData.commonIssue || formData.issueSummary
        };
        onSubmit(finalFormData);
    };

    // Helper to render brand logo
    const renderBrandLogo = (brandId: string, size: string = 'w-6 h-6') => {
        const brandOption = brandOptions.find(b => b.id === brandId);
        if (!brandOption) {
            return <BrandLogo brandId={brandId} className={size} />;
        }
        return (
            <div className={size}>
                <img
                    src={brandOption.logo}
                    alt={brandOption.name}
                    className={`${size} object-contain`}
                    onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        // Fallback would be handled by parent or CSS
                    }}
                />
            </div>
        );
    };

    return (
        <div className="w-full max-w-2xl">
            {/* Progress Steps */}
            <div className="flex items-center gap-2 mb-8 text-sm font-medium">
                <div className={cn("flex items-center gap-2", step >= 1 ? "text-indigo-600" : "text-gray-400")}>
                    <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs border", step >= 1 ? "bg-indigo-600 text-white border-indigo-600" : "border-gray-300")}>1</div>
                    <span>Device</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
                <div className={cn("flex items-center gap-2", step >= 2 ? "text-indigo-600" : "text-gray-400")}>
                    <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs border", step >= 2 ? "bg-indigo-600 text-white border-indigo-600" : "border-gray-300")}>2</div>
                    <span>Details</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
                <div className={cn("flex items-center gap-2", step >= 3 ? "text-indigo-600" : "text-gray-400")}>
                    <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs border", step >= 3 ? "bg-indigo-600 text-white border-indigo-600" : "border-gray-300")}>3</div>
                    <span>Info</span>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">

                {/* Step 1: Device Category */}
                {step === 1 && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                        <h2 className="text-2xl font-bold text-gray-900">Select Device Type</h2>
                        <div className="grid grid-cols-2 gap-4">
                            {[
                                { id: 'television', name: 'TV Repair', icon: <TVIcon /> },
                                { id: 'mobile', name: 'Mobile', icon: <MobileIcon /> },
                                { id: 'laptop', name: 'Laptop', icon: <LaptopIcon /> },
                                { id: 'microwave', name: 'Microwave', icon: <ApplianceIcon /> }
                            ].map((cat) => (
                                <div
                                    key={cat.id}
                                    onClick={() => handleCategorySelect(cat.id)}
                                    className={cn(
                                        "cursor-pointer rounded-2xl border-2 p-6 flex flex-col items-center gap-4 transition-all hover:border-indigo-600 hover:shadow-md bg-white",
                                        formData.deviceCategory === cat.id ? "border-indigo-600 bg-indigo-50" : "border-gray-100"
                                    )}
                                >
                                    <div className="w-16 h-16">{cat.icon}</div>
                                    <span className="font-semibold text-gray-900">{cat.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Step 2: Device Details & Issue */}
                {step === 2 && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-2xl font-bold text-gray-900">Device Details</h2>
                                <Button variant="ghost" size="sm" onClick={() => setStep(1)} type="button">Change Device</Button>
                            </div>

                            {/* Brand Selection */}
                            <div className="space-y-2">
                                <Label>Brand</Label>
                                <div className="relative">
                                    <button
                                        type="button"
                                        className="w-full p-3 border border-gray-300 rounded-xl flex items-center justify-between hover:border-indigo-500 bg-white"
                                        onClick={() => setShowBrandSelector(!showBrandSelector)}
                                    >
                                        <div className="flex items-center gap-2">
                                            {formData.brand && renderBrandLogo(formData.brand)}
                                            <span className={!formData.brand ? "text-gray-500" : ""}>
                                                {formData.brand ? brandOptions.find(b => b.id === formData.brand)?.name : "Select Brand"}
                                            </span>
                                        </div>
                                        <ChevronDown className="w-4 h-4 text-gray-500" />
                                    </button>

                                    {showBrandSelector && (
                                        <div className="absolute z-10 mt-2 w-full bg-white border border-gray-100 rounded-xl shadow-xl p-4 grid grid-cols-4 gap-2 max-h-64 overflow-y-auto">
                                            {brandOptions.map((brand) => (
                                                <button
                                                    key={brand.id}
                                                    type="button"
                                                    onClick={() => handleBrandSelect(brand.id)}
                                                    className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-gray-50"
                                                >
                                                    {renderBrandLogo(brand.id)}
                                                    <span className="text-xs text-center truncate w-full">{brand.name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Model & Size */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Model Number (Optional)</Label>
                                    <Input
                                        name="model"
                                        value={formData.model}
                                        onChange={handleInputChange}
                                        placeholder="e.g. SM-G990"
                                        className="rounded-xl"
                                    />
                                </div>
                                {formData.deviceCategory === 'television' && (
                                    <div className="space-y-2">
                                        <Label>Screen Size</Label>
                                        <Select value={formData.size} onValueChange={(val) => setFormData(d => ({ ...d, size: val }))}>
                                            <SelectTrigger className="rounded-xl">
                                                <SelectValue placeholder="Select Size" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {tvSizes.map(s => (
                                                    <SelectItem key={s} value={s.toString()}>{s} inches</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </div>

                            {/* Issues */}
                            <div className="space-y-2 pt-4 border-t border-gray-100">
                                <h3 className="font-semibold text-gray-900">What's the issue?</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    {((commonIssues as any)[formData.deviceCategory] || []).slice(0, 6).map((issue: string) => (
                                        <button
                                            type="button"
                                            key={issue}
                                            onClick={() => handleCommonIssueSelect(issue)}
                                            className={cn(
                                                "p-3 text-sm text-left border rounded-xl transition-all hover:border-indigo-500",
                                                formData.commonIssue === issue ? "bg-indigo-50 border-indigo-600 text-indigo-700" : "bg-white border-gray-200"
                                            )}
                                        >
                                            {issue}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    className="text-sm text-indigo-600 font-medium hover:underline flex items-center gap-1 mt-2"
                                    onClick={() => setShowCommonIssues(!showCommonIssues)}
                                >
                                    Show more issues <ChevronDown className="w-3 h-3" />
                                </button>

                                {showCommonIssues && (
                                    <div className="grid grid-cols-2 gap-3 mt-3 animate-in fade-in zoom-in-95">
                                        {((commonIssues as any)[formData.deviceCategory] || []).slice(6).map((issue: string) => (
                                            <button
                                                type="button"
                                                key={issue}
                                                onClick={() => handleCommonIssueSelect(issue)}
                                                className={cn(
                                                    "p-3 text-sm text-left border rounded-xl transition-all hover:border-indigo-500",
                                                    formData.commonIssue === issue ? "bg-indigo-50 border-indigo-600 text-indigo-700" : "bg-white border-gray-200"
                                                )}
                                            >
                                                {issue}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                <div className="space-y-2 mt-4">
                                    <Label>Other Details</Label>
                                    <Textarea
                                        name="issueDetails"
                                        value={formData.issueDetails}
                                        onChange={handleInputChange}
                                        placeholder="Describe specific symptoms..."
                                        className="rounded-xl"
                                    />
                                </div>
                            </div>

                            <div className="pt-4">
                                <Button
                                    type="button"
                                    className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700"
                                    onClick={() => setStep(3)}
                                    disabled={!formData.brand || (!formData.commonIssue && !formData.issueSummary && !formData.issueDetails)}
                                >
                                    Continue
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 3: Customer Info (Address) */}
                {step === 3 && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-2xl font-bold text-gray-900">Pickup Details</h2>
                                <Button variant="ghost" size="sm" onClick={() => setStep(2)} type="button">Back</Button>
                            </div>

                            <TransparencyBanner />

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Full Name</Label>
                                    <Input name="customerName" value={formData.customerName} onChange={handleInputChange} placeholder="Your Name" className="rounded-xl" required />
                                </div>
                                <div className="space-y-2">
                                    <Label>Phone Number</Label>
                                    <Input name="customerPhone" value={formData.customerPhone} onChange={handleInputChange} placeholder="+91 98765 43210" className="rounded-xl" required type="tel" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Area / Locality</Label>
                                        <Input name="customerArea" value={formData.customerArea} onChange={handleInputChange} placeholder="e.g. Hitech City" className="rounded-xl" required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Street / House No.</Label>
                                        <Input name="customerStreet" value={formData.customerStreet} onChange={handleInputChange} placeholder="Flat 402, Building A" className="rounded-xl" />
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4">
                                {/* Handled by CartSidebar checkout, but showing here for mobile or clarity */}
                                <p className="text-sm text-gray-500 text-center mb-4">
                                    Proceeding to confirmation...
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </form>
        </div>
    );
};
