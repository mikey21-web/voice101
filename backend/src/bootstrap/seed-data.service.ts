import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as yaml from 'js-yaml';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const KB_ARTICLES: Record<string, { title: string; body: string; tags: string[] }[]> = {
  real_estate: [
    { title: 'About Acme Realty', body: 'Acme Realty has been serving Bangalore for 12+ years. We specialize in residential and commercial properties across all major areas.', tags: ['about', 'company'] },
    { title: 'Buying Process', body: 'Step 1: Property search and shortlist. Step 2: Site visit. Step 3: Budget verification and loan pre-approval. Step 4: Booking and agreement. Step 5: Registration.', tags: ['services', 'buying'] },
    { title: 'RERA Explained', body: 'RERA (Real Estate Regulatory Authority) registration ensures project transparency. All our listings include RERA numbers for verification.', tags: ['faq', 'rera'] },
    { title: 'Home Loan Guidance', body: 'We work with SBI, HDFC, ICICI, and Axis Bank. Typical rates: 8.5%-9.5% p.a. Loan eligibility is 3x annual income. We assist with pre-approval.', tags: ['services', 'finance'] },
    { title: 'Property Tax & Registration', body: 'Registration charges: 5-6% of property value. Stamp duty: 3-5%. Annual property tax varies by area (typically 0.5-1% of guidance value).', tags: ['faq', 'legal'] },
  ],
  hospitality: [
    { title: 'About StayWell Hotels', body: 'StayWell Hotels offers premium accommodation in Bangalore. We have Standard, Deluxe, Suite, and Villa categories. Check-in: 2 PM, Check-out: 11 AM.', tags: ['about', 'company'] },
    { title: 'Room Categories', body: 'Standard Room (250 sqft) - ₹3,500/night. Deluxe Room (400 sqft) - ₹5,500/night. Suite (700 sqft) - ₹9,000/night. Villa (1200 sqft) - ₹15,000/night.', tags: ['services', 'rooms'] },
    { title: 'Hotel Amenities', body: 'Free WiFi, Complimentary breakfast (7-10 AM), Swimming pool (6 AM-8 PM), Gym (24hrs), Airport pickup (₹1,500), Laundry service.', tags: ['services', 'amenities'] },
    { title: 'Cancellation Policy', body: 'Free cancellation up to 48 hours before check-in. 50% charge within 24-48 hours. No refund within 24 hours.', tags: ['faq', 'policies'] },
    { title: 'Nearby Attractions', body: 'MG Road (2 km), UB City Mall (3 km), Cubbon Park (4 km), Bangalore Palace (5 km), Lalbagh Garden (8 km).', tags: ['local', 'attractions'] },
  ],
  healthcare: [
    { title: 'About CarePlus Clinic', body: 'CarePlus Clinic is a multi-specialty clinic in Bangalore. We have departments: General Medicine, Dental, Pediatrics, Dermatology, Orthopedics, and Cardiology.', tags: ['about', 'company'] },
    { title: 'Our Doctors', body: 'General Medicine: Dr. Sharma (MBBS, MD). Dental: Dr. Patel (BDS, MDS). Pediatrics: Dr. Rao (MD Pediatrics). Dermatology: Dr. Khan (MD Derm). Orthopedics: Dr. Singh (MS Ortho). Cardiology: Dr. Verma (DM Cardio).', tags: ['services', 'doctors'] },
    { title: 'Clinic Hours', body: 'Monday-Saturday: 9 AM - 8 PM. Sunday: 10 AM - 2 PM (emergency only). Appointments recommended for all departments.', tags: ['faq', 'timings'] },
    { title: 'Insurance & Payments', body: 'We accept: Cash, Cards (all major), UPI, and insurance from Star Health, Apollo Munich, ICICI Lombard, HDFC ERGO. Cashless for most plans.', tags: ['services', 'insurance'] },
    { title: 'Appointment Process', body: 'New patients: Arrive 15 minutes early with ID and previous reports. Follow-ups: Bring prescriptions. Lab reports delivered within 24 hours.', tags: ['faq', 'appointments'] },
  ],
  logistics: [
    { title: 'About SwiftFreight', body: 'SwiftFreight provides FTL, LTL, air freight, sea freight, and express courier services across India. 15+ years of logistics expertise.', tags: ['about', 'company'] },
    { title: 'Shipping Services', body: 'FTL (Full Truck Load): For large shipments. LTL (Less Than Truck Load): Share space. Air Freight: Urgent/time-sensitive. Sea Freight: Bulk/heavy. Express: Small packages, fast delivery.', tags: ['services', 'shipping'] },
    { title: 'Packaging Guidelines', body: 'General cargo: Use corrugated boxes. Fragile items: Double box with bubble wrap. Hazardous: Special packaging required. Oversized: Wooden crating recommended.', tags: ['faq', 'packaging'] },
    { title: 'Delivery Timeframes', body: 'Local: Same day. Regional (same state): 1-2 days. National (metro to metro): 3-5 days. National (tier 2 cities): 5-7 days. Air freight: 1-2 days.', tags: ['services', 'timelines'] },
    { title: 'Hazardous & Restricted Items', body: 'We cannot ship: Explosives, flammable liquids, radioactive materials, perishables without proper packaging. Contact us for hazmat guidelines.', tags: ['faq', 'restricted'] },
  ],
  events: [
    { title: 'About EventPro Marketing', body: 'EventPro Marketing specializes in weddings, corporate events, birthdays, conferences, and exhibitions. Full-service event planning and execution.', tags: ['about', 'company'] },
    { title: 'Our Services', body: 'Catering (Indian, Continental, Chinese), Decoration (Theme-based, Floral, Lighting), Photography (Candid, Traditional, Drone), Music (DJ, Live band), Transport (Guest shuttles, VIP transport).', tags: ['services', 'offerings'] },
    { title: 'Event Packages', body: 'Silver (₹50K-1L): Basic decoration + catering. Gold (₹1L-5L): Full decoration + catering + photography. Platinum (₹5L+): Premium everything + venue coordination + dedicated team.', tags: ['services', 'pricing'] },
    { title: 'Planning Timeline', body: '3-6 months before: Book venue and date. 2-3 months: Finalize vendors. 1 month: Send invitations. 1 week: Confirm all arrangements. 1 day: Setup and rehearsal.', tags: ['faq', 'planning'] },
    { title: 'Venue Selection Tips', body: 'Indoor: AC-controlled, weather-proof. Outdoor: Scenic, spacious, weather-dependent. Both: Combine ceremony + reception. Consider capacity, parking, accessibility.', tags: ['faq', 'venues'] },
  ],
  agency: [
    { title: 'About GrowthEdge Marketing', body: 'GrowthEdge Marketing is a full-service digital marketing agency. We help businesses grow through lead generation, social media, and performance marketing.', tags: ['about', 'company'] },
    { title: 'Our Services', body: 'Lead generation campaigns, social media management, content marketing, PPC advertising, email marketing, SEO, website design, and branding.', tags: ['services', 'offerings'] },
    { title: 'Campaign Process', body: 'Discovery → Strategy → Creative → Launch → Monitor → Optimize → Report. Typical campaign duration: 30-90 days depending on scope.', tags: ['services', 'process'] },
  ],
};

