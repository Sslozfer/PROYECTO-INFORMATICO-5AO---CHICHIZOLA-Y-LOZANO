-- ============================================================
-- SCHEMA FINAL — incluye todo
-- Correr en una base de datos vacía
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- USUARIOS
-- ────────────────────────────────────────────────────────────
CREATE TABLE users (
  id                  SERIAL PRIMARY KEY,
  name                TEXT NOT NULL,
  email               TEXT UNIQUE NOT NULL,
  password_hash       TEXT NOT NULL,
  role                TEXT DEFAULT 'user',        -- 'user' | 'company' | 'admin'
  global_trust_score  FLOAT DEFAULT 1.0,
  performance_score   FLOAT DEFAULT 0,
  perf_weighted_sum   FLOAT DEFAULT 0,
  perf_weight_sum     FLOAT DEFAULT 0,
  fraud_score         FLOAT DEFAULT 0,
  is_blocked          BOOLEAN DEFAULT FALSE,
  is_shadow_banned    BOOLEAN DEFAULT FALSE,
  identity_verified   BOOLEAN DEFAULT FALSE,
  company_id          INT,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ────────────────────────────────────────────────────────────
-- CONFIABILIDAD DEL VOTANTE
-- ────────────────────────────────────────────────────────────
CREATE TABLE voter_reliability (
  user_id           INT PRIMARY KEY REFERENCES users(id),
  reliability       FLOAT DEFAULT 1.0,
  deviation_streak  INT DEFAULT 0,
  recovery_streak   INT DEFAULT 0,
  total_votes_cast  INT DEFAULT 0,
  last_updated      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ────────────────────────────────────────────────────────────
-- EMPRESAS
-- ────────────────────────────────────────────────────────────
CREATE TABLE companies (
  id                  SERIAL PRIMARY KEY,
  name                TEXT NOT NULL,
  domain              TEXT,
  verified            BOOLEAN DEFAULT FALSE,
  company_score       FLOAT DEFAULT 0,
  internal_reputation FLOAT DEFAULT 0,
  external_perception FLOAT DEFAULT 0,
  contact_email       TEXT,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users ADD CONSTRAINT fk_users_company
  FOREIGN KEY (company_id) REFERENCES companies(id);

-- ────────────────────────────────────────────────────────────
-- EMPLEOS
-- ────────────────────────────────────────────────────────────
CREATE TABLE employments (
  id                     SERIAL PRIMARY KEY,
  user_id                INT REFERENCES users(id),
  company_id             INT REFERENCES companies(id),
  role                   TEXT,
  start_date             DATE,
  end_date               DATE,
  verification_level     INT DEFAULT 0,
  verified_by            TEXT,
  proof_type             TEXT,
  proof_url              TEXT,
  confirm_token          TEXT,
  confirm_token_expires  TIMESTAMP,
  company_confirmed      BOOLEAN DEFAULT FALSE,
  created_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ────────────────────────────────────────────────────────────
-- TIPOS DE TRABAJO
-- ────────────────────────────────────────────────────────────
CREATE TABLE job_types (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  is_active   BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ────────────────────────────────────────────────────────────
-- CATEGORÍAS DE EVALUACIÓN
-- ────────────────────────────────────────────────────────────
CREATE TABLE evaluation_categories (
  id               SERIAL PRIMARY KEY,
  job_type_id      INT REFERENCES job_types(id),
  name             TEXT NOT NULL,
  description      TEXT,
  employer_weight  FLOAT DEFAULT 0,
  peer_weight      FLOAT DEFAULT 0,
  client_weight    FLOAT DEFAULT 0,
  category_weight  FLOAT DEFAULT 1.0,
  suggested_by_ai  BOOLEAN DEFAULT FALSE,
  is_active        BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ────────────────────────────────────────────────────────────
-- RATINGS
-- ────────────────────────────────────────────────────────────
CREATE TABLE ratings (
  id                      SERIAL PRIMARY KEY,
  from_user_id            INT REFERENCES users(id),
  to_user_id              INT REFERENCES users(id),
  company_id              INT REFERENCES companies(id),
  employment_id           INT REFERENCES employments(id),
  evaluation_category_id  INT REFERENCES evaluation_categories(id),
  score                   INT CHECK (score >= 1 AND score <= 100),
  source_type             TEXT NOT NULL,
  context_type            TEXT,
  interaction_frequency   TEXT,
  duration_months         INT,
  verified_relationship   BOOLEAN DEFAULT FALSE,
  is_anonymous            BOOLEAN DEFAULT TRUE,
  created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ────────────────────────────────────────────────────────────
-- PESOS DE RATING
-- ────────────────────────────────────────────────────────────
CREATE TABLE rating_weights (
  rating_id          INT PRIMARY KEY REFERENCES ratings(id),
  source_weight      FLOAT,
  trust_weight       FLOAT,
  reliability_weight FLOAT,
  context_weight     FLOAT,
  time_weight        FLOAT,
  anomaly_weight     FLOAT,
  final_weight       FLOAT
);

-- ────────────────────────────────────────────────────────────
-- SCORES POR CATEGORÍA
-- ────────────────────────────────────────────────────────────
CREATE TABLE user_category_scores (
  user_id                INT REFERENCES users(id),
  evaluation_category_id INT REFERENCES evaluation_categories(id),
  score                  FLOAT DEFAULT 0,
  confidence             FLOAT DEFAULT 0,
  vote_count             INT DEFAULT 0,
  employer_weighted_sum  FLOAT DEFAULT 0,
  employer_weight_sum    FLOAT DEFAULT 0,
  peer_weighted_sum      FLOAT DEFAULT 0,
  peer_weight_sum        FLOAT DEFAULT 0,
  client_weighted_sum    FLOAT DEFAULT 0,
  client_weight_sum      FLOAT DEFAULT 0,
  last_updated           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, evaluation_category_id)
);

-- ────────────────────────────────────────────────────────────
-- FRAUD FLAGS
-- ────────────────────────────────────────────────────────────
CREATE TABLE fraud_flags (
  id           SERIAL PRIMARY KEY,
  rating_id    INT REFERENCES ratings(id),
  type         TEXT NOT NULL,
  severity     FLOAT NOT NULL,
  detected_by  TEXT NOT NULL,
  notes        TEXT,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ────────────────────────────────────────────────────────────
-- LOG DE CAMBIOS DE SCORE
-- ────────────────────────────────────────────────────────────
CREATE TABLE score_change_logs (
  id         SERIAL PRIMARY KEY,
  user_id    INT REFERENCES users(id),
  field      TEXT NOT NULL,
  delta      FLOAT NOT NULL,
  reason     TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ────────────────────────────────────────────────────────────
-- MATCHING
-- ────────────────────────────────────────────────────────────
CREATE TABLE user_profiles (
  user_id        INT REFERENCES users(id),
  job_type_id    INT REFERENCES job_types(id),
  latitude       FLOAT,
  longitude      FLOAT,
  location_label TEXT,
  salary_min     INT,
  salary_max     INT,
  currency       TEXT,
  modality       TEXT,
  is_active      BOOLEAN DEFAULT TRUE,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, job_type_id)
);

CREATE TABLE job_posts (
  id                   SERIAL PRIMARY KEY,
  company_id           INT REFERENCES users(id),
  job_type_id          INT REFERENCES job_types(id),
  title                TEXT NOT NULL,
  description          TEXT,
  latitude             FLOAT,
  longitude            FLOAT,
  location_label       TEXT,
  salary_min           INT,
  salary_max           INT,
  currency             TEXT,
  modality             TEXT,
  min_category_scores  JSONB,
  radius_km            INT DEFAULT 50,
  is_active            BOOLEAN DEFAULT TRUE,
  created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ────────────────────────────────────────────────────────────
-- ÍNDICES
-- ────────────────────────────────────────────────────────────
CREATE INDEX idx_ratings_from        ON ratings(from_user_id);
CREATE INDEX idx_ratings_to          ON ratings(to_user_id);
CREATE INDEX idx_ratings_category    ON ratings(evaluation_category_id);
CREATE INDEX idx_ratings_source      ON ratings(source_type);
CREATE INDEX idx_ratings_created     ON ratings(created_at);
CREATE INDEX idx_fraud_rating        ON fraud_flags(rating_id);
CREATE INDEX idx_fraud_type          ON fraud_flags(type);
CREATE INDEX idx_ucs_user            ON user_category_scores(user_id);
CREATE INDEX idx_ucs_category        ON user_category_scores(evaluation_category_id);
CREATE INDEX idx_score_logs_user     ON score_change_logs(user_id);
CREATE INDEX idx_voter_rel_user      ON voter_reliability(user_id);
CREATE INDEX idx_user_profiles_job   ON user_profiles(job_type_id);
CREATE INDEX idx_job_posts_job_type  ON job_posts(job_type_id);
CREATE INDEX idx_job_posts_company   ON job_posts(company_id);
-- ────────────────────────────────────────────────────────────
-- ÁREAS DE EMPRESA (job_types en que opera cada empresa)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS company_job_types (
  company_id   INT REFERENCES companies(id) ON DELETE CASCADE,
  job_type_id  INT REFERENCES job_types(id) ON DELETE CASCADE,
  PRIMARY KEY (company_id, job_type_id)
);

-- skills en user_profiles (columna jsonb)
-- Se agrega si no existe (idempotente via ALTER TABLE IF NOT EXISTS equivalente)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='user_profiles' AND column_name='skill_category_ids'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN skill_category_ids JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;