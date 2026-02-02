'use client';

import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Wrench, ArrowLeft } from 'lucide-react';

export default function ServiceCategoryPage() {
  const { category } = useParams<{ category: string }>();

  // Define service categories
  const serviceCategories: Record<string, { title: string; description: string; services: string[]; image: string }> = {
    television: {
      title: 'TV Repair Services',
      description: 'Professional repair for all TV brands and models including LED, LCD, QLED, and OLED.',
      services: [
        'Screen replacement',
        'Panel repair',
        'Power supply issues',
        'Software updates',
        'HDMI port repair',
        'Audio problems',
        'Remote control issues'
      ],
      image: '/assets/categories/tv-repair.webp'
    },
    mobile: {
      title: 'Mobile & Tablet Repair',
      description: 'Expert repair for smartphones and tablets of all brands - iPhone, Samsung, etc.',
      services: [
        'Screen replacement',
        'Battery replacement',
        'Water damage repair',
        'Charging port repair',
        'Camera issues',
        'Software problems',
        'Battery optimization'
      ],
      image: '/assets/categories/mobile-repair.webp'
    },
    laptop: {
      title: 'Laptop Repair',
      description: 'Comprehensive repair for all laptop brands including Dell, HP, Lenovo, Apple, etc.',
      services: [
        'Screen replacement',
        'Keyboard repair',
        'Battery service',
        'Performance optimization',
        'Software installation',
        'Data recovery',
        'Port repair'
      ],
      image: '/assets/categories/laptop-repair.webp'
    },
    microwave: {
      title: 'Home Appliances',
      description: 'Repair services for various home appliances including microwaves, washing machines, and more.',
      services: [
        'Microwave repair',
        'Washing machine service',
        'Refrigerator maintenance',
        'Blender repair',
        'Coffee maker service',
        'Toaster repair',
        'Food processor maintenance'
      ],
      image: '/assets/categories/appliances.webp'
    }
  };

  const selectedCategory = serviceCategories[category as string];

  if (!selectedCategory) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <Button variant="outline" asChild className="mb-8">
            <Link href="/services">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Services
            </Link>
          </Button>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="h-80 overflow-hidden">
              <img
                src={selectedCategory.image}
                alt={selectedCategory.title}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="p-8">
              <div className="mb-8">
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">{selectedCategory.title}</h1>
                <p className="text-lg text-gray-600 dark:text-gray-300 mb-6">{selectedCategory.description}</p>

                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Services we offer:</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedCategory.services.map((service, index) => (
                    <div key={index} className="flex items-start">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-3 mr-4 flex-shrink-0"></div>
                      <span className="text-gray-700 dark:text-gray-300 text-lg">{service}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" className="text-lg px-8 py-6">
                  <Link href={`/book?category=${category}`}>
                    <Wrench className="w-5 h-5 mr-2" />
                    Book This Service
                  </Link>
                </Button>
                <Button variant="outline" asChild size="lg" className="text-lg px-8 py-6">
                  <Link href="/services">Browse All Services</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}