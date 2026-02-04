import { z } from 'zod';

// ============================================================================
// ENUMS
// ============================================================================

export const SkillCategorySchema = z.enum([
    'appliance_repair', 'soft_skills', 'safety', 'sales', 'advanced_diagnostics'
]);
export const AchievementTierSchema = z.enum(['bronze', 'silver', 'gold', 'platinum', 'diamond']);

// ============================================================================
// SCHEMAS
// ============================================================================

// Skill Item (definition merged with user progress)
export const skillItemSchema = z.object({
    skill_id: z.string().uuid(),
    name: z.string(),
    category: SkillCategorySchema,
    max_level: z.number(),
    icon: z.string().nullable(),
    user_level: z.number(),
    user_xp: z.number(),
    is_certified: z.boolean()
});
export type SkillItem = z.infer<typeof skillItemSchema>;

// Achievement Item (unlocked)
export const achievementItemSchema = z.object({
    achievement_id: z.string().uuid(),
    name: z.string(),
    tier: AchievementTierSchema,
    icon: z.string().nullable(),
    unlocked_at: z.string()
});
export type AchievementItem = z.infer<typeof achievementItemSchema>;

// Full Skill Tree / Profile
export const technicianSkillProfileSchema = z.object({
    user_id: z.string().uuid(),
    global_level: z.number(),
    total_xp: z.number(),
    skills: z.array(skillItemSchema),
    achievements: z.array(achievementItemSchema)
});
export type TechnicianSkillProfile = z.infer<typeof technicianSkillProfileSchema>;

// Event Output
export const xpAwardResultSchema = z.object({
    new_total_xp: z.number(),
    old_level: z.number(),
    new_level: z.number(),
    leveled_up: z.boolean()
});
export type XPAwardResult = z.infer<typeof xpAwardResultSchema>;
