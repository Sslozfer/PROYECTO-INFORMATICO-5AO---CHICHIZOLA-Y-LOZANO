/**
 * Seed de datos de ejemplo para desarrollo local.
 *
 * Uso:
 *   cd backend/api
 *   npm run seed
 *
 * Crea: job_types, evaluation_categories (subáreas con pesos por fuente),
 * companies, users (workers + cuentas company + admin), employments,
 * user_profiles (para matching/búsqueda), ratings de ejemplo,
 * user_category_scores y recalcula users.performance_score.
 *
 * Es idempotente: si los datos ya existen (por email/nombre) no los duplica.
 */
import { Client } from 'pg';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';

// ─── Cargar .env manualmente (sin depender de @nestjs/config) ─────────────────
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnv();

const PASSWORD = 'password123';

  async function main() {
    const client = new Client({
      connectionString:
        process.env.DATABASE_PUBLIC_URL ||
        process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false,
      },
    });
  
    await client.connect();
    console.log('Conectado a la base de datos.');

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // ─── 1. JOB TYPES (rubros) ────────────────────────────────────────────────
  const jobTypes = [
    { name: 'Desarrollo de Software',  description: 'Roles de programación, backend, frontend y fullstack' },
    { name: 'Marketing Digital',       description: 'Roles de marketing, contenido y análisis de campañas' },
    { name: 'Diseño UX/UI',            description: 'Roles de diseño de producto, interfaces y experiencia de usuario' },
    { name: 'Data & Analytics',        description: 'Ciencia de datos, BI, machine learning y analytics' },
    { name: 'Recursos Humanos',        description: 'Reclutamiento, capacitación y desarrollo organizacional' },
    { name: 'Ventas y Negocios',       description: 'Ventas consultivas, account management y desarrollo de negocios' },
    { name: 'Finanzas y Contabilidad', description: 'Finanzas corporativas, contabilidad y tesorería' },
    { name: 'Operaciones y Logística', description: 'Supply chain, operaciones y logística empresarial' },
  ];
  const jobTypeIds: Record<string, number> = {};
  for (const jt of jobTypes) {
    const existing = await client.query('SELECT id FROM job_types WHERE name = $1', [jt.name]);
    if (existing.rows.length > 0) {
      jobTypeIds[jt.name] = existing.rows[0].id;
      continue;
    }
    const res = await client.query(
      `INSERT INTO job_types (name, description, is_active) VALUES ($1, $2, true) RETURNING id`,
      [jt.name, jt.description],
    );
    jobTypeIds[jt.name] = res.rows[0].id;
  }
  console.log('Job types:', jobTypeIds);

  // ─── 2. SUBÁREAS (evaluation_categories) ─────────────────────────────────
  // employer_weight / peer_weight / client_weight > 0 => esa fuente puede
  // evaluar esa subárea. category_weight => peso en el promedio del score global.
  const categories = [
    // Desarrollo de Software
    { job_type: 'Desarrollo de Software',  name: 'Calidad de Código',         description: 'Buenas prácticas, legibilidad y mantenibilidad del código',   employer_weight: 1, peer_weight: 1,   client_weight: 0,   category_weight: 1.2 },
    { job_type: 'Desarrollo de Software',  name: 'Comunicación Técnica',      description: 'Claridad para reportar avances, bloqueos y decisiones',        employer_weight: 1, peer_weight: 1,   client_weight: 1,   category_weight: 1.0 },
    { job_type: 'Desarrollo de Software',  name: 'Cumplimiento de Plazos',    description: 'Entrega en los tiempos acordados',                             employer_weight: 1, peer_weight: 0.5, client_weight: 1,   category_weight: 1.0 },
    { job_type: 'Desarrollo de Software',  name: 'Liderazgo Técnico',         description: 'Mentoría y toma de decisiones técnicas',                       employer_weight: 1, peer_weight: 1,   client_weight: 0,   category_weight: 0.8 },
    { job_type: 'Desarrollo de Software',  name: 'Resolución de Problemas',   description: 'Capacidad de identificar y resolver bugs y problemas complejos', employer_weight: 1, peer_weight: 1,   client_weight: 0,   category_weight: 1.1 },
    { job_type: 'Desarrollo de Software',  name: 'Trabajo en Equipo',         description: 'Colaboración, code reviews y pair programming',                employer_weight: 1, peer_weight: 1,   client_weight: 0,   category_weight: 0.9 },
    // Marketing Digital
    { job_type: 'Marketing Digital',       name: 'Creatividad',               description: 'Generación de ideas y contenido original',                     employer_weight: 1, peer_weight: 1,   client_weight: 1,   category_weight: 1.0 },
    { job_type: 'Marketing Digital',       name: 'Análisis de Datos',         description: 'Interpretación de métricas y KPIs',                            employer_weight: 1, peer_weight: 0.5, client_weight: 0,   category_weight: 1.0 },
    { job_type: 'Marketing Digital',       name: 'Gestión de Campañas',       description: 'Planificación y ejecución de campañas',                        employer_weight: 1, peer_weight: 0.5, client_weight: 1,   category_weight: 1.1 },
    { job_type: 'Marketing Digital',       name: 'SEO/SEM',                   description: 'Optimización para motores de búsqueda y campañas pagas',       employer_weight: 1, peer_weight: 0.5, client_weight: 0,   category_weight: 1.0 },
    { job_type: 'Marketing Digital',       name: 'Redes Sociales',            description: 'Gestión de comunidades y contenido en redes',                   employer_weight: 1, peer_weight: 0.5, client_weight: 1,   category_weight: 0.9 },
    // Diseño UX/UI
    { job_type: 'Diseño UX/UI',            name: 'Diseño Visual',             description: 'Estética, consistencia y sistema de diseño',                   employer_weight: 1, peer_weight: 1,   client_weight: 1,   category_weight: 1.1 },
    { job_type: 'Diseño UX/UI',            name: 'Usabilidad',                description: 'Facilidad de uso e investigación de usuarios',                 employer_weight: 1, peer_weight: 1,   client_weight: 1,   category_weight: 1.0 },
    { job_type: 'Diseño UX/UI',            name: 'Prototipado',               description: 'Velocidad y calidad de prototipos',                            employer_weight: 1, peer_weight: 0.5, client_weight: 0,   category_weight: 0.9 },
    { job_type: 'Diseño UX/UI',            name: 'Investigación de Usuarios',  description: 'Entrevistas, tests de usabilidad y análisis',                  employer_weight: 1, peer_weight: 1,   client_weight: 0,   category_weight: 1.0 },
    // Data & Analytics
    { job_type: 'Data & Analytics',        name: 'Modelado de Datos',         description: 'Diseño y optimización de modelos de datos',                    employer_weight: 1, peer_weight: 1,   client_weight: 0,   category_weight: 1.2 },
    { job_type: 'Data & Analytics',        name: 'SQL y Bases de Datos',      description: 'Consultas complejas, optimización y administración',           employer_weight: 1, peer_weight: 1,   client_weight: 0,   category_weight: 1.1 },
    { job_type: 'Data & Analytics',        name: 'Visualización de Datos',    description: 'Dashboards, reportes y storytelling con datos',                employer_weight: 1, peer_weight: 0.5, client_weight: 1,   category_weight: 0.9 },
    // Recursos Humanos
    { job_type: 'Data & Analytics',        name: 'Machine Learning',          description: 'Desarrollo y evaluación de modelos de ML',                     employer_weight: 1, peer_weight: 0.5, client_weight: 0,   category_weight: 1.0 },
    { job_type: 'Recursos Humanos',        name: 'Reclutamiento',             description: 'Atracción, evaluación y selección de talento',                 employer_weight: 1, peer_weight: 0.5, client_weight: 0,   category_weight: 1.1 },
    { job_type: 'Recursos Humanos',        name: 'Gestión de Personas',       description: 'Liderazgo, motivación y desarrollo de equipos',                employer_weight: 1, peer_weight: 1,   client_weight: 0,   category_weight: 1.0 },
    { job_type: 'Recursos Humanos',        name: 'Capacitación',              description: 'Diseño y facilitación de programas de formación',              employer_weight: 1, peer_weight: 0.5, client_weight: 0.5, category_weight: 0.9 },
    // Ventas y Negocios
    { job_type: 'Ventas y Negocios',       name: 'Cierre de Ventas',          description: 'Capacidad para cerrar deals y superar cuotas',                 employer_weight: 1, peer_weight: 0.5, client_weight: 1,   category_weight: 1.2 },
    { job_type: 'Ventas y Negocios',       name: 'Relación con Clientes',     description: 'Construcción y mantenimiento de relaciones comerciales',        employer_weight: 1, peer_weight: 0.5, client_weight: 1,   category_weight: 1.1 },
    { job_type: 'Ventas y Negocios',       name: 'Negociación',               description: 'Habilidad negociadora en propuestas y contratos',              employer_weight: 1, peer_weight: 0.5, client_weight: 1,   category_weight: 1.0 },
    // Finanzas y Contabilidad
    { job_type: 'Finanzas y Contabilidad', name: 'Análisis Financiero',       description: 'Lectura e interpretación de estados financieros',              employer_weight: 1, peer_weight: 0.5, client_weight: 0,   category_weight: 1.2 },
    { job_type: 'Finanzas y Contabilidad', name: 'Control Presupuestario',    description: 'Seguimiento y control del presupuesto',                        employer_weight: 1, peer_weight: 0.5, client_weight: 0,   category_weight: 1.0 },
    { job_type: 'Finanzas y Contabilidad', name: 'Cumplimiento Normativo',    description: 'Conocimiento de regulaciones fiscales y contables',            employer_weight: 1, peer_weight: 0.5, client_weight: 0,   category_weight: 1.0 },
    // Operaciones y Logística
    { job_type: 'Operaciones y Logística', name: 'Gestión de Inventario',     description: 'Control y optimización de stocks',                             employer_weight: 1, peer_weight: 0.5, client_weight: 0,   category_weight: 1.0 },
    { job_type: 'Operaciones y Logística', name: 'Mejora de Procesos',        description: 'Lean, Six Sigma y optimización operativa',                     employer_weight: 1, peer_weight: 1,   client_weight: 0,   category_weight: 1.1 },
    { job_type: 'Operaciones y Logística', name: 'Gestión de Proveedores',    description: 'Negociación y relación con proveedores',                       employer_weight: 1, peer_weight: 0,   client_weight: 1,   category_weight: 0.9 },
  ];
  const categoryIds: Record<string, number> = {};
  for (const cat of categories) {
    const jobTypeId = jobTypeIds[cat.job_type];
    const existing = await client.query(
      'SELECT id FROM evaluation_categories WHERE job_type_id = $1 AND name = $2',
      [jobTypeId, cat.name],
    );
    if (existing.rows.length > 0) {
      categoryIds[cat.name] = existing.rows[0].id;
      continue;
    }
    const res = await client.query(
      `INSERT INTO evaluation_categories
         (job_type_id, name, description, employer_weight, peer_weight, client_weight, category_weight, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true) RETURNING id`,
      [jobTypeId, cat.name, cat.description, cat.employer_weight, cat.peer_weight, cat.client_weight, cat.category_weight],
    );
    categoryIds[cat.name] = res.rows[0].id;
  }
  console.log('Categorías (subáreas):', categoryIds);

  // ─── 3. EMPRESAS ───────────────────────────────────────────────────────────
  const companies = [
    { name: 'TechCorp',    domain: 'techcorp.com',    verified: true,  company_score: 88, internal_reputation: 85, external_perception: 90, contact_email: 'rrhh@techcorp.com' },
    { name: 'InnovaLabs',  domain: 'innovalabs.io',    verified: true,  company_score: 82, internal_reputation: 80, external_perception: 84, contact_email: 'rrhh@innovalabs.io' },
    { name: 'CloudWorks',  domain: 'cloudworks.dev',   verified: false, company_score: 75, internal_reputation: 72, external_perception: 78, contact_email: 'rrhh@cloudworks.dev' },
  ];
  const companyIds: Record<string, number> = {};
  for (const co of companies) {
    const existing = await client.query('SELECT id FROM companies WHERE domain = $1', [co.domain]);
    if (existing.rows.length > 0) {
      companyIds[co.name] = existing.rows[0].id;
      continue;
    }
    const res = await client.query(
      `INSERT INTO companies (name, domain, verified, company_score, internal_reputation, external_perception, contact_email)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [co.name, co.domain, co.verified, co.company_score, co.internal_reputation, co.external_perception, co.contact_email],
    );
    companyIds[co.name] = res.rows[0].id;
  }
  console.log('Empresas:', companyIds);

  // ─── 4. USUARIOS ───────────────────────────────────────────────────────────
  // Cuentas de empresa (role='company') — login con email + "password123"
  const companyUsers = [
    { name: 'TechCorp RRHH',   email: 'rrhh@techcorp.com',   company: 'TechCorp' },
    { name: 'InnovaLabs RRHH', email: 'rrhh@innovalabs.io',  company: 'InnovaLabs' },
    { name: 'CloudWorks RRHH', email: 'rrhh@cloudworks.dev', company: 'CloudWorks' },
  ];
  const userIds: Record<string, number> = {};
  for (const cu of companyUsers) {
    const existing = await client.query('SELECT id FROM users WHERE email = $1', [cu.email]);
    if (existing.rows.length > 0) {
      userIds[cu.email] = existing.rows[0].id;
      continue;
    }
    const res = await client.query(
      `INSERT INTO users (name, email, password_hash, role, company_id, identity_verified)
       VALUES ($1, $2, $3, 'company', $4, true) RETURNING id`,
      [cu.name, cu.email, passwordHash, companyIds[cu.company]],
    );
    userIds[cu.email] = res.rows[0].id;
  }

  // Admin
  {
    const existing = await client.query('SELECT id FROM users WHERE email = $1', ['admin@trustscore.com']);
    if (existing.rows.length === 0) {
      const res = await client.query(
        `INSERT INTO users (name, email, password_hash, role, identity_verified)
         VALUES ('Admin TrustScore', 'admin@trustscore.com', $1, 'admin', true) RETURNING id`,
        [passwordHash],
      );
      userIds['admin@trustscore.com'] = res.rows[0].id;
    } else {
      userIds['admin@trustscore.com'] = existing.rows[0].id;
    }
  }

  // Trabajadores (role='user')
  const workers = [
    { name: 'Juan García',     email: 'juan@example.com',   identity_verified: true,  job_type: 'Desarrollo de Software', company: 'TechCorp',   role_title: 'Senior React Developer' },
    { name: 'Lucía Fernández', email: 'lucia@example.com',  identity_verified: true,  job_type: 'Desarrollo de Software', company: 'TechCorp',   role_title: 'Backend Developer' },
    { name: 'Pedro Sánchez',   email: 'pedro@example.com',  identity_verified: false, job_type: 'Desarrollo de Software', company: 'InnovaLabs', role_title: 'Fullstack Developer' },
    { name: 'María López',     email: 'maria@example.com',  identity_verified: true,  job_type: 'Marketing Digital',      company: 'InnovaLabs', role_title: 'Marketing Manager' },
    { name: 'Carlos Rodríguez',email: 'carlos@example.com', identity_verified: false, job_type: 'Diseño UX/UI',            company: 'CloudWorks', role_title: 'UX Designer' },
  ];
  for (const w of workers) {
    const existing = await client.query('SELECT id FROM users WHERE email = $1', [w.email]);
    if (existing.rows.length > 0) {
      userIds[w.email] = existing.rows[0].id;
      continue;
    }
    const res = await client.query(
      `INSERT INTO users (name, email, password_hash, role, identity_verified)
       VALUES ($1, $2, $3, 'user', $4) RETURNING id`,
      [w.name, w.email, passwordHash, w.identity_verified],
    );
    userIds[w.email] = res.rows[0].id;
  }
  console.log('Usuarios:', userIds);

  // ─── 5. EMPLEOS (employments) ───────────────────────────────────────────────
  const employments = [
    { email: 'juan@example.com',   company: 'TechCorp',   role: 'Senior React Developer', start: '2022-01-15', end: null,          level: 2 },
    { email: 'lucia@example.com',  company: 'TechCorp',   role: 'Backend Developer',      start: '2023-03-01', end: null,          level: 2 },
    { email: 'pedro@example.com',  company: 'InnovaLabs', role: 'Fullstack Developer',    start: '2021-06-01', end: '2023-12-31',  level: 1 },
    { email: 'maria@example.com',  company: 'InnovaLabs', role: 'Marketing Manager',      start: '2022-02-01', end: null,          level: 2 },
    { email: 'carlos@example.com', company: 'CloudWorks', role: 'UX Designer',            start: '2022-05-01', end: null,          level: 1 },
  ];
  const employmentIds: Record<string, number> = {};
  for (const e of employments) {
    const existing = await client.query(
      'SELECT id FROM employments WHERE user_id = $1 AND company_id = $2 AND role = $3',
      [userIds[e.email], companyIds[e.company], e.role],
    );
    if (existing.rows.length > 0) {
      employmentIds[e.email] = existing.rows[0].id;
      continue;
    }
    const res = await client.query(
      `INSERT INTO employments (user_id, company_id, role, start_date, end_date, verification_level, company_confirmed)
       VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING id`,
      [userIds[e.email], companyIds[e.company], e.role, e.start, e.end, e.level],
    );
    employmentIds[e.email] = res.rows[0].id;
  }

  // ─── 6. USER PROFILES (perfil de búsqueda activa, para matching) ───────────
  const profiles = [
    { email: 'juan@example.com',   job_type: 'Desarrollo de Software', location: 'Buenos Aires, Argentina', salary_min: 1500, salary_max: 2500, currency: 'USD', modality: 'remote',  skills: ['Calidad de Código', 'Liderazgo Técnico'] },
    { email: 'lucia@example.com',  job_type: 'Desarrollo de Software', location: 'Córdoba, Argentina',      salary_min: 1200, salary_max: 2000, currency: 'USD', modality: 'hybrid',  skills: ['Calidad de Código', 'Comunicación'] },
    { email: 'pedro@example.com',  job_type: 'Desarrollo de Software', location: 'Rosario, Argentina',      salary_min: 1000, salary_max: 1800, currency: 'USD', modality: 'remote',  skills: ['Cumplimiento de Plazos'] },
    { email: 'maria@example.com',  job_type: 'Marketing Digital',      location: 'Buenos Aires, Argentina', salary_min: 900,  salary_max: 1500, currency: 'USD', modality: 'onsite',  skills: ['Creatividad', 'Gestión de Campañas'] },
    { email: 'carlos@example.com', job_type: 'Diseño UX/UI',           location: 'Mendoza, Argentina',      salary_min: 800,  salary_max: 1400, currency: 'USD', modality: 'remote',  skills: ['Diseño Visual', 'Usabilidad'] },
  ];
  for (const p of profiles) {
    const jobTypeId = jobTypeIds[p.job_type];
    const skillIds = (p.skills ?? []).map((s: string) => categoryIds[s]).filter(Boolean);
    const existing = await client.query(
      'SELECT 1 FROM user_profiles WHERE user_id = $1 AND job_type_id = $2',
      [userIds[p.email], jobTypeId],
    );
    if (existing.rows.length > 0) {
      await client.query(
        'UPDATE user_profiles SET skill_category_ids = $1 WHERE user_id = $2 AND job_type_id = $3',
        [JSON.stringify(skillIds), userIds[p.email], jobTypeId],
      );
      continue;
    }
    await client.query(
      `INSERT INTO user_profiles (user_id, job_type_id, location_label, salary_min, salary_max, currency, modality, is_active, skill_category_ids)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)`,
      [userIds[p.email], jobTypeId, p.location, p.salary_min, p.salary_max, p.currency, p.modality, JSON.stringify(skillIds)],
    );
  }

  // ─── 7. RATINGS + USER_CATEGORY_SCORES ─────────────────────────────────────
  // Para cada trabajador, algunas evaluaciones reales (ratings) en las
  // subáreas de su rubro, respetando qué fuentes pueden evaluar cada subárea.
  type SeedRating = { from: string; to: string; category: string; score: number; source: 'employer' | 'peer' | 'client' };
  const ratings: SeedRating[] = [
    // Juan García (Desarrollo de Software) — evaluado por su empresa (TechCorp) y su par Lucía
    { from: 'rrhh@techcorp.com', to: 'juan@example.com', category: 'Calidad de Código',      score: 92, source: 'employer' },
    { from: 'rrhh@techcorp.com', to: 'juan@example.com', category: 'Comunicación',           score: 88, source: 'employer' },
    { from: 'rrhh@techcorp.com', to: 'juan@example.com', category: 'Cumplimiento de Plazos', score: 95, source: 'employer' },
    { from: 'lucia@example.com', to: 'juan@example.com', category: 'Calidad de Código',      score: 90, source: 'peer' },
    { from: 'lucia@example.com', to: 'juan@example.com', category: 'Liderazgo Técnico',      score: 85, source: 'peer' },

    // Lucía Fernández (Desarrollo de Software)
    { from: 'rrhh@techcorp.com', to: 'lucia@example.com', category: 'Calidad de Código',      score: 80, source: 'employer' },
    { from: 'rrhh@techcorp.com', to: 'lucia@example.com', category: 'Cumplimiento de Plazos', score: 84, source: 'employer' },
    { from: 'juan@example.com',  to: 'lucia@example.com', category: 'Calidad de Código',      score: 83, source: 'peer' },
    { from: 'juan@example.com',  to: 'lucia@example.com', category: 'Comunicación',           score: 87, source: 'peer' },

    // Pedro Sánchez (Desarrollo de Software, InnovaLabs)
    { from: 'rrhh@innovalabs.io', to: 'pedro@example.com', category: 'Calidad de Código',      score: 70, source: 'employer' },
    { from: 'rrhh@innovalabs.io', to: 'pedro@example.com', category: 'Cumplimiento de Plazos', score: 65, source: 'employer' },
    { from: 'rrhh@innovalabs.io', to: 'pedro@example.com', category: 'Comunicación',           score: 72, source: 'employer' },

    // María López (Marketing Digital, InnovaLabs)
    { from: 'rrhh@innovalabs.io', to: 'maria@example.com', category: 'Creatividad',         score: 94, source: 'employer' },
    { from: 'rrhh@innovalabs.io', to: 'maria@example.com', category: 'Análisis de Datos',    score: 89, source: 'employer' },
    { from: 'rrhh@innovalabs.io', to: 'maria@example.com', category: 'Gestión de Campañas',  score: 91, source: 'employer' },

    // Carlos Rodríguez (Diseño UX/UI, CloudWorks)
    { from: 'rrhh@cloudworks.dev', to: 'carlos@example.com', category: 'Diseño Visual', score: 88, source: 'employer' },
    { from: 'rrhh@cloudworks.dev', to: 'carlos@example.com', category: 'Usabilidad',    score: 84, source: 'employer' },
    { from: 'rrhh@cloudworks.dev', to: 'carlos@example.com', category: 'Prototipado',   score: 80, source: 'employer' },
  ];

  for (const r of ratings) {
    const exists = await client.query(
      `SELECT 1 FROM ratings WHERE from_user_id = $1 AND to_user_id = $2 AND evaluation_category_id = $3 AND source_type = $4`,
      [userIds[r.from], userIds[r.to], categoryIds[r.category], r.source],
    );
    if (exists.rows.length > 0) continue;
    await client.query(
      `INSERT INTO ratings (from_user_id, to_user_id, evaluation_category_id, score, source_type, context_type, verified_relationship, is_anonymous)
       VALUES ($1, $2, $3, $4, $5, 'professional', true, false)`,
      [userIds[r.from], userIds[r.to], categoryIds[r.category], r.score, r.source],
    );
  }

  // ─── 8. Recalcular user_category_scores y performance_score ───────────────
  // Para el seed simplificamos: score de categoría = promedio simple de los
  // ratings recibidos en esa categoría, confidence sube con la cantidad de votos.
  const workerEmails = workers.map(w => w.email);
  for (const email of workerEmails) {
    const userId = userIds[email];

    const byCategory = await client.query(
      `SELECT evaluation_category_id, AVG(score) AS avg_score, COUNT(*) AS votes
       FROM ratings WHERE to_user_id = $1 GROUP BY evaluation_category_id`,
      [userId],
    );

    let weightedSum = 0;
    let weightSum = 0;

    for (const row of byCategory.rows) {
      const categoryId = Number(row.evaluation_category_id);
      const avgScore = Number(row.avg_score);
      const votes = Number(row.votes);
      const confidence = Math.min(1, votes / 5); // 5 votos = confianza máxima

      const catInfo = await client.query(
        'SELECT category_weight FROM evaluation_categories WHERE id = $1',
        [categoryId],
      );
      const categoryWeight = Number(catInfo.rows[0].category_weight);

      await client.query(
        `INSERT INTO user_category_scores (user_id, evaluation_category_id, score, confidence, vote_count)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, evaluation_category_id)
         DO UPDATE SET score = $3, confidence = $4, vote_count = $5, last_updated = CURRENT_TIMESTAMP`,
        [userId, categoryId, avgScore, confidence, votes],
      );

      weightedSum += avgScore * categoryWeight * confidence;
      weightSum   += categoryWeight * confidence;
    }

    const performanceScore = weightSum > 0 ? Math.round((weightedSum / weightSum) * 10) / 10 : 0;
    await client.query('UPDATE users SET performance_score = $1 WHERE id = $2', [performanceScore, userId]);
    console.log(`  ${email} -> performance_score = ${performanceScore}`);
  }

  // ─── 9. COMPANY JOB TYPES (áreas de cada empresa) ─────────────────────────
  const companyJobTypeMap = [
    { company: 'TechCorp',    job_types: ['Desarrollo de Software', 'Data & Analytics'] },
    { company: 'InnovaLabs',  job_types: ['Desarrollo de Software', 'Marketing Digital', 'Diseño UX/UI'] },
    { company: 'CloudWorks',  job_types: ['Diseño UX/UI', 'Desarrollo de Software', 'Operaciones y Logística'] },
  ];
  for (const entry of companyJobTypeMap) {
    const coId = companyIds[entry.company];
    for (const jtName of entry.job_types) {
      const jtId = jobTypeIds[jtName];
      const ex = await client.query(
        'SELECT 1 FROM company_job_types WHERE company_id = $1 AND job_type_id = $2',
        [coId, jtId],
      );
      if (ex.rows.length === 0) {
        await client.query(
          'INSERT INTO company_job_types (company_id, job_type_id) VALUES ($1, $2)',
          [coId, jtId],
        );
      }
    }
  }

  // ─── 10. JOB POSTS (publicaciones de las empresas) ──────────────────────────
  const jobPosts = [
    { company: 'rrhh@techcorp.com',   job_type: 'Desarrollo de Software', title: 'Senior React Developer', description: 'Buscamos dev frontend senior para equipo de producto.', salary_min: 1800, salary_max: 2800, currency: 'USD', modality: 'remote', location: 'Remoto (LatAm)' },
    { company: 'rrhh@innovalabs.io', job_type: 'Marketing Digital',      title: 'Marketing Specialist',   description: 'Gestión de campañas de performance y contenido.',       salary_min: 900,  salary_max: 1500, currency: 'USD', modality: 'onsite', location: 'Buenos Aires, Argentina' },
    { company: 'rrhh@cloudworks.dev', job_type: 'Diseño UX/UI',          title: 'Product Designer',       description: 'Diseño end-to-end de producto B2B.',                    salary_min: 1000, salary_max: 1900, currency: 'USD', modality: 'hybrid', location: 'Mendoza, Argentina' },
  ];
  for (const jp of jobPosts) {
    const existing = await client.query(
      'SELECT 1 FROM job_posts WHERE company_id = $1 AND title = $2',
      [userIds[jp.company], jp.title],
    );
    if (existing.rows.length > 0) continue;
    await client.query(
      `INSERT INTO job_posts (company_id, job_type_id, title, description, salary_min, salary_max, currency, modality, location_label, hiring_mode, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'manual', true)`,
      [userIds[jp.company], jobTypeIds[jp.job_type], jp.title, jp.description, jp.salary_min, jp.salary_max, jp.currency, jp.modality, jp.location],
    );
  }

  await client.end();
  console.log('\n✅ Seed completado.');
  console.log(`   Todas las cuentas usan la contraseña: ${PASSWORD}`);
  console.log('   Cuentas de ejemplo:');
  console.log('     - admin@trustscore.com        (admin)');
  console.log('     - rrhh@techcorp.com       (company)');
  console.log('     - rrhh@innovalabs.io      (company)');
  console.log('     - rrhh@cloudworks.dev     (company)');
  console.log('     - juan@example.com        (user)');
  console.log('     - lucia@example.com       (user)');
  console.log('     - pedro@example.com       (user)');
  console.log('     - maria@example.com       (user)');
  console.log('     - carlos@example.com      (user)');
}

main().catch((err) => {
  console.error('Error al ejecutar el seed:', err);
  process.exit(1);
});
