// Flavourly OS — Fast seed for remote Postgres (Supabase)
// Uses createMany for bulk inserts. Run: bunx bun prisma/seed-fast.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const INDUSTRY_CURRENCY: Record<string, string> = {
  restaurant: "Points", cafe: "Stamps", carwash: "Washes",
  salon: "Visits", barber: "Cuts", retail: "Points",
};

function daysAgo(n: number, hours = 0) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(d.getHours() - hours, 0, 0, 0);
  return d;
}

function pickName(i: number) {
  const first = ["Thabo","Sipho","Lerato","Nomsa","Mandla","Zanele","Sizwe","Precious","Bongani","Nokuthula","Tshepo","Ayanda","Mpho","Refilwe","Kabelo","Lebo","Tshegofatso","Katlego","Boitumelo","Mosa","Sello","Palesa","Dineo","Tumelo","Karabo","Ofentse","Mmabatho","Thabang","Naledi","Bafana","Cynthia","Jabu","Fikile","Phumla","Vusi","Zwelithini","Andile","Nokwanda","Mosa","Thandi"];
  const last = ["Molefe","Nkosi","Dlamini","Khosa","Mahlangu","Zulu","Mokoena","Sithole","Ndlovu","Mthembu","Khumalo","Mthethwa","Mabuza","Maseko","Nxumalo","Radebe","Mngomezulu","Vilakazi","Mhlongo","Buthelezi","Zuma","Mthombeni","Hlongwane","Ngubane","Madonsela","Shabangu","Mavuso","Ntuli","Mdluli","Gumede"];
  return `${first[i % first.length]} ${last[(i * 7) % last.length]}`;
}

