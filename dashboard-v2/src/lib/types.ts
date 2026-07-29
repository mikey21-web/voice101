export type LeadStatus = 'NEW' | 'CONTACTED' | 'ENGAGED' | 'QUALIFYING' | 'QUALIFIED' | 'PROPOSAL_SENT' | 'APPOINTMENT_BOOKED' | 'CONVERTED' | 'LOST' | 'COLD' | 'SPAM';
export type LeadSegment = 'HOT' | 'WARM' | 'COLD' | 'UNQUALIFIED' | 'EXISTING_CUSTOMER' | 'RECONNECT';
export type LeadSource = 'CAMPAIGN' | 'QR_CODE' | 'FORM' | 'CHATBOT' | 'MOBILE_APP' | 'WHATSAPP' | 'SOCIAL_MEDIA' | 'PHONE_CALL'
  | 'INDIAMART' | 'NINETY_NINE_ACRES' | 'JUSTDIAL' | 'MAGICBRICKS' | 'HOUSING_COM' | 'TRADEINDIA';

export interface Lead {
  id: string;
  status: LeadStatus;
  segment: LeadSegment;
  source: LeadSource;
  score: number;
  priority: number;
  interest?: string;
  budget?: string;
  dealValue?: number | null;
  urgency?: string;
  message?: string;
  tags: string[];
  metadata?: Record<string, unknown>;
  campaignId?: string;
  assignedAgentId?: string;
  tenantId?: string;
  createdAt: string;
  updatedAt: string;
  contact: Contact;
  assignedAgent?: { id: string; name: string; email: string };
  campaign?: { id: string; name: string };
  conversations?: any[];
  conversions?: any[];
  tasks?: any[];
  _count?: { conversations: number; conversions: number; tasks: number };
}

export interface Contact {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  company?: string;
  location?: string;
  metadata?: Record<string, unknown>;
  tags: string[];
  createdAt: string;
  _count?: { leads: number };
}

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  sourceType: string;
  campaignType?: string;
  offer?: string;
  active: boolean;
  status?: 'draft' | 'active' | 'paused' | 'completed' | 'archived';
  priority?: 'low' | 'medium' | 'high';
  channels?: string[];
  totalBudget?: number;
  dailyBudget?: number;
  currency?: string;
  spent?: number;
  leadCount?: number;
  conversionRate?: number;
  propertyTypes?: string[];
  locations?: string[];
  buyerType?: string;
  startDate?: string;
  endDate?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  creatives?: any[];
  _count?: { leads: number };
  createdAt: string;
  updatedAt?: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  dueAt?: string;
  leadId?: string;
  assigneeId?: string;
  lead?: { contact?: { name?: string; phone?: string }; dealValue?: number; status?: string; interest?: string };
  assignee?: { id: string; name: string };
  createdBy?: string;
  source?: string;
  createdAt: string;
}

export interface Message {
  id: string;
  text?: string;
  body?: string;
  channel: string;
  direction: string;
  leadId: string;
  contactId?: string;
  createdAt: string;
  lead?: { id: string; status: string; contact?: { id: string; name?: string; phone?: string } };
}

export interface Template {
  id: string;
  name: string;
  type: string;
  channel: string;
  body: string;
  variables: string[];
  version: number;
  active: boolean;
}

export interface Integration {
  id: string;
  name: string;
  type: string;
  status: string;
  config?: Record<string, unknown>;
  lastTested?: string;
}

export interface BookingSetting {
  id: string;
  name: string;
  provider: string;
  config?: Record<string, unknown>;
  active: boolean;
}

export interface CrmMapping {
  id: string;
  name: string;
  crmType: string;
  fieldMappings?: Record<string, unknown>;
  active: boolean;
}

export interface ScoringRule {
  id: string;
  name: string;
  field: string;
  operator: string;
  value: string;
  points: number;
  active: boolean;
}

export interface RoutingRule {
  id: string;
  name: string;
  conditions: Record<string, unknown>;
  action: Record<string, unknown>;
  active: boolean;
}

export interface AutomationRule {
  id: string;
  name: string;
  category: string;
  eventType?: string;
  priority: number;
  conditions: any[];
  actions: any[];
  active: boolean;
}

export interface PipelineStage {
  id: string;
  name: string;
  order: number;
  color: string;
  isDefault: boolean;
  isEnd: boolean;
}

export interface FailureRecord {
  id: string;
  type: string;
  status: string;
  severity: string;
  message: string;
  leadId?: string;
  provider?: string;
  operation?: string;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  createdAt: string;
}

export interface HealthReport {
  status: string;
  timestamp: string;
  version: string;
  uptime: number;
  dependencies: Record<string, { status: string; latencyMs?: number; detail?: string }>;
}

export interface AnalyticsOverview {
  total: number;
  hot: number;
  warm: number;
  cold: number;
  converted: number;
  lost: number;
  conversionRate: string;
}

export interface AICampaignDraft {
  id: string;
  prompt: string;
  preview: {
    name: string;
    segment: { filters: Array<{ field: string; operator: string; value: string }>; estimatedLeads: number };
    channels: string[];
    message: string;
    schedule: { start: string; end: string; timezone: string };
    budget: number;
    predictedROI: string;
  };
  status: 'draft' | 'launched';
  createdAt: string;
}

export interface AIAgentStatus {
  online: boolean;
  model: string;
  apiKeyConfigured: boolean;
  tone: { style: string; businessName: string; industry: string; customPrompt?: string };
  qualificationQuestions: string[];
  stats: { conversationsHandled: number; leadsQualified: number; appointmentsBooked: number };
}

export interface WebhookEndpoint {
  type: string;
  url: string;
  label: string;
  description: string;
  auth: string;
  status: 'configured' | 'available' | 'error' | 'active';
  lastReceived: string | null;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  trigger?: any;
  active: boolean;
  version: number;
  steps?: any[];
  edges?: any[];
  _count?: { steps: number };
  createdAt: string;
  updatedAt: string;
}

export type NavigationPage = 
  | 'Overview' | 'Leads' | 'Contacts' | 'Campaigns' | 'Forms' | 'QR Codes'
  | 'Messages' | 'Templates' | 'Media' | 'Scoring' | 'Routing'
  | 'Tasks' | 'Conversions' | 'Integrations' | 'CRM' | 'Booking' | 'Analytics'
  | 'Team' | 'Audit Logs' | 'Advanced' | 'Settings' | 'Workspace'
  | 'Failures' | 'Health' | 'AICampaigns' | 'AIAgent' | 'Webhooks' | 'SMS';
