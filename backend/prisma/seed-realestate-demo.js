// Demo data seed for the real-estate niche dashboard (realestate.deploysafe.in).
// Plain JS (not TS) so it can run directly with `node` inside the backend
// container without needing dev dependencies like ts-node.
//
// Run: node prisma/seed-realestate-demo.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

const TENANT_ID = 'default-tenant';

// Verified-live Unsplash photo IDs (checked with curl before use).
const PHOTOS = {
  apartmentExterior: ['1600596542815-ffad4c1539a9', '1564013799919-ab600027ffc6', '1600210492486-724fe5c67fb0', '1600607688969-a5bfcd646154'],
  villaExterior: ['1568605114967-8130f3a36994', '1493809842364-78817add7ffb', '1580587771525-78b9dba3b914', '1615874959474-d609969a20ed'],
  houseExterior: ['1600607687939-ce8a6c25118c', '1512918728675-ed5a9ecdebfd', '1560448204-e02f11c3d0e2', '1522771739844-6a9f6d5f14af'],
  livingRoom: ['1512917774080-9991f1c4c750', '1523217582562-09d0def993a6', '1600585154340-be6161a56a0c', '1600585152220-90363fe7e115'],
  bedroom: ['1600566753086-00f18fb6b3ea', '1600210491892-03d54c0aaf87', '1600585154526-990dced4db0d'],
  kitchen: ['1502672260266-1c1ef2d93688', '1600607687920-4e2a09cf159d', '1600047509807-ba8f99d2cdde'],
  bathroom: ['1600210491369-e753d80a41f3', '1600585152915-d208bec867a1', '1560185893-a55cbc8c57e8'],
  officeCommercial: ['1613977257363-707ba9348227', '1570129477492-45c003edd2be', '1583608205776-bfd35f0d9f83'],
  poolAmenity: ['1591825729269-caeb344f6df2', '1592595896616-c37162298647'],
  interiorGeneric: ['1571055107559-3e67626fa8be', '1522708323590-d24dbb6b0267', '1598928506311-c55ded91a20c', '1615529162924-f8605388461d', '1600121848594-d8644e57abab', '1613490493576-7fde63acd811', '1600047509358-9dc75507daeb'],
};
function img(id, w = 1600) { return `https://images.unsplash.com/photo-${id}?w=${w}&auto=format&fit=crop&q=80`; }

