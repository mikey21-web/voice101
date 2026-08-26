import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { VoiceEmployeeService } from './voice-employee.service';
import { TalkToBuildService, DraftAgent } from './talk-to-build.service';

interface CatalogItem {
  key: string; name: string; role: string; business: string; hirePrice: number; tone: string;
  tags: string[]; description: string; languages: string[]; voice: string;
  greeting: string; sections: Array<{ key: string; heading: string; prompt: string; edges: Array<{ to_key: string; condition: string }> }>;
  variables: Array<{ key: string; label: string; source: 'pre' | 'capture'; extract_hint?: string }>;
}

/** Pre-built AI employees you can hire from the marketplace (Outpero's Store/Hire, ₹1,899/month
 * includes 500 credits, active 30 days). Each template carries a ready-made section graph so a
 * hire creates a working, publishable employee immediately — no AI round-trip needed. */
const CATALOG: CatalogItem[] = [
  {
    key: 'real_estate_qualifier', name: 'Lakshmi Devi', role: 'Real Estate Qualifier', business: 'Real estate', hirePrice: 1899,
    tone: 'Warm, enquiry-first', tags: ['real-estate', 'qualification'],
    description: 'Calls new project enquiries, qualifies budget/location/timeline, books site visits.',
    languages: ['te-IN', 'en-IN', 'hi-IN'], voice: 'Inworld · comfy-zebra-1301__sowmya',
    greeting: 'హలో అండి, నేను లక్ష్మీ దేవి, మా ప్రాజెక్ట్ గురించి మీ enquiry చూసాను. కొన్ని వివరాలు తెలుసుకోవచ్చా?',
    sections: [
      { key: 'intent', heading: 'Own use or investment', prompt: "Ask whether they're looking for the property for own use or investment — one question only. For example you might say: 'మీరు investment కోసం చూస్తున్నారా, లేక own use కోసం?'", edges: [{ to_key: 'qualify', condition: 'once they state their intent' }] },
      { key: 'qualify', heading: 'Qualify requirements', prompt: 'Ask budget range, preferred area and timeline, one question per turn. Note answers without reading them back. Never quote a price — say the team will confirm.', edges: [{ to_key: 'site_visit', condition: 'if they are interested in a visit' }, { to_key: 'close', condition: 'if they are just exploring or not interested in a visit' }] },
      { key: 'site_visit', heading: 'Book a site visit', prompt: 'Confirm a date and time for the site visit. Read back date and time to confirm. End warmly with the next step.', edges: [] },
      { key: 'close', heading: 'Close warmly', prompt: 'Summarise what happens next, offer to send details on WhatsApp, then say goodbye.', edges: [] },
    ],
    variables: [
      { key: 'lead_name', label: 'Lead name', source: 'pre' },
      { key: 'intent', label: 'Own use or investment', source: 'capture', extract_hint: 'whether they want the property for own use or investment' },
      { key: 'budget_range', label: 'Budget range', source: 'capture', extract_hint: 'the budget they mentioned in words' },
      { key: 'preferred_area', label: 'Preferred area', source: 'capture', extract_hint: 'area or locality they prefer' },
      { key: 'timeline', label: 'Timeline', source: 'capture', extract_hint: 'how soon they want to move or buy' },
      { key: 'wants_site_visit', label: 'Wants site visit', source: 'capture', extract_hint: 'whether they agreed to a site visit' },
    ],
  },
  {
    key: 'clinic_receptionist', name: 'Swathi', role: 'Clinic Receptionist', business: 'Hospital & clinic', hirePrice: 1899,
    tone: 'Polite, appointment-first', tags: ['clinic', 'appointments'],
    description: 'Books and confirms appointments, handles cancellations politely, sends reminders.',
    languages: ['te-IN', 'en-IN', 'hi-IN'], voice: 'Inworld · comfy-zebra-1301__sowmya',
    greeting: 'హలో అండి, నేను స్వాతి, స్మైల్ కేర్ డెంటల్ నుండి. మీ appointment గురించి మాట్లాడుతున్నాను.',
    sections: [
      { key: 'orient', heading: 'Orientation', prompt: "Confirm you're Swathi from the clinic and the caller is who they say they are. Ask the reason for the call — new booking, existing appointment, or reminder.", edges: [{ to_key: 'book', condition: 'if they want to book' }, { to_key: 'confirm', condition: 'if it is about an existing appointment' }] },
      { key: 'book', heading: 'Book appointment', prompt: 'Ask for preferred date and time, one question per turn. Ask which service or doctor if relevant. Read back the chosen slot to confirm.', edges: [{ to_key: 'close', condition: 'once the slot is confirmed' }] },
      { key: 'confirm', heading: 'Confirm / reschedule / cancel', prompt: 'If they can make it, confirm warmly. If they want to change, offer available times. If cancelling, accept politely.', edges: [{ to_key: 'close', condition: 'once resolved' }] },
      { key: 'close', heading: 'Close & next steps', prompt: 'Confirm the appointment details, offer a reminder on WhatsApp, then say goodbye.', edges: [] },
    ],
    variables: [
      { key: 'lead_name', label: 'Patient name', source: 'pre' },
      { key: 'reason', label: 'Call reason', source: 'capture', extract_hint: 'book, confirm, reschedule, cancel or reminder' },
      { key: 'appointment_date', label: 'Appointment date', source: 'capture', extract_hint: 'the date they choose' },
      { key: 'appointment_time', label: 'Appointment time', source: 'capture', extract_hint: 'the time they choose' },
    ],
  },
  {
    key: 'tuition_coordinator', name: 'Ravi', role: 'Tuition Coordinator', business: 'Coaching & tuition', hirePrice: 1899,
    tone: 'Friendly, class-focused', tags: ['tuition', 'enrolment'],
    description: 'Answers batch/class enquiries, collects student details, drives enrolment calls.',
    languages: ['te-IN', 'en-IN', 'hi-IN'], voice: 'Inworld · comfy-zebra-1301__varaprasad',
    greeting: 'నమస్కారం! నేను రవి, మా tuition center నుండి మాట్లాడుతున్నాను. మీ enquiry గురించి కొంచెం చెప్తారా?',
    sections: [
      { key: 'context', heading: 'Student context', prompt: 'Ask which class and board the student is in, one question per turn. Note the answers.', edges: [{ to_key: 'offer', condition: 'once class and board are known' }] },
      { key: 'offer', heading: 'Share batches', prompt: 'Mention the relevant batch timings and how enrolment works. Never quote exact fees unless told — say the team will confirm.', edges: [{ to_key: 'enroll', condition: 'if they want to enrol' }, { to_key: 'close', condition: 'if they are just exploring' }] },
      { key: 'enroll', heading: 'Enrol', prompt: 'Collect student name, class, and a good time for a follow-up. Confirm the next step.', edges: [] },
      { key: 'close', heading: 'Close', prompt: 'Summarise the next step and say goodbye warmly.', edges: [] },
    ],
    variables: [
      { key: 'student_name', label: 'Student name', source: 'capture', extract_hint: 'the student full name' },
      { key: 'class', label: 'Class', source: 'capture', extract_hint: 'class or grade of the student' },
      { key: 'board', label: 'Board', source: 'capture', extract_hint: 'CBSE, ICSE, state board etc.' },
    ],
  },
  {
    key: 'dealership_followup', name: 'Anitha', role: 'Dealership Follow-up', business: 'Car & bike dealership', hirePrice: 1899,
    tone: 'Enthusiastic, offer-aware', tags: ['dealership', 'sales'],
    description: 'Follows up on test-drive leads, quotes current offers (team-confirmed), books visits.',
    languages: ['en-IN', 'hi-IN', 'te-IN'], voice: 'Inworld · comfy-zebra-1301__tejaswi-main',
    greeting: "Hi! This is Anitha from the dealership. You'd asked about a test drive — is this a good time to talk?",
    sections: [
      { key: 'interest', heading: 'Confirm interest', prompt: 'Confirm they are still interested and which model they asked about.', edges: [{ to_key: 'test_drive', condition: 'if they want to book a test drive' }, { to_key: 'offer', condition: 'if they ask about offers or prices' }] },
      { key: 'offer', heading: 'Share offer shape', prompt: "Give the shape of current offers (down payment, exchange bonus) without quoting a firm price — the team will confirm exact numbers.", edges: [{ to_key: 'test_drive', condition: 'once they want to proceed' }] },
      { key: 'test_drive', heading: 'Book test drive', prompt: 'Confirm date and time for the test drive. Read back the slot.', edges: [] },
    ],
    variables: [
      { key: 'model', label: 'Model', source: 'capture', extract_hint: 'the model they are interested in' },
      { key: 'test_drive_date', label: 'Test drive date', source: 'capture', extract_hint: 'the chosen date' },
    ],
  },
  {
    key: 'jewellery_consultant', name: 'Meena', role: 'Jewellery Consultant', business: 'Jewellery', hirePrice: 1899,
    tone: 'Warm, occasion-driven', tags: ['jewellery', 'appointments'],
    description: 'Handles design/enquiry calls, collects preferences, schedules showroom visits.',
    languages: ['te-IN', 'en-IN'], voice: 'Inworld · comfy-zebra-1301__sowmya',
    greeting: 'హలో అండి, నేను మీనా, మా jewellery showroom నుండి. ఏ occasion కోసం చూస్తున్నారు?',
    sections: [
      { key: 'occasion', heading: 'Understand occasion', prompt: 'Ask which occasion (wedding, gift, personal) and what they have in mind — gold, diamonds, or custom design.', edges: [{ to_key: 'preferences', condition: 'once the occasion is clear' }] },
      { key: 'preferences', heading: 'Preferences', prompt: 'Ask budget range and preferred design style, one question per turn. Never quote prices — the team will confirm.', edges: [{ to_key: 'visit', condition: 'if they want to visit the showroom' }, { to_key: 'close', condition: 'if not' }] },
      { key: 'visit', heading: 'Schedule visit', prompt: 'Confirm a showroom visit date and time. Read it back.', edges: [] },
      { key: 'close', heading: 'Close', prompt: 'Summarise and say goodbye warmly.', edges: [] },
    ],
    variables: [
      { key: 'occasion', label: 'Occasion', source: 'capture', extract_hint: 'wedding, gift or personal' },
      { key: 'item_type', label: 'Item type', source: 'capture', extract_hint: 'gold, diamond, custom design' },
      { key: 'budget_range', label: 'Budget range', source: 'capture', extract_hint: 'budget in words' },
    ],
  },
  {
    key: 'service_call_scheduler', name: 'Karthik', role: 'Service Call Scheduler', business: 'Local services', hirePrice: 1899,
    tone: 'Reliable, slot-driven', tags: ['services', 'bookings'],
    description: 'Books service slots, confirms addresses, sets reminders for technicians.',
    languages: ['en-IN', 'te-IN', 'hi-IN'], voice: 'Inworld · comfy-zebra-1301__nagendra',
    greeting: "Hello! This is Karthik from the service team. We got your service request — shall we book a convenient slot?",
    sections: [
      { key: 'service', heading: 'Confirm service', prompt: 'Confirm which service they need and the address for the visit.', edges: [{ to_key: 'slot', condition: 'once service and address are confirmed' }] },
      { key: 'slot', heading: 'Pick a slot', prompt: 'Offer the next available slots and confirm one. Read back the date and time.', edges: [{ to_key: 'close', condition: 'once booked' }] },
      { key: 'close', heading: 'Close', prompt: 'Confirm the booking, mention a reminder, and say goodbye.', edges: [] },
    ],
    variables: [
      { key: 'service', label: 'Service', source: 'capture', extract_hint: 'the service requested' },
      { key: 'address', label: 'Address', source: 'capture', extract_hint: 'the service address' },
      { key: 'slot_date', label: 'Slot date', source: 'capture', extract_hint: 'the chosen date' },
    ],
  },
];

