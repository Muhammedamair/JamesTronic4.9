import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function CustomerDashboard() {
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
                <h1 className="text-2xl font-bold mb-4">Customer Dashboard</h1>
                <p className="text-gray-600 mb-6">Welcome to JamesTronic! You are logged in as a Customer.</p>
                <div className="space-y-4">
                    <Link href="/book">
                        <Button className="w-full">Book a Repair</Button>
                    </Link>
                    <Link href="/">
                        <Button variant="outline" className="w-full">My Tickets</Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}
