// Flavourly OS — Seed script
// Run: bun run db:seed
// Populates a demo "Mike's Car Wash" tenant + 40 customers, past campaigns,
// activity feed, reward events, prospects, webhook events, and a second
// ghost (unclaimed) tenant to demonstrate the claim flow.

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const INDUSTRY_CURRENCY: Record<string, string> = {
  restaurant: "Points",
  cafe: "Stamps",
  carwash: "Washes",
  salon: "Visits",
  barber: "Cuts",
  retail: "Points",
};

function daysAgo(n: number, hours = 0) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(d.getHours() - hours, 0, 0, 0);
  return d;
}

function pickName(i: number) {
  const first = ["Thabo","Sipho","Lerato","Nomsa","Mandla","Zanele","Sizwe","Precious","Bongani","Nokuthula","Tshepo","Ayanda","Mpho","Refilwe","Kabelo","Lebo","Tshegofatso","Katlego","Boitumelo","Mosa","Sello","Palesa","Mpho","Dineo","Tumelo","Karabo","Ofentse","Mmabatho","Thabang","Naledi","Bafana","Cynthia","Jabu","Fikile","Mandla","Phumla","Vusi","Zwelithini","Andile","Nokwanda"];
  const last = ["Molefe","Nkosi","Dlamini","Khosa","Mahlangu","Zulu","Mokoena","Sithole","Ndlovu","Mthembu","Khumalo","Mthethwa","Mabuza","Maseko","Nxumalo","Radebe","Mngomezulu","Vilakazi","Mhlongo","Buthelezi","Zuma","Mthombeni","Hlongwane","Ngubane","Madonsela","Shabangu","Mavuso","Ntuli","Mdluli","Gumede"];
  return `${first[i % first.length]} ${last[(i * 7) % last.length]}`;
}

