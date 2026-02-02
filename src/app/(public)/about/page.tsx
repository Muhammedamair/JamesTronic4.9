import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-4xl mx-auto py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-4">About JamesTronic</h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            India's most trusted electronic repair service, revolutionizing the repair industry with technology and transparency.
          </p>
        </div>

        <Card className="shadow-lg mb-8">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-gray-800 dark:text-white">Our Story</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
            <p>
              Founded in Hyderabad, JamesTronic was born out of a simple frustration with the existing electronic repair ecosystem.
              Customers were often left in the dark about repair costs, timelines, and quality. Technicians faced inconsistent work and
              payment delays. The entire process lacked transparency and trust.
            </p>
            <p>
              We set out to change this by building a tech-driven platform that connects customers, technicians, and the repair process
              in one seamless ecosystem. Our no random technician visit model ensures safety for both customers and technicians, with
              all work happening at our secure dark stores.
            </p>
            <p>
              Today, we're proud to be serving thousands of customers across Hyderabad, with plans to expand to 30+ locations and
              handle 4500+ tickets per month by 2027.
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl text-gray-800 dark:text-white">Our Mission</CardTitle>
            </CardHeader>
            <CardContent className="text-gray-700 dark:text-gray-300">
              To make electronic repairs transparent, reliable, and convenient for customers while providing technicians with
              dignified, well-paying work in a professional environment.
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl text-gray-800 dark:text-white">Our Vision</CardTitle>
            </CardHeader>
            <CardContent className="text-gray-700 dark:text-gray-300">
              To become India's most trusted electronic repair ecosystem, operating 30+ dark stores and handling 4500+ tickets
              monthly by 2027, powered by AI and technology for maximum efficiency and transparency.
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-lg mb-8">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-gray-800 dark:text-white">What Makes Us Different</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-gray-700 dark:text-gray-300">
              <li className="flex items-start">
                <span className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center mr-3 flex-shrink-0">1</span>
                <span><strong className="font-semibold">AI-Powered Diagnosis:</strong> Our AI system provides accurate initial assessment and pricing</span>
              </li>
              <li className="flex items-start">
                <span className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center mr-3 flex-shrink-0">2</span>
                <span><strong className="font-semibold">No Random Technician Visits:</strong> Pickups and repairs happen through our secure process</span>
              </li>
              <li className="flex items-start">
                <span className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center mr-3 flex-shrink-0">3</span>
                <span><strong className="font-semibold">Real-time Tracking:</strong> Track your repair status in real-time from pickup to delivery</span>
              </li>
              <li className="flex items-start">
                <span className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center mr-3 flex-shrink-0">4</span>
                <span><strong className="font-semibold">Transparent Pricing:</strong> Know the exact cost before any work begins</span>
              </li>
              <li className="flex items-start">
                <span className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center mr-3 flex-shrink-0">5</span>
                <span><strong className="font-semibold">Quality Assurance:</strong> Every repair comes with a 90-day warranty</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        <div className="text-center">
          <Card className="max-w-2xl mx-auto">
            <CardContent className="p-6">
              <p className="text-lg text-gray-700 dark:text-gray-300 mb-4">
                Ready to experience the future of electronic repairs?
              </p>
              <Button asChild>
                <Link href="/book">Book Your Service Now</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}