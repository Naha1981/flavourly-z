import { z } from "zod";

// Tenant
export const tenantPatchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  industry: z
    .enum(["restaurant", "cafe", "carwash", "salon", "barber", "retail"])
    .optional(),
  currencyName: z.string().min(1).max(30).optional(),
  brandColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  logoUrl: z.string().url().optional(),
  welcomePoints: z.number().int().min(0).max(1000).optional(),
  rewardThreshold: z.number().int().min(1).max(1000).optional(),
  locationLabel: z.string().max(200).optional(),
  locationLat: z.number().min(-90).max(90).optional(),
  locationLng: z.number().min(-180).max(180).optional(),
  ownerName: z.string().max(100).optional(),
  ownerEmail: z.string().email().optional(),
  onboardingCompleted: z.boolean().optional(),
});

// Customers
export const customerCreateSchema = z.object({
  phoneNumber: z.string().min(5).max(20),
  name: z.string().max(100).optional(),
});
export const customerAdjustSchema = z.object({
  pointsChange: z
    .number()
    .int()
    .refine((n) => n !== 0, "Must be non-zero"),
  reason: z.string().max(50).optional(),
  note: z.string().max(200).optional(),
});
export const customersQuerySchema = z.object({
  filter: z
    .enum(["all", "active", "at_risk", "inactive", "vip", "new"])
    .optional(),
  q: z.string().max(100).optional(),
  sort: z.enum(["recent", "name", "points", "visits"]).optional(),
});

// Campaigns
export const campaignCreateSchema = z.object({
  title: z.string().min(1).max(120),
  goal: z.enum(["quiet_hours", "winback", "vip", "general"]).optional(),
  message: z.string().min(1).max(2000),
  audience: z.enum(["all", "inactive", "vip", "new"]),
});

// WhatsApp
export const whatsappConnectSchema = z.object({
  forceRefresh: z.boolean().optional(),
});

// Webhooks
export const webhookSimulateSchema = z.object({
  keyword: z.string().min(1).max(50),
  phone: z.string().max(20).optional(),
});

// Prospects
export const prospectIngestSchema = z.object({
  industry: z.enum([
    "restaurant",
    "cafe",
    "carwash",
    "salon",
    "barber",
    "retail",
  ]),
  rows: z
    .array(
      z.object({
        businessName: z.string().min(1).max(200),
        ownerName: z.string().max(200).optional(),
        phoneNumber: z.string().min(5).max(20),
        location: z.string().max(200).optional(),
      })
    )
    .min(1)
    .max(1000),
});
export const prospectInviteSchema = z.object({
  prospectIds: z.array(z.string()).min(1).max(100),
});

// Broadcasts
export const broadcastCreateSchema = z.object({
  industryFilter: z.enum([
    "all",
    "restaurant",
    "cafe",
    "carwash",
    "salon",
    "barber",
    "retail",
  ]),
  messageTemplate: z.string().min(1).max(2000),
});

// Geo-claim
export const geoClaimVerifySchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

// Billing
export const billingCheckoutSchema = z.object({
  plan: z.enum(["starter", "growth"]),
});
export const billingItnSchema = z.object({
  m_payment_id: z.string().min(1),
  pf_payment_id: z.string().optional(),
  token: z.string().optional(),
});
