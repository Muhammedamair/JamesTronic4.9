import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Star } from 'lucide-react';

export default function ReviewsPage() {
  // Mock reviews data
  const reviews = [
    {
      id: 1,
      name: 'Rajesh Kumar',
      location: 'Hyderabad',
      rating: 5,
      date: '2024-11-15',
      service: 'TV Repair',
      review: 'Excellent service! My LED TV was not turning on, they diagnosed the issue quickly and fixed it within a day. The technician was very professional.',
      response: 'Thank you for your feedback, Rajesh! We appreciate your trust in our services.'
    },
    {
      id: 2,
      name: 'Priya Sharma',
      location: 'Secunderabad',
      rating: 4,
      date: '2024-11-10',
      service: 'Mobile Repair',
      review: 'Quick screen replacement for my iPhone. The pickup and delivery service was very convenient. Will recommend to friends.',
      response: 'We\'re glad we could help, Priya! Thank you for choosing JamesTronic.'
    },
    {
      id: 3,
      name: 'Suresh Reddy',
      location: 'Gachibowli',
      rating: 5,
      date: '2024-11-05',
      service: 'Laptop Repair',
      review: 'My laptop was running very slow. After the optimization service, it works like new! Great value for money.',
      response: 'Thanks for the 5-star rating, Suresh! We love bringing new life to old machines.'
    },
    {
      id: 4,
      name: 'Anjali Nair',
      location: 'Banjara Hills',
      rating: 5,
      date: '2024-10-28',
      service: 'Microwave Repair',
      review: 'Fast and reliable service. My microwave was not heating properly, but the technician fixed it in no time. The pricing was transparent too.',
      response: 'Happy to hear your microwave is working perfectly again, Anjali!'
    },
    {
      id: 5,
      name: 'Vikram Singh',
      location: 'Madhapur',
      rating: 4,
      date: '2024-10-20',
      service: 'TV Repair',
      review: 'Good service overall. Fixed the power issue with my LCD TV. Technician arrived on time and was very knowledgeable.',
      response: 'Thank you, Vikram! We appreciate your feedback and look forward to serving you again.'
    },
    {
      id: 6,
      name: 'Meera Iyer',
      location: 'Jubilee Hills',
      rating: 5,
      date: '2024-10-15',
      service: 'Mobile Repair',
      review: 'Amazing service! Battery replacement for my Android phone. The staff was courteous and the repair was done quickly. Highly recommended!',
      response: 'Thank you, Meera! We\'re delighted to hear you had a great experience.'
    }
  ];

  const averageRating = 4.7;
  const totalReviews = reviews.length;

  // Function to render stars based on rating
  const renderStars = (rating: number) => {
    return Array(5).fill(0).map((_, i) => (
      <Star
        key={i}
        className={`${i < rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'} w-4 h-4`}
      />
    ));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-6xl mx-auto py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-4">Customer Reviews</h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            See what our customers say about our service quality and reliability.
          </p>

          <div className="mt-8 flex flex-col items-center">
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-4xl font-bold text-gray-800 dark:text-white">{averageRating}</span>
              <div className="flex">
                {renderStars(Math.floor(averageRating))}
              </div>
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              Based on {totalReviews} verified reviews
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {reviews.map((review) => (
            <Card key={review.id} className="shadow-lg">
              <CardHeader className="pb-2">
                <div className="flex items-center space-x-4">
                  <div className="bg-gray-200 border-2 border-dashed rounded-xl w-10 h-10 flex items-center justify-center">
                    <span className="text-gray-600 font-medium">
                      {review.name.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                  <div>
                    <CardTitle className="text-lg text-gray-800 dark:text-white">{review.name}</CardTitle>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{review.location}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center mb-2">
                  <div className="flex mr-2">
                    {renderStars(review.rating)}
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {new Date(review.date).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </span>
                  <span className="ml-auto text-sm font-medium text-gray-700 dark:text-gray-300">
                    {review.service}
                  </span>
                </div>

                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  "{review.review}"
                </p>

                {review.response && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 pl-4 py-2">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      <span className="font-semibold">JamesTronic:</span> {review.response}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Card className="max-w-2xl mx-auto">
            <CardContent className="p-6">
              <p className="text-lg text-gray-700 dark:text-gray-300 mb-4">
                Have you experienced our service? Share your feedback to help others.
              </p>
              <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors">
                Rate Your Experience
              </button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}