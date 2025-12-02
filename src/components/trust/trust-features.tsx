'use client';

import { Badge } from '@/components/ui/badge';
import { CheckCircle, Shield, Wallet, Timer, Package } from 'lucide-react';

interface TrustBadgeProps {
  text: string;
  icon: React.ReactNode;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
}

const TrustBadge = ({ text, icon, variant = 'default' }: TrustBadgeProps) => (
  <Badge variant={variant} className="flex items-center gap-1 text-xs py-1 px-2">
    {icon}
    {text}
  </Badge>
);

interface TrustFeaturesProps {
  showAll?: boolean; // If true, shows all trust features; if false, shows only key ones
}

export const TrustFeatures = ({ showAll = false }: TrustFeaturesProps) => {
  const features = [
    {
      text: "Technician Verified",
      icon: <CheckCircle className="w-3 h-3" />,
      variant: "default" as const
    },
    {
      text: "Parts Authenticated", 
      icon: <Package className="w-3 h-3" />,
      variant: "default" as const
    },
    {
      text: "Price Locked",
      icon: <Wallet className="w-3 h-3" />,
      variant: "default" as const
    },
    {
      text: "SLA Protected", 
      icon: <Timer className="w-3 h-3" />,
      variant: "default" as const
    },
    {
      text: "Payment Protected",
      icon: <Shield className="w-3 h-3" />,
      variant: "default" as const
    }
  ];

  // Show all features or just the key ones
  const displayedFeatures = showAll ? features : features.slice(0, 3);

  return (
    <div className="flex flex-wrap gap-2">
      {displayedFeatures.map((feature, index) => (
        <TrustBadge
          key={index}
          text={feature.text}
          icon={feature.icon}
          variant={feature.variant}
        />
      ))}
    </div>
  );
};

// Individual trust feature components for more granular control
export const TechnicianVerifiedBadge = () => (
  <TrustBadge 
    text="Technician Verified" 
    icon={<CheckCircle className="w-3 h-3" />} 
    variant="default" 
  />
);

export const PartsAuthenticatedBadge = () => (
  <TrustBadge 
    text="Parts Authenticated" 
    icon={<Package className="w-3 h-3" />} 
    variant="default" 
  />
);

export const PriceLockedBadge = () => (
  <TrustBadge 
    text="Price Locked" 
    icon={<Wallet className="w-3 h-3" />} 
    variant="default" 
  />
);

export const SLAProtectedBadge = () => (
  <TrustBadge 
    text="SLA Protected" 
    icon={<Timer className="w-3 h-3" />} 
    variant="default" 
  />
);

export const PaymentProtectedBadge = () => (
  <TrustBadge 
    text="Payment Protected" 
    icon={<Shield className="w-3 h-3" />} 
    variant="default" 
  />
);