async function main() {
  console.log("🌱 Fast seeding to Supabase Postgres...");

  // ── 1. Mike's Car Wash ───────────────────────────────────────────────────
  const mikes = await db.tenant.upsert({
    where: { slug: "mikes-car-wash" },
    update: {},
    create: {
      name: "Mike's Car Wash", slug: "mikes-car-wash", industry: "carwash",
      currencyName: "Washes", brandColor: "#FF6B00", welcomePoints: 2, rewardThreshold: 5,
      subscriptionStatus: "trial", plan: "starter", trialEndsAt: daysAgo(-6),
      locationLat: -26.2041, locationLng: 28.0473, locationLabel: "Boksburg, Gauteng",
      whatsappInstanceId: "tenant_mikes-car-wash", whatsappInstanceToken: "MIKES-DEMO-TOKEN-2026",
      whatsappPhone: "27835550001", whatsappConnectedAt: daysAgo(12),
      ownerName: 'Michael "Mike" Nkosi', ownerEmail: "mike@mikescarwash.co.za",
    },
  });

  // ── 2. Customers (batch create) ──────────────────────────────────────────
  const existingCustomers = await db.customer.count({ where: { tenantId: mikes.id } });
  if (existingCustomers === 0) {
    const customerData = Array.from({ length: 40 }).map((_, i) => {
      const lastVisitDays = i < 16 ? (i % 25) + 1 : i < 28 ? 30 + (i % 28) : 65 + (i % 40);
      return {
        tenantId: mikes.id,
        phoneNumber: `2783${(100000 + i * 137).toString().padStart(6, "0")}`,
        name: pickName(i),
        points: i < 4 ? 15 + i * 3 : i % 7 === 0 ? 0 : (i % 5) + 2,
        visits: i < 4 ? 8 + i * 2 : (i % 6) + 1,
        lastVisit: daysAgo(lastVisitDays),
        optedIn: i % 11 !== 0,
        joinedAt: daysAgo(lastVisitDays + 5 + (i % 10)),
      };
    });
    await db.customer.createMany({ data: customerData });
    console.log("  ✅ 40 customers created");
  } else {
    console.log(`  ⏭️  ${existingCustomers} customers already exist, skipping`);
  }

  const customers = await db.customer.findMany({ where: { tenantId: mikes.id }, select: { id: true, joinedAt: true, visits: true } });

  // ── 3. Loyalty transactions (batch) ──────────────────────────────────────
  const existingTxns = await db.loyaltyTransaction.count({ where: { tenantId: mikes.id } });
  if (existingTxns === 0) {
    const txnData: Array<{ tenantId: string; customerId: string; pointsChange: number; reason: string; createdAt: Date }> = [];
    for (const c of customers) {
      txnData.push({ tenantId: mikes.id, customerId: c.id, pointsChange: 2, reason: "join_bonus", createdAt: c.joinedAt });
      const visitCount = Math.min(c.visits, 4);
      for (let v = 0; v < visitCount; v++) {
        txnData.push({ tenantId: mikes.id, customerId: c.id, pointsChange: 1, reason: "visit", createdAt: daysAgo(20 - v * 4) });
      }
    }
    await db.loyaltyTransaction.createMany({ data: txnData });
    console.log(`  ✅ ${txnData.length} loyalty transactions created`);
  }

  // ── 4. Campaigns (batch) ─────────────────────────────────────────────────
  const existingCampaigns = await db.campaign.count({ where: { tenantId: mikes.id } });
  if (existingCampaigns === 0) {
    await db.campaign.createMany({
      data: [
        { tenantId: mikes.id, title: "Rainy Day Rinse Special", goal: "quiet_hours", message: "🌧️ Rainy day special at Mike's Car Wash! Come in for double Washes today. Valid until 5pm only!", audience: "all", status: "sent", sentCount: 38, redemptionCount: 14, sentAt: daysAgo(9) },
        { tenantId: mikes.id, title: "Tuesday Flash Wash", goal: "quiet_hours", message: "⚡ Flash Tuesday! Your next Wash is FREE at Mike's Car Wash. Today only!", audience: "inactive", status: "sent", sentCount: 16, redemptionCount: 7, sentAt: daysAgo(4) },
        { tenantId: mikes.id, title: "VIP Valet Upgrade", goal: "vip", message: "👑 Hey {{customer_name}}! As a VIP, enjoy a free interior vacuum with your next Wash this week.", audience: "vip", status: "sent", sentCount: 6, redemptionCount: 4, sentAt: daysAgo(14) },
        { tenantId: mikes.id, title: "Weekend Wash Special", goal: "quiet_hours", message: "💦 Weekend special! 10% off all washes Sat & Sun at Mike's Car Wash.", audience: "all", status: "sent", sentCount: 36, redemptionCount: 2, sentAt: daysAgo(20) },
        { tenantId: mikes.id, title: "We Miss You — Free Wash", goal: "winback", message: "👋 Hi {{customer_name}}, we haven't seen you at Mike's Car Wash in a while. Come back this week for a FREE Wash on us!", audience: "inactive", status: "sent", sentCount: 14, redemptionCount: 5, sentAt: daysAgo(27) },
      ],
    });
    console.log("  ✅ 5 campaigns created");
  }

  // ── 5. Reward events (batch) ─────────────────────────────────────────────
  const existingRewards = await db.rewardEvent.count({ where: { tenantId: mikes.id } });
  if (existingRewards === 0) {
    const redeemers = customers.slice(0, 8);
    await db.rewardEvent.createMany({
      data: redeemers.map((c, i) => ({
        tenantId: mikes.id, customerId: c.id, triggerType: "manual",
        status: i % 3 !== 2 ? "claimed" : "expired",
        pointsCost: mikes.rewardThreshold, expiresAt: daysAgo(3 - i),
        claimedAt: i % 3 !== 2 ? daysAgo(3 - i) : null, createdAt: daysAgo(3 - i, 1),
      })),
    });
    console.log("  ✅ 8 reward events created");
  }

  // ── 6. Activity feed ─────────────────────────────────────────────────────
  const existingActivity = await db.activity.count({ where: { tenantId: mikes.id } });
  if (existingActivity === 0) {
    const feedItems = [
      { type: "joined", customerName: customers[0].name, message: "just joined and earned 2 Washes", mins: 4 },
      { type: "redeemed", customerName: customers[1].name, message: "redeemed a free Wash", mins: 18 },
      { type: "earned", customerName: customers[2].name, message: "earned 1 Wash on a visit", mins: 47 },
      { type: "joined", customerName: customers[3].name, message: "just joined and earned 2 Washes", mins: 73 },
      { type: "visit", customerName: customers[5].name, message: "came in for their 4th wash this month", mins: 120 },
      { type: "earned", customerName: customers[7].name, message: "earned 1 Wash — 2 away from a free one", mins: 165 },
      { type: "joined", customerName: customers[10].name, message: "just joined and earned 2 Washes", mins: 220 },
      { type: "redeemed", customerName: customers[12].name, message: "redeemed a free Wash", mins: 310 },
    ];
    await db.activity.createMany({
      data: feedItems.map((f) => {
        const t = new Date();
        t.setMinutes(t.getMinutes() - f.mins);
        return { tenantId: mikes.id, type: f.type, customerName: f.customerName, message: f.message, createdAt: t };
      }),
    });
    console.log("  ✅ 8 activity items created");
  }

  // ── 7. Webhook events ────────────────────────────────────────────────────
  const existingWebhooks = await db.webhookEvent.count({ where: { tenantId: mikes.id } });
  if (existingWebhooks === 0) {
    const webhookSamples = [
      { event: "messages.upsert", phone: customers[0].phoneNumber, content: "JOIN", status: "processed" },
      { event: "messages.upsert", phone: customers[1].phoneNumber, content: "REDEEM", status: "processed" },
      { event: "messages.upsert", phone: customers[2].phoneNumber, content: "BALANCE", status: "processed" },
      { event: "messages.upsert", phone: customers[5].phoneNumber, content: "hi", status: "processed" },
      { event: "connection.update", phone: null, content: "open", status: "processed" },
      { event: "messages.upsert", phone: "27839999999", content: "JOIN", status: "error" },
    ];
    await db.webhookEvent.createMany({
      data: webhookSamples.map((w, i) => {
        const t = new Date();
        t.setMinutes(t.getMinutes() - (i * 25 + 3));
        return {
          tenantId: mikes.id, instanceName: "tenant_mikes-car-wash",
          eventType: w.event, phoneNumber: w.phone, messageContent: w.content,
          status: w.status, rawPayload: JSON.stringify({ event: w.event, data: { message: { conversation: w.content } } }),
          createdAt: t,
        };
      }),
    });
    console.log("  ✅ 6 webhook events created");
  }

  // ── 8. Prospects + ghost tenants ─────────────────────────────────────────
  const existingProspects = await db.prospect.count();
  if (existingProspects === 0) {
    const prospectData = [
      { business: "Bra Sipho's Chisa Nyama", owner: "Sipho Maseko", phone: "27825550011", loc: "Soweto, Gauteng", industry: "restaurant", status: "new" },
      { business: "Tshepo's Fade Barbershop", owner: "Tshepo Dlamini", phone: "27825550022", loc: "Tembisa, Gauteng", industry: "barber", status: "invited" },
      { business: "Lebo's Beauty Lounge", owner: "Lebo Khumalo", phone: "27825550033", loc: "Centurion, Gauteng", industry: "salon", status: "new" },
      { business: "Mama Nomsa's Kitchen", owner: "Nomsa Sithole", phone: "27825550044", loc: "Daveyton, Gauteng", industry: "restaurant", status: "claimed" },
      { business: "Quick Shine Car Wash", owner: "Bongani Ndlovu", phone: "27825550055", loc: "Alexandra, Gauteng", industry: "carwash", status: "new" },
      { business: "Daily Brew Cafe", owner: "Ayanda Mthembu", phone: "27825550066", loc: "Melville, Johannesburg", industry: "cafe", status: "invited" },
      { business: "Sharp Cuts Barber", owner: "Kabelo Mokoena", phone: "27825550077", loc: "Atteridgeville, Pretoria", industry: "barber", status: "new" },
      { business: "Spice Route Eatery", owner: "Priya Naidoo", phone: "27825550088", loc: "Lenasia, Gauteng", industry: "restaurant", status: "new" },
      { business: "Glow Up Nail Studio", owner: "Refilwe Mahlangu", phone: "27825550099", loc: "Sandton, Gauteng", industry: "salon", status: "new" },
      { business: "Corner Store Bodega", owner: "Mandla Zulu", phone: "27825550100", loc: "Hillbrow, Johannesburg", industry: "retail", status: "new" },
    ];

    for (const p of prospectData) {
      const baseSlug = p.business.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      const tenantSlug = p.status === "claimed" ? baseSlug : `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
      const tenant = await db.tenant.create({
        data: {
          name: p.business, slug: tenantSlug, industry: p.industry,
          currencyName: INDUSTRY_CURRENCY[p.industry],
          subscriptionStatus: p.status === "claimed" ? "trial" : "unclaimed",
          plan: "starter",
          ...(p.status === "claimed" ? {
            trialEndsAt: daysAgo(-9), ownerName: p.owner, claimedAt: daysAgo(5),
            whatsappInstanceId: `tenant_${baseSlug}`,
            whatsappInstanceToken: `${p.business.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}-TOKEN`,
          } : {}),
        },
      });
      await db.prospect.create({
        data: {
          businessName: p.business, ownerName: p.owner, phoneNumber: p.phone,
          location: p.loc, industry: p.industry, status: p.status, tenantId: tenant.id,
          inviteSentAt: p.status === "invited" ? daysAgo(2) : undefined,
        },
      });
    }
    console.log("  ✅ 10 prospects + ghost tenants created");
  }

  // ── 9. Auth users ────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("demo1234", 10);
  const existingMike = await db.user.findUnique({ where: { email: "mike@mikescarwash.co.za" } });
  if (!existingMike) {
    await db.user.create({
      data: {
        email: "mike@mikescarwash.co.za", name: 'Michael "Mike" Nkosi', passwordHash,
        profiles: { create: { fullName: 'Michael "Mike" Nkosi', role: "owner", tenantId: mikes.id } },
      },
    });
    console.log("  ✅ Mike (owner) user created");
  }

  const existingAdmin = await db.user.findUnique({ where: { email: "admin@flavourly.os" } });
  if (!existingAdmin) {
    await db.user.create({
      data: {
        email: "admin@flavourly.os", name: "Flavourly Founder", passwordHash,
        profiles: { create: { fullName: "Flavourly Founder", role: "super_admin", tenantId: null } },
      },
    });
    console.log("  ✅ Super Admin user created");
  }

  // ── 10. Broadcast log + payment ──────────────────────────────────────────
  const existingBroadcast = await db.broadcastLog.count();
  if (existingBroadcast === 0) {
    const mamaNomsa = await db.tenant.findUnique({ where: { slug: "mama-nomsas-kitchen" } });
    if (mamaNomsa) {
      await db.broadcastLog.create({
        data: {
          targetIndustry: "carwash", messagePreview: "📢 Flavourly update: New geo-claim rewards are live!",
          recipientCount: 1, sentCount: 1, sentBy: "super_admin", createdAt: daysAgo(3),
          recipients: { create: [{ tenantId: mikes.id, delivered: true }] },
        },
      });
      await db.paymentTransaction.create({
        data: {
          tenantId: mamaNomsa.id, plan: "growth", amount: 499.0,
          mPaymentId: "pf-demo-0001", pfPaymentId: "10470001", payfastToken: "tok-demo-mamanomsa",
          status: "complete", createdAt: daysAgo(25),
        },
      });
      console.log("  ✅ Broadcast log + payment transaction created");
    }
  }

  console.log("\n✅ Fast seed complete!");
  console.log("   Demo credentials:");
  console.log("   mike@mikescarwash.co.za / demo1234 (tenant owner)");
  console.log("   admin@flavourly.os / demo1234 (super admin)");
}

main()
  .catch((e) => { console.error("❌ Seed error:", e); process.exit(1); })
  .finally(() => db.$disconnect());