@Controller('voice-store')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VoiceStoreController {
  constructor(
    private employees: VoiceEmployeeService,
    private talkToBuild: TalkToBuildService,
  ) {}

  @Get('catalog')
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  catalog() {
    return CATALOG.map(({ greeting, sections, variables, ...meta }) => meta);
  }

  @Post('hire')
  @Roles('OWNER', 'ADMIN')
  async hire(@Req() req: any, @Body() body: { key: string; language?: string }) {
    const item = CATALOG.find((c) => c.key === body.key);
    if (!item) throw new Error('Catalog item not found');
    const language = body.language || 'te-IN';

    const draft: DraftAgent = {
      name: item.name,
      gender: /Devi|Swathi|Anitha|Meena/.test(item.name) ? 'female' : 'male',
      role: item.role,
      welcome_message: item.greeting,
      agent_information: `You are ${item.name}, ${item.role} for a ${item.business.toLowerCase()} business. ${item.tone}. ${item.description}`,
      call_end_rules: 'End the call politely once the conversation is complete and a next step is captured.',
      sections: item.sections.map((s) => ({ key: s.key, heading: s.heading, node_type: 'llm', prompt: s.prompt, edges: s.edges })),
      variables: item.variables,
    };

    const employee = await this.talkToBuild.createEmployeeFromDraft(req.user.tenantId, draft, {
      channel: 'instant',
      language,
      businessName: item.business,
    });
    return employee;
  }
}
