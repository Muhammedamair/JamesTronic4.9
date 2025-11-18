const whatsappTemplates = {
  pending: "Hi {{name}}, your ticket {{ticket_id}} is created and marked *Pending*. We will diagnose and update you soon. — JamesTronic",
  in_progress: "Update for {{name}} ({{ticket_id}}): Work is *In Progress*. Estimated time: {{eta}}. — JamesTronic",
  part_required: "Hi {{name}}, for ticket {{ticket_id}} we need to source a part (*{{part}}*). Estimate: {{eta}}. — JamesTronic",
  ready: "Great news {{name}}! Ticket {{ticket_id}} is *Ready*. Please pick up / confirm delivery. — JamesTronic",
  waiting_customer: "Reminder {{name}}: Ticket {{ticket_id}} is *Waiting for your response*. Reply to proceed. — JamesTronic",
  failed: "Hello {{name}}, ticket {{ticket_id}} repair *failed*. Reason: {{reason}}. We'll discuss next steps. — JamesTronic",
  cancelled: "Hi {{name}}, ticket {{ticket_id}} is *Cancelled*. If this is unexpected, reply here. — JamesTronic"
};

class WhatsAppTemplate {
  static fillTemplate(status: string, data: Record<string, string>): string {
    let template = whatsappTemplates[status as keyof typeof whatsappTemplates];
    
    if (!template) {
      return `Hi ${data.name}, your ticket ${data.ticket_id} status is ${status}. — JamesTronic`;
    }
    
    // Replace placeholders with actual values
    Object.entries(data).forEach(([key, value]) => {
      template = template.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });
    
    return template;
  }
}

export { WhatsAppTemplate };