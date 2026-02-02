'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';

interface HeroSlide {
  title: string;
  subtitle: string;
  media: string;
  cta_primary: { label: string; href: string };
  cta_secondary: { label: string; href: string };
}

interface HeroRotatorProps {
  slides: HeroSlide[];
}

export default function HeroRotator({ slides }: HeroRotatorProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Auto-rotate functionality
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % slides.length);
    }, 5000); // 5 seconds

    return () => clearInterval(interval);
  }, [isPaused, slides.length]);

  // Navigation functions
  const goToSlide = useCallback((index: number) => {
    setCurrentIndex(index);
  }, []);

  const goToNext = useCallback(() => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % slides.length);
  }, [slides.length]);

  const goToPrev = useCallback(() => {
    setCurrentIndex((prevIndex) => (prevIndex - 1 + slides.length) % slides.length);
  }, [slides.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        goToPrev();
      } else if (e.key === 'ArrowRight') {
        goToNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToPrev, goToNext]);

  const currentSlide = slides[currentIndex];

  return (
    <div 
      className="relative w-full h-[500px] md:h-[600px] overflow-hidden rounded-xl"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Background image */}
      <Image
        src={currentSlide.media}
        alt={currentSlide.title}
        fill
        style={{ objectFit: 'cover' }}
        priority
      />
      
      {/* Overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-black/40 md:from-black/40 md:to-black/20" />
      
      {/* Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-white z-10 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold mb-4 leading-tight">
            {currentSlide.title}
          </h1>
          <p className="text-lg md:text-xl lg:text-2xl mb-8 max-w-3xl mx-auto opacity-90">
            {currentSlide.subtitle}
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button 
              asChild 
              size="lg" 
              className="bg-white text-blue-600 hover:bg-blue-50 text-lg px-8 py-6 rounded-xl flex items-center"
            >
              <Link href={currentSlide.cta_primary.href}>
                {currentSlide.cta_primary.label}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            </Button>
            <Button 
              variant="secondary" 
              asChild 
              size="lg" 
              className="bg-transparent border-2 border-white text-white hover:bg-white/10 text-lg px-8 py-6 rounded-xl"
            >
              <Link href={currentSlide.cta_secondary.href}>
                {currentSlide.cta_secondary.label}
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Navigation Arrows - Shown only on desktop */}
      <button
        className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white p-2 rounded-full z-20 hidden md:block focus:outline-none focus:ring-2 focus:ring-white"
        onClick={goToPrev}
        aria-label="Previous slide"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>
      
      <button
        className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white p-2 rounded-full z-20 hidden md:block focus:outline-none focus:ring-2 focus:ring-white"
        onClick={goToNext}
        aria-label="Next slide"
      >
        <ChevronRight className="w-6 h-6" />
      </button>

      {/* Dots indicator */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex space-x-2 z-20">
        {slides.map((_, index) => (
          <button
            key={index}
            className={`w-3 h-3 rounded-full transition-all ${
              index === currentIndex ? 'bg-white w-6' : 'bg-white/50'
            }`}
            onClick={() => goToSlide(index)}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}