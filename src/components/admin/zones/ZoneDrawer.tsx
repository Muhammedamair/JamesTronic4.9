'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { zoneApi, NewZone } from '@/lib/api/zones';

// Define Zod schema for validation
const zoneSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  pincodes: z.array(z.string()).optional(),
});

type ZoneFormData = z.infer<typeof zoneSchema>;

interface ZoneDrawerProps {
  zone?: any;
  action: 'create' | 'edit' | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const ZoneDrawer: React.FC<ZoneDrawerProps> = ({ zone, action, onClose, onSuccess }) => {
  const [pincodes, setPincodes] = useState<string[]>(zone?.pincodes || []);
  const [newPincode, setNewPincode] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue
  } = useForm<ZoneFormData>({
    resolver: zodResolver(zoneSchema),
    defaultValues: {
      name: zone?.name || '',
      description: zone?.description || '',
      pincodes: zone?.pincodes || [],
    }
  });

  // Update form values when zone prop changes
  useEffect(() => {
    if (zone) {
      setValue('name', zone.name);
      setValue('description', zone.description || '');
      setPincodes(zone.pincodes || []);
    } else {
      reset({
        name: '',
        description: '',
        pincodes: [],
      });
      setPincodes([]);
    }
  }, [zone, setValue, reset]);

  const handleAddPincode = () => {
    if (newPincode.trim() && !pincodes.includes(newPincode.trim())) {
      setPincodes([...pincodes, newPincode.trim()]);
      setNewPincode('');
    }
  };

  const handleRemovePincode = (pincode: string) => {
    setPincodes(pincodes.filter(p => p !== pincode));
  };

  const onSubmit = async (data: ZoneFormData) => {
    try {
      const zoneData: NewZone = {
        ...data,
        pincodes: pincodes.length > 0 ? pincodes : null,
      };

      if (action === 'create') {
        await zoneApi.create(zoneData);
      } else if (action === 'edit' && zone?.id) {
        await zoneApi.update(zone.id, zoneData);
      }

      onSuccess();
    } catch (error) {
      console.error(`Error ${action === 'create' ? 'creating' : 'updating'} zone:`, error);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto p-6">
        <h2 className="text-xl font-bold mb-6 text-gray-900 dark:text-white">
          {action === 'create' ? 'Create New Zone' : 'Edit Zone'}
        </h2>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Name Field */}
          <div className="space-y-2">
            <Label htmlFor="name">Zone Name *</Label>
            <Input
              id="name"
              {...register('name')}
              placeholder="Enter zone name"
            />
            {errors.name && (
              <p className="text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>

          {/* Description Field */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="Enter zone description"
              rows={3}
            />
            {errors.description && (
              <p className="text-sm text-red-600">{errors.description.message}</p>
            )}
          </div>

          {/* Pincodes Field */}
          <div className="space-y-2">
            <Label htmlFor="pincodes">Pincodes</Label>
            <div className="flex gap-2">
              <Input
                id="pincodes"
                value={newPincode}
                onChange={(e) => setNewPincode(e.target.value)}
                placeholder="Enter pincode"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddPincode();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleAddPincode}
              >
                Add
              </Button>
            </div>
            
            {/* Display added pincodes as badges */}
            <div className="flex flex-wrap gap-2 mt-2">
              {pincodes.map((pincode, index) => (
                <Badge key={index} variant="secondary" className="flex items-center gap-1">
                  {pincode}
                  <button
                    type="button"
                    onClick={() => handleRemovePincode(pincode)}
                    className="ml-1 text-gray-500 hover:text-gray-700"
                  >
                    <X size={14} />
                  </button>
                </Badge>
              ))}
            </div>
            
            {errors.pincodes && (
              <p className="text-sm text-red-600">{errors.pincodes.message}</p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting 
                ? (action === 'create' ? 'Creating...' : 'Updating...') 
                : (action === 'create' ? 'Create Zone' : 'Update Zone')
              }
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};