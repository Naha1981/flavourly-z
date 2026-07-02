"use client";

import { useFlavourly } from "@/lib/store";
import { X, FileText, Shield } from "lucide-react";

export function LegalOverlay() {
  const { legalOverlay, closeLegal } = useFlavourly();
  if (!legalOverlay) return null;

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-background">
      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur border-b border-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold">
            {legalOverlay === "privacy" ? <Shield className="w-5 h-5 text-brand" /> : <FileText className="w-5 h-5 text-brand" />}
            {legalOverlay === "privacy" ? "Privacy Policy" : "Terms of Service"}
          </div>
          <button
            onClick={closeLegal}
            className="w-10 h-10 rounded-full hover:bg-accent flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {legalOverlay === "privacy" ? <PrivacyContent /> : <TermsContent />}
        <div className="mt-8 pt-6 border-t border-border text-xs text-muted-foreground">
          <p>
            This document is boilerplate generated for the Flavourly OS demo. Before going live,
            have it reviewed by a legal professional qualified in South African law and POPIA compliance.
          </p>
        </div>
      </div>
    </div>
  );
}

function PrivacyContent() {
  return (
    <article className="prose prose-sm sm:prose-base max-w-none">
      <h1 className="text-3xl font-black mb-2">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground mb-8">Last updated: June 2026 · Version 1.0</p>

      <Section title="1. Who we are">
        <p>
          Flavourly OS ("we", "us", "our") is a WhatsApp-native customer loyalty platform operated
          in South Africa. We process personal information on behalf of local SMEs ("tenants") to help
          them run digital loyalty programmes for their customers.
        </p>
      </Section>

      <Section title="2. What information we collect">
        <ul>
          <li><strong>Tenant business information:</strong> business name, owner name, email, phone number, industry, location.</li>
          <li><strong>End-customer information:</strong> WhatsApp phone number, name (if provided), loyalty point balance, visit history, opt-in status. Collected when customers text JOIN to a tenant's WhatsApp number.</li>
          <li><strong>Usage data:</strong> campaign sends, redemption events, webhook logs, payment transactions.</li>
          <li><strong>Payment data:</strong> processed by PayFast; we store transaction IDs and plan status only — never card details.</li>
        </ul>
      </Section>

      <Section title="3. How we use your information (POPIA)">
        <p>We process personal information for these lawful purposes under the Protection of Personal Information Act (POPIA):</p>
        <ul>
          <li>Providing the loyalty service to tenants and their customers.</li>
          <li>Sending WhatsApp messages that customers have opted into (JOIN keyword).</li>
          <li>Processing subscription payments via PayFast.</li>
          <li>Generating aggregated, anonymised insights for tenants.</li>
          <li>Complying with legal obligations.</li>
        </ul>
      </Section>

      <Section title="4. Data isolation between tenants">
        <p>
          Each tenant's customer data is strictly isolated. Tenant A cannot access Tenant B's customers,
          campaigns, or activity. Customer phone numbers are never shared across tenants — a customer
          who joins Mike's Car Wash is invisible to Mama Nomsa's Kitchen.
        </p>
      </Section>

      <Section title="5. WhatsApp opt-out">
        <p>
          End-customers can opt out at any time by texting <strong>STOP</strong> to the tenant's WhatsApp
          number. Their <code>opted_in</code> status is set to false and they receive no further marketing
          messages. They can re-subscribe by texting <strong>JOIN</strong>.
        </p>
      </Section>

      <Section title="6. Data retention">
        <ul>
          <li>Active tenant data: retained while the subscription is active.</li>
          <li>Cancelled tenant data: retained for 30 days, then deleted (export available on request).</li>
          <li>End-customer data: deleted when the tenant account is deleted.</li>
          <li>Webhook event logs: retained for 90 days for debugging, then automatically purged.</li>
          <li>Payment records: retained for 5 years per SARS requirements.</li>
        </ul>
      </Section>

      <Section title="7. Your rights (POPIA)">
        <p>As a data subject, you have the right to:</p>
        <ul>
          <li>Access the personal information we hold about you.</li>
          <li>Correct inaccurate information.</li>
          <li>Request deletion of your data.</li>
          <li>Object to processing of your data.</li>
          <li>Lodge a complaint with the Information Regulator (www.inforegulator.org.za).</li>
        </ul>
        <p>To exercise these rights, email <a href="mailto:privacy@flavourly.os" className="text-brand">privacy@flavourly.os</a>.</p>
      </Section>

      <Section title="8. Security">
        <p>
          We use industry-standard security measures: encrypted password hashing (bcrypt), HTTPS for all
          connections, row-level data isolation, and secure payment processing via PayFast. Despite these
          measures, no internet transmission is 100% secure.
        </p>
      </Section>

      <Section title="9. Third-party processors">
        <ul>
          <li><strong>Evolution API:</strong> WhatsApp message delivery (WhatsApp Business API via Meta).</li>
          <li><strong>PayFast:</strong> subscription payment processing.</li>
          <li><strong>Supabase / hosting provider:</strong> database and application hosting.</li>
        </ul>
        <p>Each processor is bound by data processing agreements and operates within POPIA compliance.</p>
      </Section>

      <Section title="10. Changes to this policy">
        <p>We may update this policy. Tenants will be notified via WhatsApp 30 days before material changes take effect.</p>
      </Section>

      <Section title="11. Contact">
        <p>Information Officer: privacy@flavourly.os · Flavourly OS, Johannesburg, South Africa.</p>
      </Section>
    </article>
  );
}