async function main() {
  console.log("🌱 Seeding Flavourly OS demo data...");

  // ── 1. Main demo tenant: Mike's Car Wash (active, WhatsApp connected) ─────
  const mikes = await db.tenant.upsert({
    where: { slug: "mikes-car-wash" },
    update: {},
    create: {
      name: "Mike's Car Wash",
      slug: "mikes-car-wash",
      industry: "carwash",
      currencyName: "Washes",
      brandColor: "#FF6B00",
      welcomePoints: 2,
      rewardThreshold: 5,
      subscriptionStatus: "trial",
      plan: "starter",
      trialEndsAt: daysAgo(-6), // 6 days left
      locationLat: -26.2041,
      locationLng: 28.0473,
      locationLabel: "Boksburg, Gauteng",
      whatsappInstanceId: "tenant_mikes-car-wash",
      whatsappInstanceToken: "MIKES-DEMO-TOKEN-2026",
      whatsappPhone: "27835550001",
      whatsappConnectedAt: daysAgo(12),
      ownerName: 'Michael "Mike" Nkosi',
      ownerEmail: "mike@mikescarwash.co.za",
    },
  });

  // ── 2. Customers (40) — spread across churn-risk bands ───────────────────
  const customers = [];
  for (let i = 0; i < 40; i++) {
    const name = pickName(i);
    const phone = `2783${(100000 + i * 137).toString().padStart(6, "0")}`;
    // Points: skew distribution; some VIPs
    const points = i < 4 ? 15 + i * 3 : i % 7 === 0 ? 0 : (i % 5) + 2;
    const visits = i < 4 ? 8 + i * 2 : (i % 6) + 1;
    // Last visit: green <30d, amber 30-60d, red >60d
    let lastVisitDays: number;
    if (i < 16) lastVisitDays = (i % 25) + 1;            // active
    else if (i < 28) lastVisitDays = 30 + (i % 28);      // at-risk
    else lastVisitDays = 65 + (i % 40);                  // dormant
    const lastVisit = daysAgo(lastVisitDays);

    customers.push(
      await db.customer.create({
        data: {
          tenantId: mikes.id,
          phoneNumber: phone,
          name,
          points,
          visits,
          lastVisit,
          optedIn: i % 11 !== 0, // a few opted out
          joinedAt: daysAgo(lastVisitDays + 5 + (i % 10)),
        },
      })
    );
  }

  // ── 3. Loyalty transactions ──────────────────────────────────────────────
  for (let i = 0; i < customers.length; i++) {
    const c = customers[i];
    await db.loyaltyTransaction.create({
      data: {
        tenantId: mikes.id,
        customerId: c.id,
        pointsChange: 2,
        reason: "join_bonus",
        createdAt: c.joinedAt,
      },
    });
    // a few visit earns
    const visitCount = Math.min(c.visits, 4);
    for (let v = 0; v < visitCount; v++) {
      await db.loyaltyTransaction.create({
        data: {
          tenantId: mikes.id,
          customerId: c.id,
          pointsChange: 1,
          reason: "visit",
          createdAt: daysAgo(20 - v * 4),
        },
      });
    }
  }

  // ── 4. Past campaigns (mix of performers & duds) ─────────────────────────
  const campaigns = [
    {
      title: "Rainy Day Rinse Special",
      goal: "quiet_hours",
      message: "🌧️ Rainy day special at Mike's Car Wash! Come in for double Washes today. Valid until 5pm only!",
      audience: "all",
      status: "sent",
      sentCount: 38,
      redemptionCount: 14,
      sentAt: daysAgo(9),
    },
    {
      title: "Tuesday Flash Wash",
      goal: "quiet_hours",
      message: "⚡ Flash Tuesday! Your next Wash is FREE at Mike's Car Wash. Today only!",
      audience: "inactive",
      status: "sent",
      sentCount: 16,
      redemptionCount: 7,
      sentAt: daysAgo(4),
    },
    {
      title: "VIP Valet Upgrade",
      goal: "vip",
      message: "👑 Hey {{customer_name}}! As a VIP, enjoy a free interior vacuum with your next Wash this week.",
      audience: "vip",
      status: "sent",
      sentCount: 6,
      redemptionCount: 4,
      sentAt: daysAgo(14),
    },
    {
      title: "Weekend Wash Special",
      goal: "quiet_hours",
      message: "💦 Weekend special! 10% off all washes Sat & Sun at Mike's Car Wash.",
      audience: "all",
      status: "sent",
      sentCount: 36,
      redemptionCount: 2,
      sentAt: daysAgo(20),
    },
    {
      title: "We Miss You — Free Wash",
      goal: "winback",
      message: "👋 Hi {{customer_name}}, we haven't seen you at Mike's Car Wash in a while. Come back this week for a FREE Wash on us!",
      audience: "inactive",
      status: "sent",
      sentCount: 14,
      redemptionCount: 5,
      sentAt: daysAgo(27),
    },
  ];

  for (const c of campaigns) {
    await db.campaign.create({ data: { tenantId: mikes.id, ...c } });
  }

  // ── 5. Reward events (some claimed, some expired) ────────────────────────
  const redeemers = customers.slice(0, 8);
  for (let i = 0; i < redeemers.length; i++) {
    const c = redeemers[i];
    const claimed = i % 3 !== 2;
    await db.rewardEvent.create({
      data: {
        tenantId: mikes.id,
        customerId: c.id,
        triggerType: "manual",
        status: claimed ? "claimed" : "expired",
        pointsCost: mikes.rewardThreshold,
        expiresAt: daysAgo(3 - i),
        claimedAt: claimed ? daysAgo(3 - i) : null,
        createdAt: daysAgo(3 - i, 1),
      },
    });
  }

  // ── 6. Activity feed (recent) ────────────────────────────────────────────
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
  for (const f of feedItems) {
    await db.activity.create({
      data: {
        tenantId: mikes.id,
        type: f.type,
        customerName: f.customerName,
        message: f.message,
        createdAt: daysAgo(0, Math.floor(f.mins / 60) + (f.mins > 60 ? 0 : 0)),
      },
    });
    // adjust to minutes ago precisely
  }
  // Re-create with precise minutes-ago timestamps
  await db.activity.deleteMany({ where: { tenantId: mikes.id } });
  for (const f of feedItems) {
    const t = new Date();
    t.setMinutes(t.getMinutes() - f.mins);
    await db.activity.create({
      data: {
        tenantId: mikes.id,
        type: f.type,
        customerName: f.customerName,
        message: f.message,
        createdAt: t,
      },
    });
  }

  // ── 7. Webhook events (recent inbound) ───────────────────────────────────
  const webhookSamples = [
    { event: "messages.upsert", phone: customers[0].phoneNumber, content: "JOIN", status: "processed" },
    { event: "messages.upsert", phone: customers[1].phoneNumber, content: "REDEEM", status: "processed" },
    { event: "messages.upsert", phone: customers[2].phoneNumber, content: "BALANCE", status: "processed" },
    { event: "messages.upsert", phone: customers[5].phoneNumber, content: "hi", status: "processed" },
    { event: "connection.update", phone: null, content: "open", status: "processed" },
    { event: "messages.upsert", phone: "27839999999", content: "JOIN", status: "error" },
  ];
  for (let i = 0; i < webhookSamples.length; i++) {
    const w = webhookSamples[i];
    const t = new Date();
    t.setMinutes(t.getMinutes() - (i * 25 + 3));
    await db.webhookEvent.create({
      data: {
        tenantId: mikes.id,
        instanceName: "tenant_mikes-car-wash",
        eventType: w.event,
        phoneNumber: w.phone,
        messageContent: w.content,
        status: w.status,
        rawPayload: JSON.stringify({
          event: w.event,
          instance: { instanceName: "tenant_mikes-car-wash" },
          data: { key: { remoteJid: w.phone ? `${w.phone}@s.whatsapp.net` : null, fromMe: false }, message: { conversation: w.content } },
        }),
        createdAt: t,
      },
    });
  }

  // ── 8. Prospects (super admin CRM) ───────────────────────────────────────
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
    // For claimed/active prospects, create a ghost tenant first
    let tenantId: string | undefined;
    if (p.status === "claimed") {
      const t = await db.tenant.create({
        data: {
          name: p.business,
          slug: p.business.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
          industry: p.industry,
          currencyName: INDUSTRY_CURRENCY[p.industry],
          subscriptionStatus: "trial",
          plan: "starter",
          trialEndsAt: daysAgo(-9),
          ownerName: p.owner,
          claimedAt: daysAgo(5),
          whatsappInstanceId: `tenant_${p.business.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
          whatsappInstanceToken: `${p.business.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}-TOKEN`,
        },
      });
      tenantId = t.id;
    } else {
      // Unclaimed ghost tenant for non-claimed prospects
      const t = await db.tenant.create({
        data: {
          name: p.business,
          slug: `${p.business.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Math.random().toString(36).slice(2, 6)}`,
          industry: p.industry,
          currencyName: INDUSTRY_CURRENCY[p.industry],
          subscriptionStatus: "unclaimed",
          plan: "starter",
        },
      });
      tenantId = t.id;
    }

    await db.prospect.create({
      data: {
        businessName: p.business,
        ownerName: p.owner,
        phoneNumber: p.phone,
        location: p.loc,
        industry: p.industry,
        status: p.status,
        tenantId,
        inviteSentAt: p.status === "invited" ? daysAgo(2) : undefined,
      },
    });
  }

  // ── 9. A second fully-active tenant for platform broadcasts demo ─────────
  const mamaNomsa = await db.tenant.upsert({
    where: { slug: "mama-nomsas-kitchen" },
    update: {},
    create: {
      name: "Mama Nomsa's Kitchen",
      slug: "mama-nomsas-kitchen",
      industry: "restaurant",
      currencyName: "Points",
      brandColor: "#DC2626",
      welcomePoints: 10,
      rewardThreshold: 10,
      subscriptionStatus: "active",
      plan: "growth",
      whatsappInstanceId: "tenant_mama-nomsas-kitchen",
      whatsappInstanceToken: "MAMA-NOMSA-TOKEN",
      whatsappPhone: "27825550101",
      whatsappConnectedAt: daysAgo(30),
      ownerName: "Nomsa Sithole",
    },
  });

  // ── 10. Broadcast log ────────────────────────────────────────────────────
  await db.broadcastLog.create({
    data: {
      targetIndustry: "carwash",
      messagePreview: "📢 Flavourly update: New geo-claim rewards are live! Send a promo today to see it in action.",
      recipientCount: 1,
      sentCount: 1,
      sentBy: "super_admin",
      createdAt: daysAgo(3),
      recipients: {
        create: [{ tenantId: mikes.id, delivered: true }],
      },
    },
  });

  // ── 11. Payment transaction (one complete) ───────────────────────────────
  await db.paymentTransaction.create({
    data: {
      tenantId: mamaNomsa.id,
      plan: "growth",
      amount: 499.0,
      mPaymentId: "pf-demo-0001",
      pfPaymentId: "10470001",
      payfastToken: "tok-demo-mamanomsa",
      status: "complete",
      createdAt: daysAgo(25),
    },
  });

  console.log("✅ Seed complete.");
  console.log(`   Tenant: Mike's Car Wash (${mikes.id})`);
  console.log(`   Customers: ${customers.length}`);
  console.log(`   Campaigns: ${campaigns.length}`);
  console.log(`   Prospects: ${prospectData.length}`);
  console.log(`\n🔑 Demo claim token for Mike's ghost prospects available via /api/prospects.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
