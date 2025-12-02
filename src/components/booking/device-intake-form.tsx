'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { BrandLogo } from '@/components/ui/brand-logo';
import { CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';

// Device categories with icons
const deviceCategories = [
  { id: 'television', name: 'Television', icon: '📺' },
  { id: 'microwave', name: 'Microwave', icon: 'oven' },
  { id: 'laptop', name: 'Laptop', icon: '💻' },
  { id: 'mobile', name: 'Mobile Phone', icon: '📱' },
];

// Brands with common logos
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

// TV sizes in inches
const tvSizes = [
  24, 32, 40, 42, 43, 46, 49, 50, 55, 65, 75, 80, 85, 90, 100, 104
];

// Common issues for each category
const commonIssues = {
  television: [
    'No Picture',
    'No Sound',
    'Red Light/Power Issues',
    'Power Supply Dead',
    'Back Light Problem',
    'Display Broken',
    'Display Lines',
    'Motherboard Issues',
    'Soundboard Problems',
    'Remote Not Working',
    'HDMI Port Issues',
    'Power Button Not Working'
  ],
  microwave: [
    'Not Heating',
    'Won\'t Start',
    'Turntable Not Working',
    'Overheating',
    'Sparking',
    'Noise Problems',
    'Door Issues',
    'Control Panel Problems',
    'Fan Not Working',
    'Timer Not Working',
    'Light Not Working',
    'Power Supply Issues'
  ],
  laptop: [
    'Battery Not Charging',
    'Screen Issues',
    'Keyboard Problems',
    'Overheating',
    'Boot Issues',
    'No Power',
    'Slow Performance',
    'WiFi Problems',
    'Sound Issues',
    'Touchpad Problems',
    'Charging Port Issues',
    'Hinge Problems'
  ],
  mobile: [
    'Battery Issues',
    'Screen Broken',
    'Charging Problems',
    'No Power',
    'Touch Issues',
    'Camera Problems',
    'Sound Issues',
    'WiFi/Network Issues',
    'Water Damage',
    'Slow Performance',
    'Battery Drain',
    'Software Problems'
  ]
};

interface DeviceIntakeFormProps {
  onSubmit: (formData: any) => void;
}

const DeviceIntakeForm: React.FC<DeviceIntakeFormProps> = ({ onSubmit }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    customerArea: '',
    deviceCategory: '',
    brand: '',
    model: '',
    size: '',
    issueSummary: '',
    issueDetails: '',
    commonIssue: '',
  });

  const [showBrandSelector, setShowBrandSelector] = useState(false);
  const [showCommonIssues, setShowCommonIssues] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCategoryChange = (value: string) => {
    setFormData(prev => ({ ...prev, deviceCategory: value, brand: '', model: '', size: '', issueSummary: '', issueDetails: '' }));
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

  const getFilteredBrands = () => {
    if (!formData.deviceCategory) return brandOptions;

    // In a real implementation, you might have device-specific brand filters
    return brandOptions;
  };

  // Function to render brand logo with fallback
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
            // If image fails to load, replace with fallback
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';

            // Create and append the fallback element
            const fallback = document.createElement('div');
            fallback.className = `flex items-center justify-center ${size}`;
            fallback.innerHTML = `<div class="flex items-center justify-center w-full h-full rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold text-xs">${brandId.charAt(0).toUpperCase() + brandId.slice(1, 3)}</div>`;
            target.parentElement?.appendChild(fallback);
          }}
        />
      </div>
    );
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Device Service Intake</CardTitle>
        <CardDescription>
          Please fill in the details for your service request
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6">
          {/* Step 1: Customer Information */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="customerName">Full Name</Label>
                <Input
                  id="customerName"
                  name="customerName"
                  value={formData.customerName}
                  onChange={handleInputChange}
                  placeholder="Enter customer full name"
                  required
                />
              </div>

              <div>
                <Label htmlFor="customerPhone">Phone Number</Label>
                <Input
                  id="customerPhone"
                  name="customerPhone"
                  value={formData.customerPhone}
                  onChange={handleInputChange}
                  placeholder="Enter phone number"
                  required
                />
              </div>

              <div>
                <Label htmlFor="customerArea">Area/Location</Label>
                <Input
                  id="customerArea"
                  name="customerArea"
                  value={formData.customerArea}
                  onChange={handleInputChange}
                  placeholder="Enter area/location"
                  required
                />
              </div>
            </div>
          )}

          {/* Step 2: Device Information */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <Label>Device Category</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                  {deviceCategories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      className={`p-4 border rounded-lg flex flex-col items-center justify-center transition-colors ${
                        formData.deviceCategory === category.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300'
                          : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                      onClick={() => handleCategoryChange(category.id)}
                    >
                      <span className="text-xl mb-1">{category.icon}</span>
                      <span className="text-sm">{category.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {formData.deviceCategory && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="brand">Brand</Label>
                    <div className="relative">
                      <button
                        type="button"
                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md flex items-center justify-between"
                        onClick={() => setShowBrandSelector(!showBrandSelector)}
                      >
                        <div className="flex items-center">
                          {formData.brand ? (
                            renderBrandLogo(formData.brand, 'w-6 h-6')
                          ) : (
                            <span className="text-gray-500 dark:text-gray-400">Select brand...</span>
                          )}
                          <span className="ml-2">
                            {formData.brand
                              ? brandOptions.find(b => b.id === formData.brand)?.name
                              : 'Select brand...'}
                          </span>
                        </div>
                        {showBrandSelector ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>

                      {showBrandSelector && (
                        <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-auto">
                          <div className="p-2">
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                              {getFilteredBrands().map((brand) => (
                                <button
                                  key={brand.id}
                                  type="button"
                                  className={`p-2 border rounded flex flex-col items-center ${
                                    formData.brand === brand.id
                                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                                  }`}
                                  onClick={() => handleBrandSelect(brand.id)}
                                >
                                  {renderBrandLogo(brand.id, 'w-8 h-8')}
                                  <span className="text-xs mt-1 truncate w-full text-center">{brand.name}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="model">Model Number</Label>
                    <Input
                      id="model"
                      name="model"
                      value={formData.model}
                      onChange={handleInputChange}
                      placeholder="Enter model number"
                    />
                  </div>

                  {formData.deviceCategory === 'television' && (
                    <div>
                      <Label htmlFor="size">Screen Size (inches)</Label>
                      <Select value={formData.size} onValueChange={(value) => setFormData(prev => ({ ...prev, size: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select size" />
                        </SelectTrigger>
                        <SelectContent>
                          {tvSizes.map((size) => (
                            <SelectItem key={size} value={size.toString()}>{size}"</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Issue Information */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="issueSummary">Issue Summary</Label>
                <div className="relative">
                  <button
                    type="button"
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md flex items-center justify-between"
                    onClick={() => setShowCommonIssues(!showCommonIssues)}
                  >
                    <span>
                      {formData.commonIssue || formData.issueSummary || 'Select common issue or enter manually...'}
                    </span>
                    {showCommonIssues ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>

                  {showCommonIssues && (
                    <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-auto">
                      <div className="p-2">
                        {(commonIssues as any)[formData.deviceCategory] ?
                          (commonIssues as any)[formData.deviceCategory].map((issue: string, index: number) => (
                            <button
                              key={index}
                              type="button"
                              className={`block w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                                formData.commonIssue === issue ? 'bg-blue-100 dark:bg-blue-900' : ''
                              }`}
                              onClick={() => handleCommonIssueSelect(issue)}
                            >
                              {issue}
                            </button>
                          ))
                        : (
                          <div className="px-3 py-2 text-gray-500 dark:text-gray-400">No common issues available for this category</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {!formData.commonIssue && (
                  <Input
                    id="issueSummary"
                    name="issueSummary"
                    value={formData.issueSummary}
                    onChange={handleInputChange}
                    placeholder="Enter issue summary"
                    className="mt-2"
                  />
                )}
              </div>

              <div>
                <Label htmlFor="issueDetails">Issue Details</Label>
                <Textarea
                  id="issueDetails"
                  name="issueDetails"
                  value={formData.issueDetails}
                  onChange={handleInputChange}
                  placeholder="Describe the issue in detail"
                  rows={4}
                />
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <div>
            {step > 1 && (
              <Button type="button" variant="outline" onClick={() => setStep(prev => prev - 1)}>
                Previous
              </Button>
            )}
          </div>
          <div>
            {step < 3 ? (
              <Button type="button" onClick={() => setStep(prev => prev + 1)}>
                Next
              </Button>
            ) : (
              <Button type="submit">
                <CheckCircle className="h-4 w-4 mr-2" />
                Submit Ticket
              </Button>
            )}
          </div>
        </CardFooter>
      </form>
    </Card>
  );
};

export { DeviceIntakeForm };