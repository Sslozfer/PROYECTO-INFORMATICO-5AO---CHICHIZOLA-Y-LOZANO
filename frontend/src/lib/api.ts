import { apiClient } from '@/lib/api-client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PublicProfile {
  id: number;
  name: string;
  performance_score: number;
  identity_verified: boolean;
  category_scores: { category: string; score: number; confidence: number; vote_count: number }[];
  employments: { company_name: string; role: string; start_date: string; end_date: string | null; verification_level: number }[];
}

export interface OwnProfile extends PublicProfile {
  email: string;
  role: string;
  job_search: unknown[];
}

export interface RankingEntry {
  id: number;
  name: string;
  performance_score: number;
}

export interface Category {
  id: number;
  job_type_id: number;
  name: string;
  description: string;
  employer_weight: number;
  peer_weight: number;
  client_weight: number;
  is_active: boolean;
}

export interface CreateRatingPayload {
  to_user_id: number;
  evaluation_category_id: number;
  score: number;
  source_type: 'employer' | 'peer' | 'client';
  context_type?: string;
  interaction_frequency?: string;
  duration_months?: number;
  company_id?: number;
}

export interface Company {
  id: number;
  name: string;
  domain: string | null;
  verified: boolean;
  company_score: number;
  internal_reputation: number;
  external_perception: number;
  contact_email: string | null;
  job_types: JobType[];
}

export interface JobPost {
  id: number;
  job_type_id: number;
  title: string;
  description: string;
  location_label: string;
  modality: string;
  salary_min?: number;
  salary_max?: number;
  currency?: string;
  company_id: number;
  is_active: boolean;
  created_at: string;
}

export interface JobApplication {
  id: number;
  job_post_id: number;
  user_id: number;
  mode: string;
  status: string;
  compatibility_score: number | null;
  rejection_reason: string | null;
  conditions_snapshot: Record<string, unknown> | null;
  auto_offer_expires_at: string | null;
  created_at: string;
  job_post?: JobPost | null;
}

export interface UserLookup {
  id: number;
  name: string;
  identity_verified: boolean;
  performance_score: number;
}

// ─── Users ───────────────────────────────────────────────────────────────────
export const usersApi = {
  getMe:      ()         => apiClient.get<OwnProfile>('/users/me'),
  updateMe:   (data: { name?: string; email?: string }) => apiClient.patch<OwnProfile>('/users/me', data),
  getPublic:  (id: number) => apiClient.get<PublicProfile>(`/users/${id}`),
  getRanking: (jobTypeId?: number, categoryId?: number) => {
    const params: Record<string, number> = {};
    if (jobTypeId)  params.jobTypeId  = jobTypeId;
    if (categoryId) params.categoryId = categoryId;
    return apiClient.get<RankingEntry[]>('/users/ranking', { params });
  },
  lookup: (q: string) =>
    apiClient.get<UserLookup[]>('/users/lookup', { params: { q } }),
};

// ─── Categories ───────────────────────────────────────────────────────────────
export interface JobType {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
}

export interface PendingCategory {
  id: number;
  job_type_id: number;
  name: string;
  description: string | null;
  employer_weight: number;
  peer_weight: number;
  client_weight: number;
  category_weight: number;
  suggested_by_ai: boolean;
  is_active: boolean;
  created_at: string;
}

export interface ApproveCategoryPayload {
  name?: string;
  description?: string;
  employer_weight?: number;
  peer_weight?: number;
  client_weight?: number;
  category_weight?: number;
}

export interface CreateCategoryPayload {
  job_type_id: number;
  name: string;
  description?: string;
  employer_weight: number;
  peer_weight: number;
  client_weight: number;
  category_weight: number;
}

export const categoriesApi = {
  getAll:      ()              => apiClient.get<Category[]>('/categories'),
  getJobTypes: (active = true) => apiClient.get<JobType[]>('/categories/job-types', { params: { active } }),
  getByJobType: (jobTypeId: number) => apiClient.get<Category[]>('/categories/active', { params: { jobTypeId } }),
  // ─── Solo admin: gestión de rubros y categorías ─────────────────────────────
  createJobType:     (data: { name: string; description?: string }) => apiClient.post<JobType>('/categories/job-types', data),
  activateJobType:   (id: number) => apiClient.patch<JobType>(`/categories/job-types/${id}/activate`),
  suggestCategories: (jobTypeId: number) => apiClient.post<PendingCategory[]>(`/categories/job-types/${jobTypeId}/suggest`),
  getPending:        (jobTypeId?: number) => apiClient.get<PendingCategory[]>('/categories/pending', { params: jobTypeId ? { jobTypeId } : undefined }),
  create:            (data: CreateCategoryPayload) => apiClient.post<PendingCategory>('/categories', data),
  approve:           (id: number, data?: ApproveCategoryPayload) => apiClient.patch<PendingCategory>(`/categories/${id}/approve`, data ?? {}),
  reject:            (id: number) => apiClient.delete(`/categories/${id}/reject`),
};

