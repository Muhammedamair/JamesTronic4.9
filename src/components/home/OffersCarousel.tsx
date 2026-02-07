'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Offer {
    id: string;
    title: string;
    description: string;
    discount: string;
    bgColor: string;
    textColor?: string;
    validTill?: string;
}

interface OffersCarouselProps {
    offers?: Offer[];
    className?: string;
}

const defaultOffers: Offer[] = [
    {
        id: '1',
        title: 'First Repair Discount',
        description: 'Get 15% off on your first TV repair',
        discount: '15% OFF',
        bgColor: 'bg-gradient-to-r from-violet-500 to-purple-600',
        validTill: 'Limited time offer'
    },
    {
        id: '2',
        title: 'Festival Special',
        description: 'Special rates on all appliance repairs',
        discount: '₹100 OFF',
        bgColor: 'bg-gradient-to-r from-orange-400 to-pink-500',
        validTill: 'Valid this month'
    },
    {
        id: '3',
        title: 'Refer & Earn',
        description: 'Refer a friend and get ₹200 credit',
        discount: '₹200',
        bgColor: 'bg-gradient-to-r from-emerald-400 to-teal-500',
        validTill: 'No expiry'
    },
    {
        id: '4',
        title: 'Warranty Extension',
        description: '30 extra days warranty on mobile repairs',
        discount: '+30 Days',
        bgColor: 'bg-gradient-to-r from-blue-500 to-indigo-600',
        validTill: 'For premium customers'
    }
];

export const OffersCarousel: React.FC<OffersCarouselProps> = ({
    offers = defaultOffers,
    className
}) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(true);

    const checkScroll = () => {
        if (scrollRef.current) {
            const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
            setCanScrollLeft(scrollLeft > 0);
            setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
        }
    };

    useEffect(() => {
        checkScroll();
        const ref = scrollRef.current;
        if (ref) {
            ref.addEventListener('scroll', checkScroll);
            return () => ref.removeEventListener('scroll', checkScroll);
        }
    }, []);

    const scroll = (direction: 'left' | 'right') => {
        if (scrollRef.current) {
            const scrollAmount = 320;
            scrollRef.current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            });
        }
    };

    if (offers.length === 0) return null;

    return (
        <section className={cn("py-8", className)}>
            <div className="container mx-auto px-4">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl md:text-2xl font-bold text-gray-900">
                        Offers & Discounts
                    </h2>
                    <div className="flex gap-2">
                        <button
                            onClick={() => scroll('left')}
                            disabled={!canScrollLeft}
                            className={cn(
                                "p-2 rounded-full border transition-all",
                                canScrollLeft
                                    ? "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
                                    : "border-gray-200 text-gray-300 cursor-not-allowed"
                            )}
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => scroll('right')}
                            disabled={!canScrollRight}
                            className={cn(
                                "p-2 rounded-full border transition-all",
                                canScrollRight
                                    ? "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
                                    : "border-gray-200 text-gray-300 cursor-not-allowed"
                            )}
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div
                    ref={scrollRef}
                    className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth pb-2"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                    {offers.map((offer) => (
                        <div
                            key={offer.id}
                            className={cn(
                                "flex-shrink-0 w-[300px] rounded-2xl p-6 text-white cursor-pointer",
                                "transform transition-transform hover:scale-[1.02]",
                                offer.bgColor
                            )}
                        >
                            <div className="text-2xl font-black mb-2">{offer.discount}</div>
                            <div className="font-semibold text-lg mb-1">{offer.title}</div>
                            <div className="text-sm opacity-90 mb-3">{offer.description}</div>
                            {offer.validTill && (
                                <div className="text-xs opacity-75">{offer.validTill}</div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default OffersCarousel;