function daysAgo(n) { return new Date(Date.now() - n * 86400000); }
function daysFromNow(n) { return new Date(Date.now() + n * 86400000); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

async function main() {
  console.log('Hashing demo password...');
  const passwordHash = await bcrypt.hash('Demo@12345', 12);

  // ============ 1. TEAM (Users) ============
  console.log('Seeding team members...');
  const teamData = [
    { name: 'Ravi Kumar', email: 'ravi.kumar@acmerealty.demo', role: 'MANAGER', department: 'Sales', salaryType: 'month', monthlySalary: 95000 },
    { name: 'Sunita Rao', email: 'sunita.rao@acmerealty.demo', role: 'MANAGER', department: 'Operations', salaryType: 'month', monthlySalary: 90000 },
    { name: 'Arjun Mehta', email: 'arjun.mehta@acmerealty.demo', role: 'SALES_AGENT', department: 'Sales', salaryType: 'month', monthlySalary: 45000 },
    { name: 'Priya Sharma', email: 'priya.sharma@acmerealty.demo', role: 'SALES_AGENT', department: 'Sales', salaryType: 'month', monthlySalary: 45000 },
    { name: 'Karthik Iyer', email: 'karthik.iyer@acmerealty.demo', role: 'SALES_AGENT', department: 'Sales', salaryType: 'month', monthlySalary: 42000 },
    { name: 'Divya Nair', email: 'divya.nair@acmerealty.demo', role: 'SALES_AGENT', department: 'Sales', salaryType: 'month', monthlySalary: 42000 },
    { name: 'Rohit Verma', email: 'rohit.verma@acmerealty.demo', role: 'SALES_AGENT', department: 'Sales', salaryType: 'month', monthlySalary: 40000 },
    { name: 'Ananya Reddy', email: 'ananya.reddy@acmerealty.demo', role: 'SALES_AGENT', department: 'Sales', salaryType: 'month', monthlySalary: 40000 },
    { name: 'Vikram Singh', email: 'vikram.singh@acmerealty.demo', role: 'SALES_AGENT', department: 'Sales', salaryType: 'month', monthlySalary: 38000 },
    { name: 'Meera Pillai', email: 'meera.pillai@acmerealty.demo', role: 'SALES_AGENT', department: 'Sales', salaryType: 'month', monthlySalary: 38000 },
    { name: 'Suresh Babu', email: 'suresh.babu@acmerealty.demo', role: 'SUPPORT_AGENT', department: 'Customer Success', salaryType: 'month', monthlySalary: 32000 },
    { name: 'Lakshmi Menon', email: 'lakshmi.menon@acmerealty.demo', role: 'SUPPORT_AGENT', department: 'Customer Success', salaryType: 'month', monthlySalary: 32000 },
    { name: 'Deepak Joshi', email: 'deepak.joshi@acmerealty.demo', role: 'ADMIN', department: 'Finance', salaryType: 'month', monthlySalary: 60000 },
  ];
  const team = [];
  for (const t of teamData) {
    const existing = await prisma.user.findUnique({ where: { email: t.email } });
    const user = existing || await prisma.user.create({
      data: { ...t, tenantId: TENANT_ID, password: passwordHash, active: true },
    });
    team.push(user);
  }
  const managers = team.filter(u => u.role === 'MANAGER');
  const agents = team.filter(u => u.role === 'SALES_AGENT');
  const owner = (await prisma.user.findFirst({ where: { tenantId: TENANT_ID, role: 'OWNER' } })) || team[0];
  console.log(`  ${team.length} team members ready`);

  // Leave Log
  console.log('Seeding leave requests...');
  const leaveStatuses = ['PENDING', 'APPROVED', 'APPROVED', 'REJECTED', 'APPROVED'];
  for (let i = 0; i < 8; i++) {
    const u = pick(agents.length ? agents : team);
    await prisma.leaveRequest.create({
      data: {
        tenantId: TENANT_ID, userId: u.id,
        startDate: daysFromNow(rnd(-20, 20)), endDate: daysFromNow(rnd(21, 25)),
        status: pick(leaveStatuses), approvedById: pick(leaveStatuses) !== 'PENDING' ? (managers[0]?.id || owner.id) : undefined,
      },
    });
  }

  // Salary records (advances + salary payouts) for team
  console.log('Seeding salary records...');
  const months = ['2026-05', '2026-06', '2026-07'];
  for (const u of team.filter(t => t.monthlySalary)) {
    for (const m of months) {
      await prisma.salaryRecord.create({ data: { tenantId: TENANT_ID, userId: u.id, month: m, amount: u.monthlySalary, type: 'SALARY', paidAt: m === '2026-07' ? null : daysAgo(rnd(30, 90)) } });
    }
    if (Math.random() > 0.6) {
      await prisma.salaryRecord.create({ data: { tenantId: TENANT_ID, userId: u.id, month: '2026-07', amount: Math.round(u.monthlySalary * 0.2), type: 'ADVANCE', paidAt: daysAgo(rnd(1, 10)) } });
    }
  }

  // Sales targets
  console.log('Seeding sales targets...');
  for (const a of agents.slice(0, 6)) {
    await prisma.salesTarget.create({
      data: {
        tenantId: TENANT_ID, scope: 'AGENT', userId: a.id, metric: 'BOOKINGS',
        periodStart: new Date('2026-07-01'), periodEnd: new Date('2026-07-31'), targetValue: rnd(3, 8), createdById: owner.id,
      },
    });
  }
  await prisma.salesTarget.create({ data: { tenantId: TENANT_ID, scope: 'TENANT', metric: 'COLLECTIONS_PAISE', periodStart: new Date('2026-07-01'), periodEnd: new Date('2026-07-31'), targetValue: 500000000, createdById: owner.id } });

  // ============ 2. PROJECTS (builder developments) with Towers + Units ============
  console.log('Seeding projects, towers, units...');
  const projectData = [
    { name: 'Skyline Meridian', location: 'Whitefield, Bangalore', status: 'UNDER_CONSTRUCTION', possessionDate: daysFromNow(400), amenities: ['Clubhouse', 'Swimming Pool', 'Gym', 'Children Play Area', '24x7 Security'] },
    { name: 'Palm Orchid Residency', location: 'Sarjapur Road, Bangalore', status: 'READY_TO_MOVE', possessionDate: daysAgo(60), amenities: ['Clubhouse', 'Jogging Track', 'Landscaped Garden', 'Indoor Games'] },
    { name: 'Emerald Heights', location: 'Hebbal, Bangalore', status: 'UNDER_CONSTRUCTION', possessionDate: daysFromNow(650), amenities: ['Rooftop Infinity Pool', 'Gym', 'Party Hall', 'EV Charging'] },
    { name: 'Sunrise Greenfield', location: 'Gachibowli, Hyderabad', status: 'READY_TO_MOVE', possessionDate: daysAgo(120), amenities: ['Clubhouse', 'Swimming Pool', 'Tennis Court', 'Amphitheatre'] },
    { name: 'Lakeview Serenity', location: 'HITEC City, Hyderabad', status: 'PLANNING', possessionDate: daysFromNow(900), amenities: ['Lake-facing Deck', 'Spa', 'Co-working Lounge'] },
    { name: 'Urban Nest Enclave', location: 'Electronic City, Bangalore', status: 'COMPLETED', possessionDate: daysAgo(400), amenities: ['Clubhouse', 'Gym', 'Kids Play Area', 'Multipurpose Hall'] },
  ];
  const projects = [];
  for (const p of projectData) {
    const project = await prisma.project.create({
      data: {
        tenantId: TENANT_ID, name: p.name, location: p.location, address: p.location,
        description: `${p.name} is a premium residential development in ${p.location} offering thoughtfully designed 2/3/4 BHK homes with modern amenities.`,
        status: p.status, possessionDate: p.possessionDate, amenities: p.amenities,
        reraId: `PRM/KA/RERA/${rnd(1000, 1299)}/${rnd(300, 800)}/PR/${rnd(100000, 999999)}`,
        images: [img(pick(PHOTOS.apartmentExterior)), img(pick(PHOTOS.livingRoom)), img(pick(PHOTOS.poolAmenity))],
      },
    });
    const tower = await prisma.tower.create({ data: { projectId: project.id, name: 'Tower A', totalFloors: rnd(12, 24) } });
    const units = [];
    for (let i = 1; i <= 4; i++) {
      const unit = await prisma.unit.create({
        data: {
          tenantId: TENANT_ID, projectId: project.id, towerId: tower.id,
          unitNumber: `A-${100 + i * 100 + rnd(1, 9)}`, floor: i * 3, unitType: pick(['2BHK', '3BHK', '3BHK', '4BHK']),
          areaSqft: rnd(1050, 2400), price: rnd(6500000, 32000000), status: pick(['AVAILABLE', 'AVAILABLE', 'BOOKED', 'SOLD']),
          facing: pick(['North', 'East', 'South-East', 'West']),
        },
      });
      units.push(unit);
    }
    projects.push({ ...project, units });
  }
  console.log(`  ${projects.length} projects with towers/units ready`);

  // ============ 3. PROPERTIES (broker/resale listings) — top up to 15 ============
  console.log('Seeding properties...');
  const existingPropertyCount = await prisma.property.count({ where: { tenantId: TENANT_ID } });
  const propertyData = [
    { title: '3BHK Sea-View Apartment, Marine Drive', type: 'APARTMENT', price: 15500000, bedrooms: 3, bathrooms: 3, area: 1850, location: 'Kochi', photos: PHOTOS.apartmentExterior },
    { title: 'Independent Villa, Sarjapur Road', type: 'VILLA', price: 32000000, bedrooms: 4, bathrooms: 5, area: 3200, location: 'Bangalore', photos: PHOTOS.villaExterior },
    { title: 'Studio Apartment, Koramangala', type: 'STUDIO', price: 3800000, bedrooms: 1, bathrooms: 1, area: 480, location: 'Bangalore', photos: PHOTOS.apartmentExterior },
    { title: 'Duplex Penthouse, Banjara Hills', type: 'DUPLEX', price: 48000000, bedrooms: 4, bathrooms: 4, area: 3600, location: 'Hyderabad', photos: PHOTOS.livingRoom },
    { title: 'Residential Plot, Devanahalli', type: 'PLOT', price: 6200000, bedrooms: null, bathrooms: null, area: 2400, location: 'Bangalore', photos: PHOTOS.houseExterior },
    { title: 'Retail Showroom, Jubilee Hills', type: 'COMMERCIAL', price: 22000000, bedrooms: null, bathrooms: 2, area: 1600, location: 'Hyderabad', photos: PHOTOS.officeCommercial },
    { title: '2BHK Apartment, Indiranagar', type: 'APARTMENT', price: 9800000, bedrooms: 2, bathrooms: 2, area: 1150, location: 'Bangalore', photos: PHOTOS.apartmentExterior },
    { title: 'Farmhouse Villa, Nandi Hills Road', type: 'VILLA', price: 41000000, bedrooms: 5, bathrooms: 5, area: 4800, location: 'Bangalore', photos: PHOTOS.villaExterior },
    { title: 'Corporate Office Floor, Cyber City', type: 'COMMERCIAL', price: 55000000, bedrooms: null, bathrooms: 4, area: 5200, location: 'Gurugram', photos: PHOTOS.officeCommercial },
  ];
  for (let i = 0; i < propertyData.length; i++) {
    if (existingPropertyCount + i >= 15) break;
    const p = propertyData[i];
    const property = await prisma.property.create({
      data: {
        tenantId: TENANT_ID, title: p.title, description: `${p.title} — a well-maintained property in a prime location with excellent connectivity and modern amenities.`,
        propertyType: p.type, status: pick(['AVAILABLE', 'AVAILABLE', 'AVAILABLE', 'UNDER_OFFER', 'SOLD']),
        price: p.price, currency: 'INR', bedrooms: p.bedrooms, bathrooms: p.bathrooms, areaSqft: p.area, location: p.location,
        address: `${p.location}, India`, features: ['Modular Kitchen', 'Power Backup', 'Covered Parking', 'Gated Community'],
        amenities: ['Gym', 'Swimming Pool', 'Security', 'Lift'], reraId: `PRM/${p.location.slice(0, 2).toUpperCase()}/RERA/${rnd(1000, 1999)}`,
        featured: i < 2,
      },
    });
    const chosenPhotos = [...p.photos].sort(() => Math.random() - 0.5).slice(0, 3);
    for (let idx = 0; idx < chosenPhotos.length; idx++) {
      await prisma.propertyImage.create({ data: { propertyId: property.id, url: img(chosenPhotos[idx]), isPrimary: idx === 0, orderIndex: idx, caption: idx === 0 ? 'Exterior view' : idx === 1 ? 'Living room' : 'Interior' } });
    }
  }
  const allProperties = await prisma.property.findMany({ where: { tenantId: TENANT_ID }, take: 15 });
  console.log(`  ${allProperties.length} properties total`);

  // ============ 4. CONTACTS + LEADS (Buyers/Pipeline) ============
  console.log('Seeding contacts and leads...');
  const buyerNames = [
    'Amit Trivedi', 'Neha Kapoor', 'Sanjay Gupta', 'Pooja Agarwal', 'Rahul Chawla', 'Kavya Krishnan', 'Manoj Tiwari', 'Shreya Bhatt',
    'Aditya Malhotra', 'Ritu Chopra', 'Vivek Anand', 'Nandini Rao', 'Siddharth Jain', 'Anjali Desai', 'Gaurav Khanna',
  ];
  const sources = ['MAGICBRICKS', 'HOUSING_COM', 'NINETY_NINE_ACRES', 'META_ADS', 'GOOGLE_ADS', 'REFERRAL', 'WHATSAPP', 'FORM', 'PHONE_CALL'];
  const leadStatuses = ['NEW', 'NEW', 'CONTACTED', 'CONTACTED', 'ENGAGED', 'QUALIFIED', 'APPOINTMENT_BOOKED', 'PROPOSAL_SENT', 'CONVERTED', 'CONVERTED', 'LOST', 'COLD'];
  const leads = [];
  for (let i = 0; i < buyerNames.length; i++) {
    const name = buyerNames[i];
    const emailSlug = name.toLowerCase().replace(/\s+/g, '.');
    const contact = await prisma.contact.create({
      data: {
        tenantId: TENANT_ID, name, email: `${emailSlug}@example.com`, phone: `+91${rnd(70000, 99999)}${rnd(10000, 99999)}`,
        whatsapp: `+91${rnd(70000, 99999)}${rnd(10000, 99999)}`, location: pick(['Bangalore', 'Hyderabad', 'Mumbai', 'Dubai', 'Chennai']),
        consentStatus: 'opted_in', consentSource: 'form',
      },
    });
    const lead = await prisma.lead.create({
      data: {
        tenantId: TENANT_ID, contactId: contact.id, source: pick(sources), status: pick(leadStatuses),
        segment: pick(['HOT', 'WARM', 'WARM', 'COLD']), score: rnd(20, 95), priority: rnd(1, 5),
        interest: pick(['3BHK Apartment', '4BHK Villa', 'Commercial Space', '2BHK Apartment', 'Plot']),
        budget: pick(['50L - 80L', '80L - 1.5Cr', '1.5Cr - 3Cr', '3Cr+', '30L - 50L']),
        dealValue: rnd(3500000, 45000000), urgency: pick(['Immediate', '1-3 months', '3-6 months']),
        assignedAgentId: pick(agents).id, createdAt: daysAgo(rnd(1, 90)),
      },
    });
    leads.push(lead);
  }
  console.log(`  ${leads.length} leads/contacts ready`);

  // ============ 5. SITE VISITS ============
  console.log('Seeding site visits...');
  const visitStatuses = ['SCHEDULED', 'CONFIRMED', 'COMPLETED', 'COMPLETED', 'NO_SHOW', 'RESCHEDULED'];
  for (let i = 0; i < 15; i++) {
    const lead = pick(leads);
    const project = pick(projects);
    await prisma.siteVisit.create({
      data: {
        tenantId: TENANT_ID, leadId: lead.id, projectId: project.id, unitId: pick(project.units)?.id,
        assignedAgentId: pick(agents).id, createdById: owner.id,
        startAt: daysFromNow(rnd(-20, 20)), status: pick(visitStatuses),
        meetingPoint: `${project.name} Sales Gallery`, attendeeCount: rnd(1, 4), language: pick(['English', 'Hindi', 'Kannada']),
      },
    });
  }

  // ============ 6. COST SHEETS ============
  console.log('Seeding cost sheets...');
  const costSheetStatuses = ['DRAFT', 'PENDING_APPROVAL', 'PENDING_APPROVAL', 'APPROVED', 'SENT'];
  for (let i = 0; i < 10; i++) {
    const lead = pick(leads);
    const project = pick(projects);
    const unit = pick(project.units);
    if (!unit) continue;
    const basePaise = BigInt(Math.round((unit.price || 8000000) * 100));
    const gstPaise = basePaise * 5n / 100n;
    const regPaise = basePaise * 1n / 100n;
    const cs = await prisma.costSheet.create({
      data: {
        tenantId: TENANT_ID, leadId: lead.id, unitId: unit.id, projectId: project.id,
        status: pick(costSheetStatuses), totalPaise: basePaise + gstPaise + regPaise,
        createdById: pick(agents).id, approvedById: Math.random() > 0.5 ? managers[0]?.id : undefined,
      },
    });
    await prisma.costSheetLineItem.createMany({
      data: [
        { costSheetId: cs.id, code: 'BASE', label: 'Base Sale Price', calculationType: 'FLAT', amountPaise: basePaise, taxable: true, displayOrder: 0 },
        { costSheetId: cs.id, code: 'GST', label: 'GST @5%', calculationType: 'PERCENT', amountPaise: gstPaise, taxable: false, displayOrder: 1 },
        { costSheetId: cs.id, code: 'REG', label: 'Registration & Stamp Duty', calculationType: 'PERCENT', amountPaise: regPaise, taxable: false, displayOrder: 2 },
      ],
    });
  }

  // ============ 7. CHANNEL PARTNERS (Agents) + PARTNER LEAD CLAIMS ============
  console.log('Seeding channel partners...');
  const partnerNames = [
    'Prestige Property Consultants', 'Golden Gate Realtors', 'Silver Oak Estates', 'Metro Homes Advisory', 'Skyline Property Brokers',
    'Elite Realty Partners', 'Urban Nest Consultants', 'Blue Sky Realtors', 'Green Valley Estates', 'Horizon Property Group',
    'Sunrise Realty Associates', 'Diamond Homes Consultancy', 'Pinnacle Property Solutions', 'Trust Realty Advisors', 'Landmark Estate Brokers',
  ];
  const onboardingStatuses = ['ACTIVE', 'ACTIVE', 'ACTIVE', 'TRAINING_PENDING', 'DOCS_PENDING', 'INVITED'];
  const partners = [];
  for (let i = 0; i < partnerNames.length; i++) {
    const name = partnerNames[i];
    const partner = await prisma.channelPartner.create({
      data: {
        tenantId: TENANT_ID, name, company: name, phone: `+91${rnd(70000, 99999)}${rnd(10000, 99999)}`,
        email: `${name.toLowerCase().replace(/\s+/g, '')}@partner.demo`,
        reraId: `AGT/KA/RERA/${rnd(10000, 99999)}`, reraExpiryAt: daysFromNow(rnd(100, 700)),
        onboardingStatus: pick(onboardingStatuses), commissionRate: rnd(1, 3) + Math.random(),
        status: 'ACTIVE', agreementSignedAt: daysAgo(rnd(30, 400)),
      },
    });
    partners.push(partner);
  }
  console.log(`  ${partners.length} channel partners ready`);

  console.log('Seeding partner lead claims...');
  const claimStatuses = ['REGISTERED', 'REGISTERED', 'NEEDS_REVIEW', 'ALREADY_REGISTERED', 'REJECTED'];
  for (let i = 0; i < 10; i++) {
    const partner = pick(partners);
    const lead = Math.random() > 0.3 ? pick(leads) : null;
    await prisma.partnerLeadClaim.create({
      data: {
        tenantId: TENANT_ID, channelPartnerId: partner.id, leadId: lead?.id,
        phone: `+91${rnd(70000, 99999)}${rnd(10000, 99999)}`, status: pick(claimStatuses),
        decidedById: Math.random() > 0.5 ? managers[0]?.id : undefined, decidedAt: Math.random() > 0.5 ? daysAgo(rnd(1, 20)) : undefined,
      },
    });
  }

  // ============ 8. KYC DOCUMENTS ============
  console.log('Seeding KYC documents...');
  const docTypes = ['PAN', 'AADHAAR_OFFLINE_XML', 'ADDRESS_PROOF', 'SALARY_PROOF', 'BANK_STATEMENT'];
  const docStatuses = ['VERIFIED', 'VERIFIED', 'UPLOADED', 'REQUESTED', 'REJECTED', 'NOT_REQUESTED'];
  for (let i = 0; i < 15; i++) {
    const lead = pick(leads);
    await prisma.buyerDocument.create({
      data: {
        tenantId: TENANT_ID, leadId: lead.id, type: pick(docTypes), status: pick(docStatuses),
        source: pick(['buyer_upload', 'staff_upload', 'digilocker']), requestedById: pick(agents).id,
      },
    });
  }

  // ============ 9. QUOTATIONS ============
  console.log('Seeding quotations...');
  const quotationStatuses = ['DRAFT', 'SENT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'];
  const quotations = [];
  for (let i = 0; i < 15; i++) {
    const lead = pick(leads);
    const property = Math.random() > 0.5 ? pick(allProperties) : null;
    const project = !property ? pick(projects) : null;
    const unitPrice = rnd(4500000, 45000000);
    const genNum = () => `Q-${Date.now().toString(36).toUpperCase()}-${i}`;
    const quotation = await prisma.quotation.create({
      data: {
        tenantId: TENANT_ID, contactId: lead.contactId, propertyId: property?.id, projectId: project?.id,
        quoteNumber: genNum(), validUntil: daysFromNow(rnd(7, 30)), status: pick(quotationStatuses),
        termsAndPaymentSchedule: '10% booking, 40% on agreement, 40% on construction-linked demand, 10% on possession',
        sections: {
          create: [{
            title: 'Unit Cost Breakdown', order: 0,
            lineItems: { create: [
              { description: 'Base Sale Price', qty: 1, unitPrice, total: unitPrice },
              { description: 'GST @ 5%', qty: 1, unitPrice: Math.round(unitPrice * 0.05), total: Math.round(unitPrice * 0.05) },
              { description: 'Registration & Legal Charges', qty: 1, unitPrice: Math.round(unitPrice * 0.01), total: Math.round(unitPrice * 0.01) },
            ] },
          }],
        },
      },
    });
    quotations.push(quotation);
  }

  // ============ 10. CONTRACTS (Sale Agreements) ============
  console.log('Seeding contracts...');
  const contractStatuses = ['DRAFT', 'SENT', 'SIGNED', 'SIGNED', 'CANCELLED'];
  for (let i = 0; i < 12; i++) {
    const quotation = quotations[i % quotations.length];
    const genNum = () => `C-${Date.now().toString(36).toUpperCase()}-${i}`;
    const status = pick(contractStatuses);
    await prisma.contract.create({
      data: {
        tenantId: TENANT_ID, quotationId: quotation.id, contactId: quotation.contactId,
        contractNumber: genNum(), amount: rnd(4500000, 45000000), status,
        signedAt: status === 'SIGNED' ? daysAgo(rnd(1, 60)) : undefined,
        acceptedAt: status === 'SIGNED' || status === 'SENT' ? daysAgo(rnd(1, 70)) : undefined,
      },
    });
  }

  // ============ 11. INVOICES ============
  console.log('Seeding invoices...');
  const invoiceStatuses = ['DRAFT', 'SENT', 'SENT', 'PAID', 'PAID', 'OVERDUE', 'PENDING'];
  for (let i = 0; i < 15; i++) {
    const lead = pick(leads);
    const property = Math.random() > 0.5 ? pick(allProperties) : null;
    const project = !property ? pick(projects) : null;
    const unitPrice = rnd(200000, 5000000);
    const gstPercent = pick([1, 5]);
    const subtotal = unitPrice;
    const gstTotal = Math.round(subtotal * gstPercent / 100);
    const genNum = () => `INV-${Date.now().toString(36).toUpperCase()}-${i}`;
    const status = pick(invoiceStatuses);
    await prisma.invoice.create({
      data: {
        tenantId: TENANT_ID, contactId: lead.contactId, propertyId: property?.id, projectId: project?.id,
        invoiceNumber: genNum(), dueDate: daysFromNow(rnd(-10, 30)), status,
        subtotal, gstPercent, gstTotal, grandTotal: subtotal + gstTotal,
        paidAt: status === 'PAID' ? daysAgo(rnd(1, 30)) : undefined,
        lineItems: { create: [{ description: pick(['Booking Amount', 'Registration Charges', 'Club Membership Fee', 'Maintenance Deposit', 'Legal & Documentation Fee']), qty: 1, unitPrice, total: unitPrice, gstPercent }] },
      },
    });
  }

  // ============ 12. PAYMENT SCHEDULES (Payments & Collections) ============
  console.log('Seeding payment schedules...');
  const milestoneLabels = ['Booking Amount', 'Agreement Amount', 'Foundation Complete', 'Slab Complete', 'Possession'];
  const scheduleStatuses = ['PENDING', 'PENDING', 'PAID', 'PAID', 'OVERDUE'];
  for (let i = 0; i < 15; i++) {
    const lead = pick(leads);
    await prisma.paymentSchedule.create({
      data: {
        tenantId: TENANT_ID, leadId: lead.id, label: pick(milestoneLabels), amount: rnd(200000, 8000000),
        currency: 'INR', dueDate: daysFromNow(rnd(-30, 60)), status: pick(scheduleStatuses),
      },
    });
  }

  // ============ 13. PAYMENT RECEIPTS (Collections Ledger) ============
  console.log('Seeding payment receipts...');
  const modes = ['UPI', 'NEFT', 'CHEQUE', 'CARD', 'GATEWAY'];
  const receiptStatuses = ['CONFIRMED', 'CONFIRMED', 'CONFIRMED', 'PENDING_RECONCILIATION', 'REVERSED'];
  for (let i = 0; i < 15; i++) {
    const lead = pick(leads);
    const status = pick(receiptStatuses);
    await prisma.paymentReceipt.create({
      data: {
        tenantId: TENANT_ID, leadId: lead.id, amountPaise: BigInt(rnd(200000, 8000000) * 100), mode: pick(modes),
        status, receivedAt: daysAgo(rnd(1, 90)),
        confirmedAt: status === 'CONFIRMED' ? daysAgo(rnd(0, 60)) : undefined,
        externalRef: `TXN${rnd(100000, 999999)}`,
      },
    });
  }

  // ============ 14. TRANSACTIONS (My Expenses + general finance) ============
  console.log('Seeding transactions...');
  const expenseCategories = ['Marketing & Ads', 'Travel & Transport', 'Brokerage Commission', 'Office Expenses', 'Site Visit Costs', 'Legal & Stamp Duty', 'Printing & Stationery', 'Miscellaneous'];
  for (let i = 0; i < 15; i++) {
    await prisma.transaction.create({
      data: {
        tenantId: TENANT_ID, description: `${pick(expenseCategories)} — ${pick(projects).name}`, type: 'EXPENSE',
        amount: rnd(2000, 150000), category: pick(expenseCategories), date: daysAgo(rnd(1, 60)),
        status: pick(['PAID', 'PAID', 'PENDING']), partyType: pick(['VENDOR', 'INTERNAL']),
      },
    });
  }
  for (let i = 0; i < 5; i++) {
    await prisma.transaction.create({
      data: {
        tenantId: TENANT_ID, description: `Brokerage income — ${pick(partners).name}`, type: 'INCOME',
        amount: rnd(50000, 800000), category: 'Brokerage Commission', date: daysAgo(rnd(1, 60)), status: 'RECEIVED', partyType: 'CUSTOMER',
      },
    });
  }

  console.log('\nDone. Summary:');
  const counts = await Promise.all([
    prisma.user.count({ where: { tenantId: TENANT_ID } }),
    prisma.contact.count({ where: { tenantId: TENANT_ID } }),
    prisma.lead.count({ where: { tenantId: TENANT_ID } }),
    prisma.property.count({ where: { tenantId: TENANT_ID } }),
    prisma.project.count({ where: { tenantId: TENANT_ID } }),
    prisma.siteVisit.count({ where: { tenantId: TENANT_ID } }),
    prisma.costSheet.count({ where: { tenantId: TENANT_ID } }),
    prisma.channelPartner.count({ where: { tenantId: TENANT_ID } }),
    prisma.partnerLeadClaim.count({ where: { tenantId: TENANT_ID } }),
    prisma.buyerDocument.count({ where: { tenantId: TENANT_ID } }),
    prisma.quotation.count({ where: { tenantId: TENANT_ID } }),
    prisma.contract.count({ where: { tenantId: TENANT_ID } }),
    prisma.invoice.count({ where: { tenantId: TENANT_ID } }),
    prisma.paymentSchedule.count({ where: { tenantId: TENANT_ID } }),
    prisma.paymentReceipt.count({ where: { tenantId: TENANT_ID } }),
    prisma.transaction.count({ where: { tenantId: TENANT_ID } }),
    prisma.leaveRequest.count({ where: { tenantId: TENANT_ID } }),
    prisma.salaryRecord.count({ where: { tenantId: TENANT_ID } }),
    prisma.salesTarget.count({ where: { tenantId: TENANT_ID } }),
  ]);
  const labels = ['users', 'contacts', 'leads', 'properties', 'projects', 'siteVisits', 'costSheets', 'channelPartners', 'partnerLeadClaims', 'buyerDocuments', 'quotations', 'contracts', 'invoices', 'paymentSchedules', 'paymentReceipts', 'transactions', 'leaveRequests', 'salaryRecords', 'salesTargets'];
  labels.forEach((l, i) => console.log(`  ${l}: ${counts[i]}`));
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
