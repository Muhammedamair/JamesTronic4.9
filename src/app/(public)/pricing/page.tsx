import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function PricingPage() {
  const pricingPlans = [
    {
      name: 'Basic Repair',
      description: 'Simple repairs that don\'t require parts',
      price: '₹299',
      features: [
        'Diagnosis included',
        'Labor cost only',
        '30-day workmanship guarantee',
        'Free pickup & drop'
      ],
      popular: false
    },
    {
      name: 'Standard Repair',
      description: 'Repairs that include minor parts replacement',
      price: '₹599+',
      features: [
        'Diagnosis included',
        'Labor + parts cost',
        '90-day workmanship guarantee',
        'Free pickup & drop',
        'Quality parts warranty'
      ],
      popular: true
    },
    {
      name: 'Premium Repair',
      description: 'Complex repairs with major parts replacement',
      price: '₹999+',
      features: [
        'Complete diagnosis',
        'Labor + premium parts',
        '6-month workmanship guarantee',
        'Free pickup & drop',
        'Priority service',
        'Extended warranty options'
      ],
      popular: false
    }
  ];

  const servicePricing = [
    {
      category: 'TV Repair',
      services: [
        { name: 'Screen replacement (LED)', price: '₹2,999+' },
        { name: 'Screen replacement (QLED/OLED)', price: '₹7,999+' },
        { name: 'Power supply repair', price: '₹1,499+' },
        { name: 'Remote replacement', price: '₹499' },
        { name: 'Software update', price: '₹599' }
      ]
    },
    {
      category: 'Mobile Repair',
      services: [
        { name: 'Screen replacement (iPhone)', price: '₹3,999+' },
        { name: 'Screen replacement (Android)', price: '₹1,999+' },
        { name: 'Battery replacement', price: '₹899+' },
        { name: 'Charging port repair', price: '₹1,299+' },
        { name: 'Camera repair', price: '₹2,499+' }
      ]
    },
    {
      category: 'Laptop Repair',
      services: [
        { name: 'Screen replacement', price: '₹3,499+' },
        { name: 'Keyboard replacement', price: '₹1,299+' },
        { name: 'Battery service', price: '₹1,999+' },
        { name: 'Performance optimization', price: '₹1,499' },
        { name: 'Windows installation', price: '₹1,999' }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-6xl mx-auto py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-4">Transparent Pricing</h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            No hidden charges. No surprises. Know exactly what you'll pay before we start.
          </p>
        </div>

        <div className="mb-12">
          <h2 className="text-3xl font-bold text-center text-gray-800 dark:text-white mb-8">Repair Plans</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {pricingPlans.map((plan, index) => (
              <Card key={index} className={`shadow-lg ${plan.popular ? 'ring-2 ring-blue-500' : ''}`}>
                {plan.popular && (
                  <div className="bg-blue-500 text-white text-center py-1 text-sm font-semibold">
                    MOST POPULAR
                  </div>
                )}
                <CardHeader className="text-center">
                  <CardTitle className="text-2xl text-gray-800 dark:text-white">{plan.name}</CardTitle>
                  <CardDescription className="text-gray-600 dark:text-gray-400">
                    {plan.description}
                  </CardDescription>
                  <div className="text-3xl font-bold mt-4">{plan.price}</div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 mb-6">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center">
                        <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
                        <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button className="w-full" asChild>
                    <Link href="/book">Book Now</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="mb-12">
          <h2 className="text-3xl font-bold text-center text-gray-800 dark:text-white mb-8">Service-Specific Pricing</h2>
          <div className="space-y-12">
            {servicePricing.map((category, index) => (
              <div key={index}>
                <h3 className="text-2xl font-semibold text-gray-800 dark:text-white mb-6 text-center">{category.category}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {category.services.map((service, idx) => (
                    <Card key={idx} className="shadow">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-800 dark:text-white">{service.name}</span>
                          <span className="font-semibold text-blue-600 dark:text-blue-400">{service.price}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center">
          <Card className="max-w-2xl mx-auto">
            <CardContent className="p-6">
              <p className="text-lg text-gray-700 dark:text-gray-300 mb-4">
                Prices may vary based on device model, availability of parts, and complexity of repair.
              </p>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Get an exact quote by booking a free diagnosis.
              </p>
              <Button asChild>
                <Link href="/book">Get Free Diagnosis</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}