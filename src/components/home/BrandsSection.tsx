'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface BrandsSectionProps {
    className?: string;
}

// Indian market brands for TV, Mobile, Laptop, Microwave
const brands = [
    { name: 'Samsung', logo: '/assets/brands/samsung.svg' },
    { name: 'LG', logo: '/assets/brands/lg.svg' },
    { name: 'Sony', logo: '/assets/brands/sony.svg' },
    { name: 'Panasonic', logo: '/assets/brands/panasonic.svg' },
    { name: 'Videocon', logo: '/assets/brands/videocon.svg' },
    { name: 'Hisense', logo: '/assets/brands/hisense.svg' },
    { name: 'TCL', logo: '/assets/brands/tcl.svg' },
    { name: 'Xiaomi', logo: '/assets/brands/xiaomi.svg' },
    { name: 'OnePlus', logo: '/assets/brands/oneplus.svg' },
    { name: 'Whirlpool', logo: '/assets/brands/whirlpool.svg' },
    { name: 'HP', logo: '/assets/brands/hp.svg' },
    { name: 'Dell', logo: '/assets/brands/dell.svg' },
];

// Fallback brand display without logos
const BrandPill: React.FC<{ name: string }> = ({ name }) => (
    <div className="px-6 py-3 bg-white border border-gray-200 rounded-xl text-gray-700 font-medium hover:border-gray-300 transition-colors">
        {name}
    </div>
);

export const BrandsSection: React.FC<BrandsSectionProps> = ({ className }) => {
    return (
        <section className={cn("py-16 bg-white", className)}>
            <div className="container mx-auto px-4">
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4 text-center">
                    We Service All Brands
                </h2>
                <p className="text-gray-500 text-center mb-10 max-w-2xl mx-auto">
                    Expert repairs for all major brands in India — TV, Mobile, Laptop & Microwave
                </p>

                <div className="flex flex-wrap justify-center gap-4 max-w-4xl mx-auto">
                    {brands.map((brand) => (
                        <BrandPill key={brand.name} name={brand.name} />
                    ))}
                    <BrandPill name="& more" />
                </div>

                <p className="text-xs text-gray-400 text-center mt-8">
                    Logos & trademarks are used for illustrative purposes. We do not claim any affiliation with the respective brands.
                </p>
            </div>
        </section>
    );
};

export default BrandsSection;
