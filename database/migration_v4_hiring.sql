-- ============================================================
-- MIGRACIÓN v4 — sistema de contratación
-- ============================================================

-- Columnas nuevas en job_posts
ALTER TABLE job_posts
  ADD COLUMN IF NOT EXISTS hiring_mode             TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS auto_min_compatibility  FLOAT,
  ADD COLUMN IF NOT EXISTS auto_min_category_score FLOAT,
  ADD COLUMN IF NOT EXISTS auto_max_distance_km    FLOAT,
  ADD COLUMN IF NOT EXISTS auto_require_identity   BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS auto_offer_ttl_hours    INT DEFAULT 48;

-- Tabla de aplicaciones
CREATE TABLE IF NOT EXISTS job_applications (
  id                    SERIAL PRIMARY KEY,
  job_post_id           INT REFERENCES job_posts(id),
  user_id               INT REFERENCES users(id),
  mode                  TEXT NOT NULL,
  status                TEXT DEFAULT 'pending',
  compatibility_score   FLOAT,
  conditions_snapshot   JSONB,
  auto_offer_expires_at TIMESTAMP,
  rejection_reason      TEXT,
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (job_post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_applications_user    ON job_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_post    ON job_applications(job_post_id);
CREATE INDEX IF NOT EXISTS idx_applications_status  ON job_applications(status);