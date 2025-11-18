# Role-Based Approval System

## Overview

The JamesTronic application implements a role-based user approval system that separates the registration and approval workflow by user roles. This system ensures that technician and transporter registrations are managed through dedicated approval interfaces, improving organization and user experience.

## Architecture

### Database Schema

The system uses the following tables:

- `pending_technicians` - Stores pending registration requests with role information
  - `id`: Unique identifier
  - `user_id`: Associated Supabase user ID
  - `full_name`: User's full name
  - `category_id`: (For technicians) specialization category
  - `requested_role`: Role requested during registration ('technician' or 'transporter')
  - `status`: Registration status ('pending', 'approved', 'rejected')
  - `created_at`: Timestamp of registration
  - `approved_at`: Timestamp when approved (if applicable)

- `profiles` - Stores approved user profiles
  - `user_id`: Associated Supabase user ID
  - `full_name`: User's full name
  - `role`: Approved role ('admin', 'staff', 'technician', 'transporter')

### User Registration Flow

1. User registers through `/login` page
2. User selects role ('technician' or 'transporter')
3. System creates record in `pending_technicians` table with requested role
4. User is directed to `/pending-approval` page
5. Admin sees registration in appropriate role-specific management page

### Approval Separation

The system automatically separates approvals based on the `requested_role` field:

- **Technician Registrations** appear in:
  - `/app/technicians` - Technician management page
  - `/components/admin-technician-page.tsx` - Admin technician page

- **Transporter Registrations** appear in:
  - `/app/transporters` - Transporter management page

## Implementation Details

### Frontend Components

#### Technician Management (`/src/app/app/technicians/page.tsx`)
- Queries `pending_technicians` with filter: `status = 'pending' AND requested_role = 'technician'`
- Contains dedicated approval/rejection functionality
- Shows only technician registrations for approval

#### Transporter Management (`/src/app/app/transporters/page.tsx`)
- Queries `pending_technicians` with filter: `status = 'pending' AND requested_role = 'transporter'`
- Contains dedicated approval/rejection functionality
- Shows only transporter registrations for approval
- Includes role-specific approval UI elements

#### Admin Technician Page (`/src/components/admin-technician-page.tsx`)
- Queries `pending_technicians` with filter: `status = 'pending' AND requested_role = 'technician'`
- Contains dedicated approval/rejection functionality
- Shows only technician registrations for approval

### Approval Process

When an admin approves a pending user:

1. System retrieves user's requested role from `pending_technicians` table
2. System either:
   - Updates existing profile (if one exists) with the requested role
   - Creates new profile with the requested role
3. Updates `pending_technicians` status to 'approved'
4. Updates `pending_technicians` with approval timestamp
5. Invalidates relevant queries to refresh UI

```typescript
// Example approval logic
const approveMutation = useMutation({
  mutationFn: async ({ userId, roleId }: { userId: string, roleId: string }) => {
    // Get pending user details to know their requested role
    const { data: pendingUser, error: fetchError } = await supabase
      .from('pending_technicians')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (fetchError) throw fetchError;

    // Validate the role
    let roleToUse = pendingUser.requested_role;
    if (!['admin', 'staff', 'technician', 'transporter'].includes(roleToUse)) {
      roleToUse = 'staff'; // default fallback
    }

    // Check if profile already exists for this user
    const { data: existingProfile, error: profileCheckError } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (existingProfile) {
      // Profile already exists, just update the role
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ role: roleToUse })
        .eq('user_id', userId);
      if (updateError) throw updateError;
    } else {
      // Create new profile for the user
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: userId,
          full_name: pendingUser.full_name,
          role: roleToUse
        });
      if (profileError) throw profileError;
    }

    // Update pending status to approved
    const { error: updateError } = await supabase
      .from('pending_technicians')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (updateError) throw updateError;
  }
});
```

## Benefits

### Organizational Benefits
- Clear separation of approval workflows by role
- Reduced cognitive load for administrators
- Improved user management efficiency
- Better scalability as user base grows

### User Experience Benefits
- Role-appropriate management interfaces
- Dedicated approval processes for each role type
- Consistent admin experience across role types
- Reduced likelihood of approval errors

### Technical Benefits
- Efficient database queries with role-based filtering
- Proper separation of concerns in code
- Maintainable and extensible architecture
- Clear audit trail for registration approvals

## Security Considerations

- All approval functions use authenticated Supabase client
- Role validation ensures only valid roles are assigned
- Row Level Security (RLS) policies apply to all database operations
- User permissions are properly validated before approval actions

## Future Enhancements

- Email notifications for registration approval/rejection
- Custom registration approval workflows
- Additional role types support
- Bulk approval functionality
- Approval history and audit logs