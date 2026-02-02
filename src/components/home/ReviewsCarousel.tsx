'use client';

import React, { useRef, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';

interface Review {
    id: string;
    name: string;
    date: string;
    rating: number;
    service: string;
    comment: string;
    avatar?: string;
}

interface ReviewsCarouselProps {
    reviews?: Review[];
    className?: string;
}

const defaultReviews: Review[] = [
    {
        id: '1',
        name: 'Rajesh K.',
        date: 'Jan 3, 2026',
        rating: 5,
        service: 'TV Repair - Display Issue',
        comment: 'Excellent service! The technician was very professional and fixed my Samsung TV within 2 hours. Highly recommended.'
    },
    {
        id: '2',
        name: 'Priya M.',
        date: 'Jan 2, 2026',
        rating: 5,
        service: 'Mobile Repair - Screen Replacement',
        comment: 'Very satisfied with the service. Original parts used and the phone works like new. Great customer support.'
    },
    {
        id: '3',
        name: 'Suresh R.',
        date: 'Jan 1, 2026',
        rating: 4,
        service: 'Laptop Repair - Battery Issue',
        comment: 'Good service overall. The pickup was on time and my laptop was returned next day. Minor delay in communication though.'
    },
    {
        id: '4',
        name: 'Anita S.',
        date: 'Dec 31, 2025',
        rating: 5,
        service: 'Microwave Repair',
        comment: 'Quick diagnosis and fair pricing. The technician explained everything clearly. Will use again.'
    },
    {
        id: '5',
        name: 'Mohammed A.',
        date: 'Dec 30, 2025',
        rating: 5,
        service: 'TV Repair - Power Issue',
        comment: 'Best repair service in Hyderabad! They picked up my LG TV and delivered it back working perfectly. 5 stars!'
    }
];

const ReviewCard: React.FC<{ review: Review }> = ({ review }) => (
    <div className="flex-shrink-0 w-[320px] md:w-[360px] bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg transition-shadow">
        <div className="flex items-start gap-3 mb-4">
            {/* Avatar */}
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-semibold">
                {review.name.charAt(0)}
            </div>
            <div className="flex-1">
                <div className="font-semibold text-gray-900">{review.name}</div>
                <div className="text-xs text-gray-500">{review.date} • {review.service}</div>
            </div>
            {/* Rating */}
            <div className="flex items-center gap-1 text-sm">
                <span className="font-semibold text-gray-900">{review.rating}</span>
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            </div>
        </div>
        <p className="text-gray-600 text-sm leading-relaxed line-clamp-3">
            {review.comment}
        </p>
    </div>
);

export const ReviewsCarousel: React.FC<ReviewsCarouselProps> = ({
    reviews = defaultReviews,
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
            const scrollAmount = 380;
            scrollRef.current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            });
        }
    };

    // Calculate average rating
    const avgRating = (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(2);

    return (
        <section className={cn("py-16 bg-gray-50", className)}>
            <div className="container mx-auto px-4">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                            Customer Reviews
                        </h2>
                        <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold text-gray-900">{avgRating}</span>
                            <div className="flex">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <Star
                                        key={star}
                                        className={cn(
                                            "w-5 h-5",
                                            star <= Math.round(parseFloat(avgRating))
                                                ? "fill-yellow-400 text-yellow-400"
                                                : "fill-gray-200 text-gray-200"
                                        )}
                                    />
                                ))}
                            </div>
                            <span className="text-gray-500 text-sm">({reviews.length} reviews)</span>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => scroll('left')}
                            disabled={!canScrollLeft}
                            className={cn(
                                "p-2 rounded-full border transition-all",
                                canScrollLeft
                                    ? "border-gray-300 hover:border-gray-400 hover:bg-white"
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
                                    ? "border-gray-300 hover:border-gray-400 hover:bg-white"
                                    : "border-gray-200 text-gray-300 cursor-not-allowed"
                            )}
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div
                    ref={scrollRef}
                    className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth pb-4"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                    {reviews.map((review) => (
                        <ReviewCard key={review.id} review={review} />
                    ))}
                </div>
            </div>
        </section>
    );
};

export default ReviewsCarousel;
