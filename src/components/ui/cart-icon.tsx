'use client';

import React from 'react';
import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CartIconProps {
    itemCount?: number;
    href?: string;
    onClick?: () => void;
    className?: string;
}

export const CartIcon: React.FC<CartIconProps> = ({
    itemCount = 0,
    href = '/book',
    onClick,
    className
}) => {
    const content = (
        <div className={cn(
            "relative p-2 rounded-full hover:bg-gray-100 transition-colors cursor-pointer",
            className
        )}>
            <ShoppingCart className="w-5 h-5 text-gray-600" />
            {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-indigo-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {itemCount > 9 ? '9+' : itemCount}
                </span>
            )}
        </div>
    );

    if (onClick) {
        return (
            <button onClick={onClick} className="focus:outline-none">
                {content}
            </button>
        );
    }

    return (
        <Link href={href}>
            {content}
        </Link>
    );
};

export default CartIcon;
