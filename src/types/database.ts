export type PreferredContactMethod = "phone" | "whatsapp" | "email" | "sms";
export type BroadcastStatus =
  | "draft"
  | "queued"
  | "broadcast ready"
  | "broadcasting"
  | "awaiting response"
  | "completed"
  | "failed"
  | "cancelled";
export type PaymentStatus =
  | "pending"
  | "part_paid"
  | "paid"
  | "overdue"
  | "written_off";
export type JobStatus =
  | "draft"
  | "open"
  | "broadcasting"
  | "partially_filled"
  | "filled"
  | "in_progress"
  | "completed"
  | "cancelled";
export type WorkerStatus = "active" | "inactive" | "suspended" | "archived";
export type PriorityTier = "standard" | "preferred" | "vip" | "restricted";
export type ResponseChannel = "whatsapp" | "sms" | "ivr" | "email" | "manual";
export type ResponseType =
  | "accepted"
  | "declined"
  | "callback"
  | "no_response"
  | "expired";
export type BookingStatus =
  | "pending"
  | "confirmed"
  | "reserve"
  | "checked_in"
  | "checked_out"
  | "completed"
  | "cancelled"
  | "no_show";

export interface JobProvider {
  provider_id: string;
  company_name: string;
  trading_name: string | null;
  contact_name: string;
  contact_role: string | null;
  company_type: string | null;
  industry: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  office_address: string | null;
  site_address: string | null;
  preferred_contact_method: PreferredContactMethod | null;
  charge_rate_agreement: number | null;
  payment_terms: string | null;
  deposit_required: boolean;
  credit_limit: number;
  payment_tier: string | null;
  risk_rating: string | null;
  client_contract_signed: boolean;
  contract_signed_date: string | null;
  non_circumvention: boolean;
  personal_guarantee: boolean;
  escrow_required: boolean;
  first_job_date: string | null;
  last_job_date: string | null;
  total_jobs: number;
  total_revenue: number;
  reliability_score: number;
  created_at: string;
  updated_at: string;
}

export interface Job {
  job_id: string;
  provider_id: string;
  job_title: string;
  job_category: string | null;
  trade_type: string | null;
  job_type: string | null;
  site_name: string | null;
  site_contact: string | null;
  site_phone: string | null;
  address: string;
  postcode: string;
  area: string | null;
  travel_radius: number | null;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  workers_required: number;
  workers_confirmed: number;
  skill_tags: string[];
  certificates_required: string[];
  dbs_required: boolean;
  worker_type: string | null;
  pay_rate: number;
  charge_rate: number;
  margin: number;
  broadcast_status: BroadcastStatus;
  broadcast_time: string | null;
  deposit_received: boolean;
  escrow_in_place: boolean;
  invoice_sent: boolean;
  payment_status: PaymentStatus;
  job_status: JobStatus;
  created_at: string;
  updated_at: string;
}

export interface StaffSub {
  worker_id: string;
  full_name: string;
  mobile: string;
  whatsapp: string | null;
  email: string | null;
  postcode: string;
  town: string | null;
  worker_type: string | null;
  status: WorkerStatus;
  available_today: boolean;
  travel_radius: number;
  primary_role: string | null;
  skill_tags: string[];
  experience_years: number;
  right_to_work: boolean;
  dbs_status: string | null;
  cscs_status: string | null;
  contract_signed: boolean;
  min_day_rate: number;
  expected_rate: number;
  reliability_score: number;
  no_show_count: number;
  cancellation_count: number;
  priority_tier: PriorityTier;
  whatsapp_opt_in: boolean;
  created_at: string;
  updated_at: string;
}

export interface ResponseLog {
  response_id: string;
  job_id: string;
  worker_id: string;
  sent_time: string;
  channel: ResponseChannel;
  delivered: boolean;
  read: boolean;
  response_type: ResponseType | null;
  response_time: string | null;
  response_rank: number | null;
  selected: boolean;
  reserve: boolean;
  created_at: string;
}

export interface Booking {
  booking_id: string;
  job_id: string;
  worker_id: string;
  booking_status: BookingStatus;
  confirmed_time: string | null;
  check_in: string | null;
  check_out: string | null;
  timesheet_received: boolean;
  worker_paid: boolean;
  client_paid: boolean;
  created_at: string;
}

export interface ComplianceLegal {
  id: string;
  provider_id: string | null;
  worker_id: string | null;
  contract_signed: boolean;
  non_circumvention: boolean;
  right_to_work_file: string | null;
  dbs_file: string | null;
  insurance_file: string | null;
  expiry_date: string | null;
  created_at: string;
  updated_at: string;
}

export type InsertJobProvider = Omit<
  JobProvider,
  "provider_id" | "created_at" | "updated_at" | "first_job_date" | "last_job_date" | "total_jobs" | "total_revenue"
>;

export type InsertJob = Omit<
  Job,
  "job_id" | "workers_confirmed" | "margin" | "created_at" | "updated_at"
>;

export type InsertStaffSub = Omit<
  StaffSub,
  | "worker_id"
  | "created_at"
  | "updated_at"
  | "reliability_score"
  | "no_show_count"
  | "cancellation_count"
>;

export type InsertResponseLog = Omit<ResponseLog, "response_id" | "created_at" | "response_rank">;
export type InsertBooking = Omit<Booking, "booking_id" | "created_at">;
export type InsertComplianceLegal = Omit<ComplianceLegal, "id" | "created_at" | "updated_at">;
