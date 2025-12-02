'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSupabase } from '@/components/shared/supabase-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [userRole, setUserRole] = useState<'staff' | 'technician' | 'transporter'>('staff');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [categories, setCategories] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const router = useRouter();
  const { supabase } = useSupabase();

  // Fetch categories when component mounts and sign-up mode is active
  useEffect(() => {
    const fetchCategories = async () => {
      if (isSignUpMode) {
        const { data, error } = await supabase
          .from('categories')
          .select('id, name')
          .order('name');

        if (error) {
          console.error('Error fetching categories:', error);
        } else {
          setCategories(data || []);
        }
      }
    };

    fetchCategories();
  }, [isSignUpMode, supabase]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Redirect to dashboard which handles role-based routing
      router.push('/dashboard');
    } catch (error) {
      alert('Error logging in: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!fullName) {
      alert('Please enter your full name');
      return;
    }

    setLoading(true);

    try {
      // Prepare user metadata based on selected role
      const userData: any = {
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            full_name: fullName,
            role: userRole
          }
        }
      };

      // Add category_id if user selected technician role and a category
      if (userRole === 'technician' && selectedCategory) {
        userData.options.data.category_id = selectedCategory;
      }

      const { error } = await supabase.auth.signUp(userData);

      if (error) throw error;

      if (userRole === 'technician' || userRole === 'transporter') {
        alert('Your registration has been submitted for admin approval. You will be notified once approved.');
      } else {
        alert('Check your email for a confirmation link!');
      }
    } catch (error) {
      alert('Error signing up: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center">
            {isSignUpMode ? 'JamesTronic Sign Up' : 'JamesTronic Admin Login'}
          </CardTitle>
          <CardDescription className="text-center">
            {isSignUpMode
              ? 'Create your account to join JamesTronic'
              : 'Enter your credentials to access the admin panel'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isSignUpMode ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="full-name">Full Name</Label>
                <Input
                  id="full-name"
                  type="text"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={userRole} onValueChange={(value: any) => setUserRole(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="technician">Technician</SelectItem>
                    <SelectItem value="transporter">Transporter</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {userRole === 'technician' && (
                <div className="space-y-2">
                  <Label htmlFor="category">Specialization Category</Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-gray-500">
                    Select the category you specialize in. Admin approval required.
                  </p>
                </div>
              )}

              <Button className="w-full" onClick={handleSignUp} disabled={loading}>
                {loading ? 'Creating account...' : 'Sign Up'}
              </Button>

              <div className="mt-4 text-center text-sm text-gray-600">
                Already have an account?{' '}
                <Button
                  variant="link"
                  className="p-0 h-auto font-normal"
                  onClick={() => setIsSignUpMode(false)}
                  disabled={loading}
                >
                  Sign in
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button className="w-full" type="submit" disabled={loading}>
                  {loading ? 'Signing in...' : 'Sign In'}
                </Button>
              </form>
              <div className="mt-4 text-center text-sm text-gray-600">
                Don't have an account?{' '}
                <Button
                  variant="link"
                  className="p-0 h-auto font-normal"
                  onClick={() => setIsSignUpMode(true)}
                  disabled={loading}
                >
                  Sign up
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}