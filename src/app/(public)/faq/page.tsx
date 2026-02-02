import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function FAQPage() {
  const faqs = [
    {
      id: 1,
      question: 'How long does a typical repair take?',
      answer: 'Most repairs are completed within 24-48 hours. Simple repairs like screen replacement or battery service can often be completed on the same day. Complex repairs involving specific parts may take longer depending on part availability.'
    },
    {
      id: 2,
      question: 'Do you provide pickup and delivery service?',
      answer: 'Yes, we provide free pickup and delivery service in Hyderabad and Secunderabad areas. Our transporter will pick up your device, get it repaired at our facility, and deliver it back to you once completed.'
    },
    {
      id: 3,
      question: 'What is your warranty policy?',
      answer: 'We provide a 90-day warranty on all repairs, covering the same issue for which the device was repaired. For certain complex repairs, we offer extended warranty options. Parts may have separate manufacturer warranties.'
    },
    {
      id: 4,
      question: 'How much do repairs cost?',
      answer: 'Repair costs vary based on the type of device, issue, and required parts. We provide free diagnosis, after which we share a detailed cost breakdown with no hidden charges. You only pay after confirming the repair.'
    },
    {
      id: 5,
      question: 'Do you repair all brands of devices?',
      answer: 'Yes, we repair all major brands of TVs, mobiles, laptops, and home appliances. Our technicians are trained on various brands and we stock genuine parts for the most common devices.'
    },
    {
      id: 6,
      question: 'What areas do you service?',
      answer: 'Currently we service Hyderabad and Secunderabad areas. We are expanding to other parts of Telangana. Check our serviceable areas page to see if we cover your location.'
    },
    {
      id: 7,
      question: 'Can I track my repair status?',
      answer: 'Yes, once your device is booked in, you can track the repair status in real-time through our app or website. We send regular updates about the progress of your repair.'
    },
    {
      id: 8,
      question: 'What if my device cannot be repaired?',
      answer: 'If our technicians determine that your device cannot be repaired cost-effectively, we will inform you with a detailed explanation. You only pay for the diagnosis, and there are no charges for repair if it cannot be completed.'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-4xl mx-auto py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-4">Frequently Asked Questions</h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Find answers to common questions about our services, pricing, and repair process.
          </p>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-gray-800 dark:text-white">Common Questions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {faqs.map((faq) => (
                <details key={faq.id} className="group">
                  <summary className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer list-none text-left text-gray-800 dark:text-gray-200 font-medium">
                    <span>{faq.question}</span>
                    <span className="ml-4 text-xl group-open:rotate-180 transition-transform">+</span>
                  </summary>
                  <div className="p-4 pt-0 text-gray-600 dark:text-gray-400">
                    {faq.answer}
                  </div>
                </details>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="mt-12 text-center">
          <Card className="max-w-2xl mx-auto">
            <CardContent className="p-6">
              <p className="text-lg text-gray-700 dark:text-gray-300 mb-4">
                Didn't find what you're looking for? Contact us for personalized assistance.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors">
                  Contact Support
                </button>
                <button className="border border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-gray-800 font-semibold py-2 px-6 rounded-lg transition-colors">
                  Live Chat
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}