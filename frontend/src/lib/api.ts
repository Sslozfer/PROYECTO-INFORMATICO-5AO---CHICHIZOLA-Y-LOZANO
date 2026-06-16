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

export const categoriesApi = {
  getAll:      ()              => apiClient.get<Category[]>('/categories'),
  getJobTypes: (active = true) => apiClient.get<JobType[]>('/categories/job-types', { params: { active } }),
  getByJobType: (jobTypeId: number) => apiClient.get<Category[]>('/categories/active', { params: { jobTypeId } }),
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
}

export const jobPostsApi = {
  getMy:      () => apiClient.get<JobPost[]>('/matching/posts/my'),
  create:     (payload: CreateJobPostPayload) => apiClient.post<JobPost>('/matching/posts', payload),
  getCandidates: (postId: number) => apiClient.get<unknown[]>(`/matching/posts/${postId}/candidates`),
};

// ─── Postulaciones recibidas (empresa) ─────────────────────────────────────────
export const hiringApi = {
  getApplicationsForPost: (jobPostId: number) =>
    apiClient.get<JobApplication[]>(`/hiring/posts/${jobPostId}/applications`),
  reviewApplication: (appId: number, accept: boolean, reason?: string) =>
    apiClient.patch(`/hiring/applications/${appId}/review`, { accept, reason }),
};

// ─── Skills / Matching profile ───────────────────────────────────────────────
export const matchingApi = {
  getMySkills:  ()                           => apiClient.get<number[]>('/matching/skills'),
  setMySkills:  (skill_category_ids: number[]) => apiClient.put('/matching/skills', { skill_category_ids }),
  getMyProfile: (jobTypeId: number)           => apiClient.get('/matching/profile/' + jobTypeId),
  upsertProfile: (data: Record<string, unknown>) => apiClient.put('/matching/profile', data),
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