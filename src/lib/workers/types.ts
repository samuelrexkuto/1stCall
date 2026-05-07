export interface WorkerStatHubData {
  status: "insufficient" | "provisional" | "established";
  overallScore: number | null;
  reliabilityScore: number | null;
  siteConductScore: number | null;
  workQualityScore: number | null;
  internalScoreSnapshot: number | null;
  verifiedBookingsCount: number;
  nextReleaseAt: string | null;
}

export interface WorkerStatHubMeta {
  verifiedCompletedJobsCount: number;
  reviewedJobsCount: number;
  portfolioBackedJobsCount?: number;
  repeatBookedCount?: number;
  status: "insufficient" | "provisional" | "established";
}

export interface WorkerCredentialsCompliance {
  insuranceVerified?: boolean;
  insuranceTypes?: string[];
  enhancedDbs?: boolean;
  firstAidCertified?: boolean;
  rightToWorkVerified?: boolean;
  companiesHouseVerified?: boolean;
  companiesHouseNumber?: string | null;
  constructionlineMember?: boolean;
  cscsVerified?: boolean;
  qualificationLabel?: string | null;
  accreditations?: string[];
}

export interface WorkerPerformanceSummary {
  completedJobsCount?: number;
  repeatClientsCount?: number;
  noShowIncidents?: number;
  sameDayCancellations?: number;
  lastBookingCompletedAt?: string | null;
}

export interface WorkerCompletedJobRecord {
  jobId: string;
  jobTitle: string;
  providerName: string;
  requiredRole: string | null;
  completedAt: string | null;
  bookingStatus: string;
}

export interface WorkerPortfolioItem {
  id: string;
  title: string;
  tradeCategory: string;
  areaLabel: string;
  completedMonth: string;
  completedYear: string;
  role: string;
  description: string;
  mediaUrls: string[];
  verificationType: "platform_verified" | "external";
}

export interface WorkerOverviewRow {
  worker_id: string;
  full_name: string;
  phone: string | null;
  whatsapp_number: string | null;
  email: string | null;
  primary_role: string | null;
  skill_tags: string[];
  workerType: "tradesman" | "contractor";
  contractorType?: "multi_discipline" | "specialist" | null;
  specialistArea?: string | null;
  skillTag?: string | null;
  languagesSpoken: string[];
  avgResponseTimeLabel?: string | null;
  location_display: string | null;
  town: string | null;
  postcode: string;
  latitude?: number | null;
  longitude?: number | null;
  status: string;
  available_today: boolean;
  right_to_work: boolean;
  contract_signed: boolean;
  contract_status?: string | null;
  contract_signed_at?: string | null;
  onboarding_status?: string | null;
  id_document_uploaded?: boolean;
  cscs_uploaded?: boolean;
  portfolio_uploaded?: boolean;
  certificates_uploaded?: boolean;
  profileImageUrl?: string | null;
  cardImageUrl?: string | null;
  work_readiness?: string | null;
  priority_tier: string;
  whatsapp_opt_in: boolean;
  expected_rate: number;
  reliability_score: number;
  created_at: string;
  stathub: WorkerStatHubData;
  statHubMeta: WorkerStatHubMeta;
  performanceSummary: WorkerPerformanceSummary;
  portfolio: WorkerPortfolioItem[];
  credentialsSummary: string[];
  credentialsCompliance: WorkerCredentialsCompliance;
  clientFeedbackHighlights: string[];
  completed_jobs_count: number;
  recent_completed_jobs: WorkerCompletedJobRecord[];
}
