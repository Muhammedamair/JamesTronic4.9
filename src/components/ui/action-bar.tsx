import React from 'react';
import { Phone, MessageSquare, Pencil, Trash2 } from 'lucide-react';
import { Button } from './button';
import { WhatsAppTemplate } from '@/lib/whatsapp-template';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface ActionBarProps {
  ticketId: string;
  customerName: string;
  customerPhone: string;
  status: string;
  className?: string;
  onDelete?: () => void;
}

const ActionBar: React.FC<ActionBarProps> = ({
  ticketId,
  customerName,
  customerPhone,
  status,
  className,
  onDelete
}) => {
  const router = useRouter();
  
  const handleWhatsApp = () => {
    const message = WhatsAppTemplate.fillTemplate(status, {
      name: customerName,
      ticket_id: ticketId.substring(0, 8),
      eta: '2-3 days', // This would come from the ticket data
      part: 'Screen', // This would come from the ticket data
      reason: 'Technical issues' // This would come from the ticket data
    });
    
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${customerPhone}?text=${encodedMessage}`, '_blank');
  };

  const handleCall = () => {
    window.open(`tel:${customerPhone}`, '_self');
  };

  const handleEdit = () => {
    router.push(`/app/tickets/${ticketId}/edit`);
  };

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete ticket #${ticketId.substring(0, 8)}?`) && onDelete) {
      onDelete();
    }
  };

  return (
    <div className={cn("flex space-x-2", className)}>
      <Button 
        variant="outline" 
        size="sm" 
        className="flex items-center justify-center"
        onClick={handleWhatsApp}
      >
        <MessageSquare className="h-4 w-4 mr-1" />
        WhatsApp
      </Button>
      <Button 
        variant="outline" 
        size="sm" 
        className="flex items-center justify-center"
        onClick={handleCall}
      >
        <Phone className="h-4 w-4 mr-1" />
        Call
      </Button>
      <Button 
        variant="outline" 
        size="sm" 
        className="flex items-center justify-center"
        onClick={handleEdit}
      >
        <Pencil className="h-4 w-4 mr-1" />
        Edit
      </Button>
      <Button 
        variant="outline" 
        size="sm" 
        className="flex items-center justify-center text-red-600 hover:text-red-700 border-red-300"
        onClick={handleDelete}
      >
        <Trash2 className="h-4 w-4 mr-1" />
        Delete
      </Button>
    </div>
  );
};

export { ActionBar };