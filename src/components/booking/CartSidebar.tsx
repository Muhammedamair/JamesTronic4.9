'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Check, ShieldCheck, Clock, Tag } from 'lucide-react';
import { PromiseBadge } from '@/components/home/PromiseSection';

interface CartItem {
    id: string;
    name: string;
    price?: number;
    details?: string;
}

interface CartSidebarProps {
    items: CartItem[];
    total?: number;
    onCheckout: () => void;
    isLoading?: boolean;
    className?: string;
}

export const CartSidebar: React.FC<CartSidebarProps> = ({
    items,
    total,
    onCheckout,
    isLoading,
    className
}) => {
    const hasItems = items.length > 0;

    return (
        <div className={cn("hidden lg:block w-[380px] flex-shrink-0", className)}>
            <div className="sticky top-24 space-y-4">
                {/* Cart Card */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="p-6">
                        <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                            <span>Summary</span>
                            <span className="text-sm font-normal text-gray-500">
                                ({items.length} item{items.length !== 1 ? 's' : ''})
                            </span>
                        </h2>

                        {hasItems ? (
                            <div className="space-y-6">
                                {/* Items List */}
                                <div className="space-y-4">
                                    {items.map((item) => (
                                        <div key={item.id} className="flex justify-between items-start gap-3 pb-4 border-b border-gray-100 last:border-0 last:pb-0">
                                            <div>
                                                <div className="font-semibold text-gray-900">{item.name}</div>
                                                {item.details && (
                                                    <div className="text-sm text-gray-500 mt-1">{item.details}</div>
                                                )}
                                            </div>
                                            <div className="text-right">
                                                <div className="font-semibold text-gray-900">
                                                    {item.price ? `₹${item.price}` : <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded">Quote on Visit</span>}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Bill Details */}
                                <div className="pt-4 border-t border-gray-100 space-y-2">
                                    <div className="flex justify-between text-sm text-gray-600">
                                        <span>Service Charge</span>
                                        <span>{items.some(i => !i.price) ? 'Detailed after check' : `₹${199}`}</span>
                                    </div>
                                    <div className="flex justify-between text-sm text-green-600">
                                        <span>Discount</span>
                                        <span>- ₹0</span>
                                    </div>
                                </div>

                                {/* Total */}
                                <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
                                    <span className="font-bold text-gray-900">Total</span>
                                    <span className="font-bold text-xl text-gray-900">
                                        {total ? `₹${total}` : 'To be quoted'}
                                    </span>
                                </div>

                                {/* Checkout Button */}
                                <Button
                                    onClick={onCheckout}
                                    disabled={isLoading}
                                    className="w-full h-12 text-base font-semibold bg-indigo-600 hover:bg-indigo-700 rounded-xl"
                                >
                                    {isLoading ? 'Processing...' : 'Proceed to Checkout'}
                                </Button>

                                {/* Safety Info */}
                                <div className="bg-green-50 rounded-lg p-3 flex items-start gap-2 text-xs text-green-800">
                                    <ShieldCheck className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                    <p>
                                        Safe & Secure payments. 100% money back guarantee if service is not delivered.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Tag className="w-8 h-8 text-gray-400" />
                                </div>
                                <p className="text-gray-500">Your cart is empty</p>
                                <p className="text-sm text-gray-400 mt-1">Select a service to proceed</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Promise Badge */}
                <PromiseBadge />

                {/* Support */}
                <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <div className="font-medium text-gray-900">Need Help?</div>
                            <div className="text-xs text-gray-500">24/7 Support</div>
                        </div>
                    </div>
                    <Button variant="ghost" className="text-blue-600 hover:text-blue-700">
                        Contact
                    </Button>
                </div>
            </div>
        </div>
    );
};
