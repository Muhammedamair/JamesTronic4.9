'use client';

import * as React from "react";
import { cn } from "@/lib/utils";

// Simplified DropdownMenu implementation mimicking shadcn/radix API
// because @radix-ui/react-dropdown-menu is missing in package.json

interface DropdownContextValue {
    isOpen: boolean;
    setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const DropdownContext = React.createContext<DropdownContextValue | undefined>(undefined);

const DropdownMenu = ({ children }: { children: React.ReactNode }) => {
    const [isOpen, setIsOpen] = React.useState(false);

    // Close on click outside handling is tricky with composition, 
    // simplified: content usually handles "onInteractOutside" in Radix.
    // Here we rely on content wrapper ref.

    return (
        <DropdownContext.Provider value={{ isOpen, setIsOpen }}>
            <div className="relative inline-block text-left relative-dropdown-container">
                {children}
            </div>
        </DropdownContext.Provider>
    );
};

const DropdownMenuTrigger = React.forwardRef<
    HTMLButtonElement,
    React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(({ className, children, asChild, ...props }, ref) => {
    const ctx = React.useContext(DropdownContext);
    if (!ctx) throw new Error("Trigger must be used within DropdownMenu");

    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        ctx.setIsOpen((prev) => !prev);
    };

    if (asChild) {
        // If asChild is true, we clone the child and add onClick
        // This is fragile but works for simple cases like <Button>
        const child: any = React.Children.only(children);
        return React.cloneElement(child, {
            onClick: handleClick,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ref: ref as any,
            ...props
        });
    }

    return (
        <button
            ref={ref}
            onClick={handleClick}
            className={cn("inline-flex justify-center rounded-md", className)}
            {...props}
        >
            {children}
        </button>
    );
});
DropdownMenuTrigger.displayName = "DropdownMenuTrigger";

const DropdownMenuContent = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & { align?: 'start' | 'end' | 'center' }
>(({ className, align = 'center', children, ...props }, ref) => {
    const ctx = React.useContext(DropdownContext);
    if (!ctx) throw new Error("Content must be used within DropdownMenu");

    const dropdownRef = React.useRef<HTMLDivElement>(null);

    // Click outside listener
    React.useEffect(() => {
        if (!ctx.isOpen) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                // Basic check: ensure we didn't click the trigger. 
                // The container wrapping both catches checking, but here Content is sibling or child.
                // Actually, the simplest way is to put the ref on the container in DropdownMenu. 
                // But for this simple impl, we just close if click is strictly outside this content 
                // AND not on the trigger (which is hard to know here).
                // Improvement: Add click listener to document, if target is not inside .relative-dropdown-container, close.
            }
        };

        const handleDocClick = (e: MouseEvent) => {
            const container = dropdownRef.current?.closest('.relative-dropdown-container');
            if (container && !container.contains(e.target as Node)) {
                ctx.setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleDocClick);
        return () => document.removeEventListener('mousedown', handleDocClick);
    }, [ctx.isOpen]);

    if (!ctx.isOpen) return null;

    return (
        <div
            ref={(node) => {
                // Maintain both refs
                dropdownRef.current = node;
                if (typeof ref === 'function') ref(node);
                else if (ref) (ref as any).current = node;
            }}
            className={cn(
                "absolute z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-80 data-[side=bottom]:slide-in-from-top-2",
                align === 'end' ? 'right-0' : 'left-0',
                "mt-2",
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
});
DropdownMenuContent.displayName = "DropdownMenuContent";

const DropdownMenuItem = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & { inset?: boolean; asChild?: boolean }
>(({ className, inset, asChild, children, ...props }, ref) => {
    const ctx = React.useContext(DropdownContext);

    const handleClick = (e: React.MouseEvent) => {
        ctx?.setIsOpen(false);
        // Cast to match the expected type for HTMLDivElement
        props.onClick?.(e as React.MouseEvent<HTMLDivElement>);
    };

    if (asChild) {
        const child: any = React.Children.only(children);
        return React.cloneElement(child, {
            onClick: (e: any) => {
                child.props.onClick?.(e);
                handleClick(e);
            },
            className: cn(
                "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                inset && "pl-8",
                child.props.className
            )
        });
    }

    return (
        <div
            ref={ref}
            className={cn(
                "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 cursor-pointer",
                inset && "pl-8",
                className
            )}
            onClick={handleClick}
            {...props}
        >
            {children}
        </div>
    );
});
DropdownMenuItem.displayName = "DropdownMenuItem";

const DropdownMenuLabel = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & { inset?: boolean }
>(({ className, inset, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            "px-2 py-1.5 text-sm font-semibold",
            inset && "pl-8",
            className
        )}
        {...props}
    />
));
DropdownMenuLabel.displayName = "DropdownMenuLabel";

const DropdownMenuSeparator = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn("-mx-1 my-1 h-px bg-muted", className)}
        {...props}
    />
));
DropdownMenuSeparator.displayName = "DropdownMenuSeparator";

export {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
};