// ─── Ratings ─────────────────────────────────────────────────────────────────
export interface RatingEntry {
  id: number;
  score: number;
  source_type: string;
  category: string;
  created_at: string;
  from_name?: string;
  to_name?: string;
  is_anonymous?: boolean;
}

export interface EvaluableResult {
  categories: Category[];
  available_sources: ('employer' | 'peer' | 'client')[];
  shared_companies: { id: number; name: string }[];
}

export const ratingsApi = {
  create:         (payload: CreateRatingPayload)   => apiClient.post('/ratings', payload),
  getReceived:    ()                               => apiClient.get<RatingEntry[]>('/ratings/received'),
  getGiven:       ()                               => apiClient.get<RatingEntry[]>('/ratings/given'),
  getEvaluable:   (toUserId: number)               => apiClient.get<EvaluableResult>(`/ratings/evaluable/${toUserId}`),
};

// ─── Companies ────────────────────────────────────────────────────────────────
export const companiesApi = {
  getAll:        (jobTypeId?: number) =>
    apiClient.get<Company[]>('/companies', { params: jobTypeId ? { jobTypeId } : undefined }),
  getOne:        (id: number)          => apiClient.get<Company>(`/companies/${id}`),
  getMyCompany:  ()                    => apiClient.get<Company>('/companies/me'),
  setMyJobTypes: (job_type_ids: number[]) => apiClient.put<JobType[]>('/companies/me/job-types', { job_type_ids }),
  updateMe:      (data: { name?: string; domain?: string; contact_email?: string }) =>
    apiClient.patch<Company>('/companies/me', data),
};

// ─── Jobs (matching + hiring) ─────────────────────────────────────────────────
export const jobsApi = {
  getMyApplications: ()               => apiClient.get<JobApplication[]>('/hiring/my-applications'),
  apply:             (jobPostId: number) => apiClient.post<JobApplication>(`/hiring/apply/${jobPostId}`),
  withdraw:          (appId: number)  => apiClient.patch(`/hiring/applications/${appId}/withdraw`),
  respond:           (appId: number, accept: boolean, reason?: string) =>
    apiClient.patch<JobApplication>(`/hiring/applications/${appId}/respond`, { accept, reason }),
};

// ─── Publicaciones de empresa (matching/posts) ─────────────────────────────────
export interface CreateJobPostPayload {
  job_type_id: number;
  title: string;
  description?: string;
  salary_min?: number;
  salary_max?: number;
  currency?: string;
  modality?: 'remote' | 'onsite' | 'hybrid';
  location_label?: string;
  latitude?: number;
  longitude?: number;
  min_category_scores?: Record<string, number>;
  radius_km?: number;
  hiring_mode?: 'manual' | 'semi_auto' | 'auto';
  auto_min_compatibility?: number;
  auto_min_category_score?: number;
  auto_max_distance_km?: number;
  auto_require_identity?: boolean;
  auto_offer_ttl_hours?: number;
}

export const jobPostsApi = {
  getMy:      () => apiClient.get<JobPost[]>('/matching/posts/my'),
  create:     (payload: CreateJobPostPayload) => apiClient.post<JobPost>('/matching/posts', payload),
  getCandidates: (postId: number) => apiClient.get<UserMatch[]>(`/matching/posts/${postId}/candidates`),
};

// ─── Postulaciones recibidas (empresa) ─────────────────────────────────────────
export const hiringApi = {
  getApplicationsForPost: (jobPostId: number) =>
    apiClient.get<JobApplication[]>(`/hiring/posts/${jobPostId}/applications`),
  reviewApplication: (appId: number, accept: boolean, reason?: string) =>
    apiClient.patch(`/hiring/applications/${appId}/review`, { accept, reason }),
};

// ─── Skills / Matching profile ───────────────────────────────────────────────
export interface MatchResult {
  compatibility_score: number;
  score_match: number;
  location_match: number;
  salary_match: boolean;
  modality_match: boolean;
  distance_km: number | null;
  details: Record<string, number>;
}

export interface JobMatch {
  job_post_id: number;
  company_id: number;
  title: string;
  match: MatchResult;
}

export interface UserMatch {
  user_id: number;
  job_post_id: number;
  match: MatchResult;
}

