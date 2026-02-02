'use client';

import React from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Shield, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

/*
  DenseDataTable
  - High-density table for Pricing Console
  - Server-side Pagination & Filtering aware
  - Audit Deep Link built-in
*/

export interface ColumnDef<T> {
    header: string;
    accessorKey?: keyof T;
    cell?: (item: T) => React.ReactNode;
    className?: string;
}

interface DenseDataTableProps<T> {
    data: T[];
    columns: ColumnDef<T>[];
    loading?: boolean;
    page?: number;
    totalPages?: number;
    onPageChange?: (page: number) => void;
    actions?: (item: T) => React.ReactNode; // Custom actions
    auditEntityBase?: string; // e.g. "pricing_quotes"
    getAuditId?: (item: T) => string; // Function to extract ID for audit link
}

export function DenseDataTable<T extends { id?: string }>({
    data,
    columns,
    loading = false,
    page = 1,
    totalPages = 1,
    onPageChange,
    actions,
    auditEntityBase = 'audit',
    getAuditId
}: DenseDataTableProps<T>) {

    return (
        <div className="w-full border border-slate-800 rounded-md overflow-hidden bg-slate-900/40">
            <Table>
                <TableHeader className="bg-slate-900/90 backdrop-blur sticky top-0 z-10">
                    <TableRow className="hover:bg-transparent border-slate-800">
                        {columns.map((col, idx) => (
                            <TableHead key={idx} className={cn("text-slate-400 font-medium h-10 text-xs uppercase tracking-wider", col.className)}>
                                {col.header}
                            </TableHead>
                        ))}
                        <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        <TableRow>
                            <TableCell colSpan={columns.length + 1} className="h-32 text-center text-slate-500">
                                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                Loading data...
                            </TableCell>
                        </TableRow>
                    ) : data.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={columns.length + 1} className="h-32 text-center text-slate-500">
                                No records found.
                            </TableCell>
                        </TableRow>
                    ) : (
                        data.map((item, rowIdx) => (
                            <TableRow key={(item.id || rowIdx)} className="hover:bg-slate-800/50 border-slate-800 transition-colors group">
                                {columns.map((col, colIdx) => (
                                    <TableCell key={colIdx} className={cn("py-2.5 px-4 text-sm text-slate-200", col.className)}>
                                        {col.cell ? col.cell(item) : (item as any)[col.accessorKey as string]}
                                    </TableCell>
                                ))}

                                {/* Actions Column */}
                                <TableCell className="py-2.5 text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" className="h-8 w-8 p-0 text-slate-500 hover:text-slate-200">
                                                <span className="sr-only">Open menu</span>
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700 text-slate-200">
                                            <DropdownMenuLabel className="text-xs text-slate-500 uppercase">Actions</DropdownMenuLabel>

                                            {actions && actions(item)}

                                            {/* Safety Refinement: Audit Deep Link */}
                                            <DropdownMenuItem asChild>
                                                <Link
                                                    href={`/app/manager/pricing/audit?entity=${auditEntityBase}&entity_id=${getAuditId ? getAuditId(item) : (item as any).id}`}
                                                    className="text-violet-400 focus:text-violet-300 focus:bg-violet-900/20 cursor-pointer"
                                                >
                                                    <Shield className="w-3.5 h-3.5 mr-2" />
                                                    View Audit Trail
                                                </Link>
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>

            {/* Pagination Footer */}
            {(totalPages > 1 || loading) && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800 bg-slate-900/50 text-xs text-slate-400">
                    <div>
                        Page {page} of {totalPages}
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page <= 1 || loading}
                            onClick={() => onPageChange?.(page - 1)}
                            className="h-7 text-xs border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300"
                        >
                            Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page >= totalPages || loading}
                            onClick={() => onPageChange?.(page + 1)}
                            className="h-7 text-xs border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300"
                        >
                            Next
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
