import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function StoresPage() {
  const darkStores = [
    {
      id: 1,
      name: 'Hitech City Hub',
      address: 'Plot 123, Hitech City, Hyderabad - 500081',
      hours: 'Mon-Sun: 9:00 AM - 8:00 PM',
      services: ['TV Repair', 'Mobile Repair', 'Laptop Repair'],
      contact: '+91 98765 43210',
      isOperational: true
    },
    {
      id: 2,
      name: 'Gachibowli Center',
      address: '101, Serilingampally Mandal, Gachibowli, Hyderabad - 500032',
      hours: 'Mon-Sun: 9:00 AM - 8:00 PM',
      services: ['TV Repair', 'Mobile Repair', 'Appliance Repair'],
      contact: '+91 98765 43211',
      isOperational: true
    },
    {
      id: 3,
      name: 'Jubilee Hills Station',
      address: 'Beside Jubilee Hills Check Post, Jubilee Hills, Hyderabad - 500033',
      hours: 'Mon-Sun: 9:00 AM - 8:00 PM',
      services: ['Mobile Repair', 'Laptop Repair', 'Appliance Repair'],
      contact: '+91 98765 43212',
      isOperational: true
    },
    {
      id: 4,
      name: 'Secunderabad Junction',
      address: 'Stn Rd, beside Secunderabad Station, Secunderabad, Hyderabad - 500003',
      hours: 'Mon-Sun: 9:00 AM - 8:00 PM',
      services: ['TV Repair', 'Mobile Repair', 'Laptop Repair', 'Appliance Repair'],
      contact: '+91 98765 43213',
      isOperational: true
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-6xl mx-auto py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-4">Our Dark Stores</h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Visit our secure repair centers where your devices are safely handled by skilled technicians.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8">
          {darkStores.map((store) => (
            <Card key={store.id} className={`shadow-lg ${!store.isOperational ? 'opacity-70' : ''}`}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-xl text-gray-800 dark:text-white">
                    {store.name}
                    {!store.isOperational && <span className="text-xs bg-red-100 text-red-800 ml-2 px-2 py-1 rounded">Temporarily Closed</span>}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-1">Address</h3>
                    <p className="text-gray-700 dark:text-gray-300">{store.address}</p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-1">Working Hours</h3>
                    <p className="text-gray-700 dark:text-gray-300">{store.hours}</p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-1">Services Offered</h3>
                    <ul className="list-disc pl-5 space-y-1 text-gray-700 dark:text-gray-300">
                      {store.services.map((service, idx) => (
                        <li key={idx}>{service}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-1">Contact</h3>
                    <p className="text-gray-700 dark:text-gray-300">{store.contact}</p>
                  </div>

                  <div className="pt-2">
                    <Button asChild className="w-full">
                      <Link href={`/book?store=${store.id}`}>Book Service at this Store</Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Card className="max-w-2xl mx-auto">
            <CardContent className="p-6">
              <p className="text-lg text-gray-700 dark:text-gray-300 mb-4">
                Don't see a store near you? We're expanding rapidly across Hyderabad and Telangana.
              </p>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Book online and our transporter will pick up your device from your location.
              </p>
              <Button asChild>
                <Link href="/book">Book Service Now</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}