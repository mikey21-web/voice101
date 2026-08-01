export interface SchedulerFinding {
  type: 'stale_hot_leads' | 'stale_new_leads' | 'conversion_anomaly' | 'overdue_tasks' | 'lead_source_shift' | 'unassigned_hot_leads' | 'staff_performance_update' | 'proactive_tasks_generated' | 'missed_call' | 'portal_lead_failure' | 'weak_salesperson' | 'source_drop' | 'auto_follow_up' | 'auto_follow_ups_executed' | 'first_contact_sla_breach' | 'stalled_money_trail' | 'pending_possession' | 'open_complaints';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  count: number;
  metadata: any;
}