@Injectable()
export class SeedDataService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedDataService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    const configPath = this.resolveConfigPath();
    if (!configPath) return;
    const raw = yaml.load(readFileSync(configPath, 'utf-8')) as any;
    const industry = raw?.niche?.industry || '';
    const tenant = await this.prisma.tenant.findFirst({ where: { active: true } });
    if (!tenant) return;

    const admin = await this.prisma.user.findFirst({ where: { tenantId: tenant.id, role: 'OWNER' } });
    if (!admin) { this.logger.warn('No admin user found, skipping seed data'); return; }

    if (industry === 'real_estate') await this.seedProperties(tenant.id);
    await this.seedKnowledgeArticles(tenant.id, admin.id, industry);
    await this.seedMessageTemplates(tenant.id, admin.id);

    this.logger.log(`Seed data complete for ${industry}`);
  }

  private resolveConfigPath(): string | null {
    const envPath = this.config.get<string>('NICHE_CONFIG_PATH');
    if (envPath && existsSync(envPath)) return envPath;
    for (const c of [resolve(process.cwd(), 'niche.config.yaml'), '/app/niche.config.yaml']) {
      if (existsSync(c)) return c;
    }
    return null;
  }

  private async seedProperties(tenantId: string) {
    const count = await this.prisma.property.count({ where: { tenantId } });
    if (count > 0) { this.logger.log('Properties already seeded'); return; }

    const properties = [
      {
        title: '3BHK Premium Apartment, HSR Layout',
        propertyType: 'APARTMENT' as const, status: 'AVAILABLE' as const, price: 8500000,
        bedrooms: 3, bathrooms: 2, areaSqft: 1450,
        location: 'HSR Layout, Bangalore', address: 'Sector 3, HSR Layout, Bangalore 560102',
        features: ['Gated community', 'Power backup', 'Covered parking', 'Security'],
        amenities: ['Swimming pool', 'Gym', 'Children park', 'Clubhouse'],
        reraId: 'PRM/KA/RERA/1251/446/AG/171104/001715',
        featured: true,
      },
      {
        title: '4BHK Luxury Villa, Whitefield',
        propertyType: 'VILLA' as const, status: 'AVAILABLE' as const, price: 25000000,
        bedrooms: 4, bathrooms: 4, areaSqft: 3200,
        location: 'Whitefield, Bangalore', address: 'Whitefield Main Road, Bangalore 560066',
        features: ['Private garden', 'Modular kitchen', 'Home automation', 'Rainwater harvesting'],
        amenities: ['Private pool', 'Landscaped garden', 'Parking for 3 cars', 'Servant quarter'],
        reraId: 'PRM/KA/RERA/1251/446/AG/171104/002841',
        featured: true,
      },
      {
        title: '2BHK Budget Apartment, Electronic City',
        propertyType: 'APARTMENT' as const, status: 'AVAILABLE' as const, price: 4500000,
        bedrooms: 2, bathrooms: 2, areaSqft: 950,
        location: 'Electronic City, Bangalore', address: 'Phase 1, Electronic City, Bangalore 560100',
        features: ['Vaastu compliant', 'Near metro', 'CCTV surveillance'],
        amenities: ['Community hall', 'Indoor games', 'Garden'],
      },
      {
        title: 'Commercial Office Space, MG Road',
        propertyType: 'COMMERCIAL' as const, status: 'AVAILABLE' as const, price: 18000000,
        bedrooms: 0, bathrooms: 2, areaSqft: 1200,
        location: 'MG Road, Bangalore', address: 'MG Road, Ashok Nagar, Bangalore 560001',
        features: ['Prime location', 'High footfall', 'Parking', '24hr security'],
        amenities: ['Elevator', 'Conference room', 'Cafeteria'],
      },
      {
        title: 'Penthouse, UB City',
        propertyType: 'PENTHOUSE' as const, status: 'AVAILABLE' as const, price: 58000000,
        bedrooms: 4, bathrooms: 5, areaSqft: 4500,
        location: 'UB City, Bangalore', address: 'Vittal Mallya Road, Bangalore 560001',
        features: ['Panoramic view', 'Private terrace', 'Smart home', 'Butler service'],
        amenities: ['Infinity pool', 'Private gym', 'Wine cellar', 'Spa', 'Valet parking'],
        featured: true,
      },
    ];

    for (const p of properties) {
      const prop = await this.prisma.property.create({
        data: { tenantId, ...p, availableFrom: new Date() },
      });
      this.logger.log(`Seeded property: ${prop.title}`);
    }
  }

  private async seedKnowledgeArticles(tenantId: string, authorId: string, industry: string) {
    const articles = KB_ARTICLES[industry] || KB_ARTICLES.agency;
    let seeded = 0;
    for (const article of articles) {
      const slug = article.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
      const existing = await this.prisma.knowledgeArticle.findUnique({ where: { slug } });
      if (existing) continue;
      await this.prisma.knowledgeArticle.create({
        data: { tenantId, authorId, title: article.title, slug, body: article.body, tags: article.tags, published: true },
      });
      seeded++;
    }
    if (seeded > 0) this.logger.log(`Seeded ${seeded} knowledge articles for ${industry}`);
  }

  private async seedMessageTemplates(tenantId: string, creatorId: string) {
    const existing = await this.prisma.messageTemplate.count({ where: { creator: { tenantId } } });
    if (existing > 0) { this.logger.log('Message templates already seeded for this tenant'); return; }

    const extractVars = (body: string) => Array.from(body.matchAll(/\{\{(\w+)\}\}/g), m => m[1]);

    const templates = [
      { name: 'First Reply', type: 'WELCOME' as const, body: 'Hi {{buyerName}}, thank you for your interest in {{projectName}}. This is {{agentName}} from {{builderName}}. Let me know what you\'d like to know more about!' },
      { name: 'Brochure Share', type: 'WELCOME' as const, body: 'Hi {{buyerName}}, here\'s the brochure for {{projectName}} with pricing, floor plans, and amenities. Let me know if you\'d like to discuss further!' },
      { name: 'Location Pin', type: 'FOLLOW_UP' as const, body: 'Hi {{buyerName}}, here\'s the exact location of {{projectName}}: {{locationLink}}. Let me know when you\'d like to visit!' },
      { name: 'Visit Confirmation', type: 'APPOINTMENT_LINK' as const, body: 'Hi {{buyerName}}, your site visit at {{projectName}} is confirmed for {{visitDate}} at {{visitTime}}. See you there!' },
      { name: 'Visit Reminder', type: 'FOLLOW_UP' as const, body: 'Hi {{buyerName}}, just a reminder — your site visit at {{projectName}} is tomorrow at {{visitTime}}. Reply CONFIRM or RESCHEDULE.' },
      { name: 'No-Show Recovery', type: 'FOLLOW_UP' as const, body: 'Hi {{buyerName}}, we missed you at {{projectName}} today. Would you like to reschedule? We have slots available this week.' },
      { name: 'Cost Sheet Follow-up', type: 'FOLLOW_UP' as const, body: 'Hi {{buyerName}}, I sent over the cost sheet for {{unitNumber}} at {{projectName}}. Have you had a chance to review it? Happy to answer questions.' },
      { name: 'Token Reminder', type: 'PAYMENT_LINK' as const, body: 'Hi {{buyerName}}, just a reminder that the booking token of {{tokenAmount}} for {{unitNumber}} at {{projectName}} is due. Let me know if you need payment details.' },
      { name: 'Payment Due', type: 'PAYMENT_LINK' as const, body: 'Hi {{buyerName}}, your payment of {{amount}} for {{unitNumber}} at {{projectName}} is due on {{dueDate}}. Please make the payment to avoid late fees.' },
      { name: 'Possession Update', type: 'CRM_CONFIRMATION' as const, body: 'Hi {{buyerName}}, great news! Possession of your {{unitNumber}} at {{projectName}} is expected by {{possessionDate}}. We\'ll keep you updated on the handover process.' },
      // POST_CALL_TEMPLATE_NAME in voice-agent/post-call-dispatch.service.ts.
      // Required by name: the details promised on a voice call are sent to a
      // number that has never messaged us, so the 24h session window is shut
      // and only an approved template gets through. Without this row every
      // post-call WhatsApp is blocked by design.
      { name: 'post_call_details', type: 'FOLLOW_UP' as const, body: 'Hi {{buyerName}}, thanks for the call. Here are the details on {{topic}} as promised. Reply here anytime if you have questions.' },
    ];

    for (const t of templates) {
      await this.prisma.messageTemplate.create({
        data: {
          name: t.name,
          type: t.type,
          channel: 'WHATSAPP',
          body: t.body,
          variables: extractVars(t.body),
          creatorId,
          active: true,
          version: 1,
        },
      });
    }
    this.logger.log(`Seeded ${templates.length} message templates`);
  }
}
