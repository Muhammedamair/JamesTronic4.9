import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface HeroSectionProps {
    className?: string;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ className }) => {
    return (
        <section className={cn("py-12 md:py-24 bg-white overflow-hidden", className)}>
            <div className="container mx-auto px-4">
                <div className="flex flex-col lg:flex-row items-center gap-12 max-w-6xl mx-auto">
                    {/* Left: Content */}
                    <div className="flex-1 text-left">
                        {/* Main Headline */}
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-gray-900 mb-6 leading-tight">
                            Expert Repair Services
                            <br />
                            <span className="text-indigo-600">At Your Doorstep</span>
                        </h1>

                        {/* Subtitle */}
                        <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-xl leading-relaxed">
                            Professional repair for TV, Mobile, Laptop & Appliances.
                            Transparent pricing, verified technicians, and 180-day warranty.
                        </p>

                        {/* CTA Buttons */}
                        <div className="flex flex-col sm:flex-row gap-4">
                            <Button asChild size="lg" className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-6 text-lg rounded-xl shadow-lg shadow-indigo-100">
                                <Link href="/book">
                                    Book a Repair
                                </Link>
                            </Button>
                            <Button asChild variant="outline" size="lg" className="border-gray-200 hover:bg-gray-50 px-8 py-6 text-lg rounded-xl">
                                <Link href="/pricing">
                                    View Pricing
                                </Link>
                            </Button>
                        </div>

                        {/* Trust Indicator */}
                        <div className="mt-10 flex flex-wrap items-center gap-6 text-sm text-gray-500">
                            <div className="flex items-center gap-2">
                                <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-xs font-bold">✓</div>
                                <span>180 Days Warranty</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-xs font-bold">✓</div>
                                <span>Verified Techs</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-xs font-bold">✓</div>
                                <span>Flat Pricing</span>
                            </div>
                        </div>
                    </div>

                    {/* Right: Modern Professional Image */}
                    <div className="flex-1 relative w-full max-w-lg lg:max-w-none">
                        <div className="relative z-10 rounded-3xl overflow-hidden shadow-2xl border-8 border-gray-50 transform hover:scale-[1.01] transition-transform duration-500">
                            <Image
                                src="/assets/hero/hero-premium.png"
                                alt="Professional Technician"
                                width={600}
                                height={600}
                                className="w-full h-auto object-cover"
                                priority
                            />
                        </div>
                        {/* Decorative Background Element */}
                        <div className="absolute -top-10 -right-10 w-64 h-64 bg-indigo-50 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
                        <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-purple-50 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default HeroSection;