function TermsContent() {
  return (
    <article className="prose prose-sm sm:prose-base max-w-none">
      <h1 className="text-3xl font-black mb-2">Terms of Service</h1>
      <p className="text-sm text-muted-foreground mb-8">Last updated: June 2026 · Version 1.0</p>

      <Section title="1. Agreement">
        <p>
          By claiming a Flavourly OS dashboard or using the service, you agree to these terms.
          If you do not agree, do not use the service.
        </p>
      </Section>

      <Section title="2. Your subscription">
        <ul>
          <li><strong>Free trial:</strong> 14 days from claim. No credit card required. Full access to all features.</li>
          <li><strong>Starter plan:</strong> R299/month. Up to 500 customers. All core features.</li>
          <li><strong>Growth plan:</strong> R499/month. Unlimited customers. Advanced automations.</li>
          <li><strong>Billing:</strong> Monthly recurring via PayFast. Cancel anytime — access continues until the end of the billing cycle.</li>
          <li><strong>Expired/cancelled accounts:</strong> Dashboard becomes read-only. Campaign sending is disabled. Data is retained for 30 days.</li>
        </ul>
      </Section>

      <Section title="3. Acceptable use">
        <p>You agree NOT to:</p>
        <ul>
          <li>Send WhatsApp messages to customers who have not opted in (texted JOIN) or who have opted out (texted STOP).</li>
          <li>Use the service for spam, phishing, or any unlawful purpose.</li>
          <li>Share your account credentials with third parties.</li>
          <li>Attempt to access other tenants' data.</li>
          <li>Resell or white-label the service without written permission.</li>
          <li>Send more than 1,000 WhatsApp messages per day without contacting support (to avoid WhatsApp bans).</li>
        </ul>
      </Section>

      <Section title="4. WhatsApp compliance">
        <p>
          Flavourly OS uses the Evolution API to connect to WhatsApp Business. You are responsible for
          complying with WhatsApp's Terms of Service and Business Policy. We rate-limit message sending
          (batches of 10, 3-second delays) to protect your number from bans, but repeated violations of
          WhatsApp's policies may result in your number being blocked by WhatsApp — this is outside our control.
        </p>
      </Section>

      <Section title="5. Your data">
        <p>
          You own your customer data. We process it on your behalf. You can export your customer list at
          any time. Upon account deletion, your data is permanently removed after 30 days.
        </p>
      </Section>

      <Section title="6. Service availability">
        <p>
          We target 99.5% uptime. The service depends on third-party providers (WhatsApp/Meta, PayFast,
          hosting). We are not liable for outages caused by these providers. Scheduled maintenance is
          announced 48 hours in advance.
        </p>
      </Section>

      <Section title="7. Limitation of liability">
        <p>
          Flavourly OS is provided "as is". To the maximum extent permitted by law, we are not liable for:
        </p>
        <ul>
          <li>Indirect, incidental, or consequential damages.</li>
          <li>Loss of revenue or profits resulting from service interruptions.</li>
          <li>WhatsApp number bans resulting from your messaging practices.</li>
          <li>Any single incident exceeding the amount paid in the preceding 3 months.</li>
        </ul>
      </Section>

      <Section title="8. Refunds">
        <p>
          Monthly subscriptions are non-refundable. If you cancel mid-cycle, you retain access until the
          end of the paid period. If the service is materially defective for more than 24 hours, contact
          us for a pro-rata credit.
        </p>
      </Section>

      <Section title="9. Termination">
        <p>
          You can cancel anytime from Settings → Billing. We may suspend or terminate accounts that
          violate these terms or POPIA, with 7 days' notice (except in cases of fraud or spam, which
          may result in immediate suspension).
        </p>
      </Section>

      <Section title="10. Governing law">
        <p>
          These terms are governed by the laws of the Republic of South Africa. Disputes are resolved
          in the courts of Johannesburg, Gauteng.
        </p>
      </Section>

      <Section title="11. Contact">
        <p>Questions? Email <a href="mailto:hello@flavourly.os" className="text-brand">hello@flavourly.os</a></p>
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="text-lg font-bold mb-2">{title}</h2>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_a]:font-semibold">
        {children}
      </div>
    </section>
  );
}
