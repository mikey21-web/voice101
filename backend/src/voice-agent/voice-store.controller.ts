import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

/** Pre-built AI employees you can hire from the marketplace (Outpero's Store/Hire, ₹1,899/month
 * includes 500 credits, active 30 days). Hiring applies the same VoiceEmployee create path the
 * hire wizard uses — this catalog just seeds the "browse before you build" surface. */
const CATALOG: any[] = [
  { key: 'clinic_receptionist', name: 'Swathi', role: 'Clinic Receptionist', business: 'Hospital & clinic', hirePrice: 1899, tone: 'Polite, appointment-first', tags: ['clinic', 'appointments'], description: 'Books and confirms appointments, handles cancellations politely, sends reminders.', languages: ['te-IN', 'en-IN', 'hi-IN'], voice: 'Inworld · comfy-zebra-1301__sowmya' },
  { key: 'tuition_coordinator', name: 'Ravi', role: 'Tuition Coordinator', business: 'Coaching & tuition', hirePrice: 1899, tone: 'Friendly, class-focused', tags: ['tuition', 'enrolment'], description: 'Answers batch/class enquiries, collects student details, drives enrolment calls.', languages: ['te-IN', 'en-IN', 'hi-IN'], voice: 'Inworld · comfy-zebra-1301__varaprasad' },
  { key: 'dealership_followup', name: 'Anitha', role: 'Dealership Follow-up', business: 'Car & bike dealership', hirePrice: 1899, tone: 'Enthusiastic, offer-aware', tags: ['dealership', 'sales'], description: 'Follows up on test-drive leads, quotes current offers (team-confirmed), books visits.', languages: ['en-IN', 'hi-IN', 'te-IN'], voice: 'Inworld · comfy-zebra-1301__tejaswi-main' },
  { key: 'jewellery_consultant', name: 'Meena', role: 'Jewellery Consultant', business: 'Jewellery', hirePrice: 1899, tone: 'Warm, occasion-driven', tags: ['jewellery', 'appointments'], description: 'Handles design/enquiry calls, collects preferences, schedules showroom visits.', languages: ['te-IN', 'en-IN'], voice: 'Inworld · comfy-zebra-1301__sowmya' },
  { key: 'service_call_scheduler', name: 'Karthik', role: 'Service Call Scheduler', business: 'Local services', hirePrice: 1899, tone: 'Reliable, slot-driven', tags: ['services', 'bookings'], description: 'Books service slots, confirms addresses, sets reminders for technicians.', languages: ['en-IN', 'te-IN', 'hi-IN'], voice: 'Inworld · comfy-zebra-1301__nagendra' },
];

@Controller('voice-store')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VoiceStoreController {
  @Get('catalog')
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  catalog() {
    return CATALOG;
  }
}