export interface UserProfile {
  user_id: number;
  job_type_id: number;
  latitude: number | null;
  longitude: number | null;
  location_label: string | null;
  salary_min: number | null;
  salary_max: number | null;
  currency: string | null;
  modality: string | null;
  is_active: boolean;
  skill_category_ids: number[];
}

export interface UpsertUserProfilePayload {
  job_type_id: number;
  latitude?: number;
  longitude?: number;
  location_label?: string;
  salary_min?: number;
  salary_max?: number;
  currency?: string;
  modality?: 'remote' | 'onsite' | 'hybrid';
}

export const matchingApi = {
  getMySkills:  ()                           => apiClient.get<number[]>('/matching/skills'),
  setMySkills:  (skill_category_ids: number[]) => apiClient.put('/matching/skills', { skill_category_ids }),
  getMyProfile: (jobTypeId: number)           => apiClient.get<UserProfile | null>('/matching/profile/' + jobTypeId),
  upsertProfile: (data: UpsertUserProfilePayload) => apiClient.put<UserProfile>('/matching/profile', data),
  // Empleado busca trabajo: publicaciones compatibles para un rubro dado
  getJobs:      (jobTypeId: number)           => apiClient.get<JobMatch[]>(`/matching/jobs/${jobTypeId}`),
};

// ─── Admin / Fraude ─────────────────────────────────────────────────────────
export interface FraudSummaryEntry { user_id: number; total_flags: string; total_severity: string }
export interface FraudDetailedEntry { user_id: number; type: string; count: string; severity_sum: string; sample_notes: string | null }
export interface FraudByTypeEntry { type: string; total: string; severity_sum: string; severity_avg: string }
export interface SuspiciousPairEntry { user1: number; user2: number; flag_count: string; severity_sum: string }
export interface FraudClustersResult { count: number; clusters: number[][] }
export interface HighRiskUserEntry { user_id: number; name: string; fraud_score: number; is_blocked: boolean }
export interface LowReliabilityVoterEntry { user_id: number; name: string; reliability: number; total_votes: number }
export interface SourceBiasEntry {
  user_id: number; category: string; global_score: number;
  employer_avg: string | null; peer_avg: string | null; client_avg: string | null;
}
export interface BlockedUserEntry { id: number; name: string; email: string; fraud_score: number }

export const adminApi = {
  getFraudSummary:        () => apiClient.get<FraudSummaryEntry[]>('/admin/fraud/summary'),
  getFraudDetailed:       () => apiClient.get<FraudDetailedEntry[]>('/admin/fraud/detailed'),
  getFraudByType:         () => apiClient.get<FraudByTypeEntry[]>('/admin/fraud/by-type'),
  getSuspiciousPairs:     () => apiClient.get<SuspiciousPairEntry[]>('/admin/fraud/pairs'),
  getFraudClusters:       () => apiClient.get<FraudClustersResult>('/admin/fraud/clusters'),
  getHighRiskUsers:       (minRisk?: number) => apiClient.get<HighRiskUserEntry[]>('/admin/fraud/high-risk', { params: minRisk !== undefined ? { minRisk } : undefined }),
  getLowReliabilityVoters:(max?: number)     => apiClient.get<LowReliabilityVoterEntry[]>('/admin/reliability/low', { params: max !== undefined ? { max } : undefined }),
  getSourceBiasReport:    (minDivergence?: number) => apiClient.get<SourceBiasEntry[]>('/admin/bias/report', { params: minDivergence !== undefined ? { minDivergence } : undefined }),
  getBlockedUsers:        () => apiClient.get<BlockedUserEntry[]>('/admin/users/blocked'),
  unblockUser:            (id: number) => apiClient.patch(`/admin/users/${id}/unblock`),
};

// ─── Employments ──────────────────────────────────────────────────────────────
export interface CreateEmploymentPayload {
  company_id: number;
  role?: string;
  start_date?: string;
  end_date?: string;
}

export interface Employment {
  id: number;
  user_id: number;
  company_id: number;
  role: string | null;
  start_date: string | null;
  end_date: string | null;
  verification_level: number;
  company_confirmed: boolean;
  created_at: string;
}

export const employmentsApi = {
  create:             (payload: CreateEmploymentPayload) => apiClient.post<Employment>('/employments', payload),
  getMy:              ()                                 => apiClient.get<Employment[]>('/employments/my'),
  requestCompany:     (id: number)                      => apiClient.post(`/employments/${id}/verify/company/request`),
  // Empresa
  getPendingForCo:    ()                                => apiClient.get<Employment[]>('/employments/company/pending'),
  verifyEmployment:   (id: number, confirm: boolean)    => apiClient.patch(`/employments/${id}/company/verify`, { confirm }),
};