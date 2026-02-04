import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Wrench } from 'lucide-react';

export default function ServicesPage() {
  const services = [
    {
      id: 'television',
      title: 'TV Repair',
      description: 'All sizes & brands - LED, LCD, QLED, OLED, Smart TVs',
      image: '/assets/categories/tv-repair.webp',
      features: ['Panel replacement', 'Power supply repair', 'Software updates', 'Warranty on repair']
    },
    {
      id: 'mobile',
      title: 'Mobile Repair',
      description: 'Smartphones & tablets - All brands and models',
      image: '/assets/categories/mobile-repair.webp',
      features: ['Screen replacement', 'Battery repair', 'Water damage', 'Software fixes']
    },
    {
      id: 'laptop',
      title: 'Laptop Repair',
      description: 'All models supported - Dell, HP, Lenovo, Apple, etc.',
      image: '/assets/categories/laptop-repair.webp',
      features: ['Screen repair', 'Keyboard replacement', 'Battery service', 'Performance optimization']
    },
    {
      id: 'microwave',
      title: 'Appliances',
      description: 'Microwave, washing machine, refrigerator & more',
      image: '/assets/categories/appliances.webp',
      features: ['Microwave repair', 'Washing machine', 'Refrigerator', 'Small appliances']
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">Our Services</h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Professional repair services for all your electronic devices. Trusted by thousands of customers
            across India for quality and transparency.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-6xl mx-auto">
          {services.map((service) => (
            <div
              key={service.id}
              className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300"
            >
              <div className="h-56 overflow-hidden">
                <img
                  src={service.image}
                  alt={service.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-8">
                <div className="flex items-center mb-4">
                  <Wrench className="w-6 h-6 text-blue-500 dark:text-blue-400 mr-2" />
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{service.title}</h2>
                </div>
                <p className="text-gray-600 dark:text-gray-300 mb-6 text-lg">
                  {service.description}
                </p>
                <div className="mb-8">
                  <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-lg mb-3">What we offer:</h3>
                  <ul className="space-y-2">
                    {service.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                        <span className="text-gray-600 dark:text-gray-300">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <Button asChild className="w-full sm:w-auto">
                    <Link href={`/book?category=${service.id}`}>
                      Book Service Now
                    </Link>
                  </Button>
                  <span className="text-base font-medium text-gray-700 dark:text-gray-300">
                    Starting at ₹XXX
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="max-w-2xl mx-auto mt-20 text-center">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Can't find the service you're looking for?
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6 text-lg">
              Contact us for custom repair solutions tailored to your specific needs.
            </p>
            <Button variant="outline" size="lg" asChild>
              <Link href="/contact">Contact Us</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}