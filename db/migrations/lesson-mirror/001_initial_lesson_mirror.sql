CREATE TABLE fc_lesson_sync_runs (
  sync_run_id UUID PRIMARY KEY,
  source TEXT NOT NULL,
  trigger_kind TEXT NOT NULL CHECK (trigger_kind IN ('manual', 'scheduled')),
  window_start DATE NOT NULL,
  window_end_exclusive DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
  calendar_expected_count INTEGER CHECK (calendar_expected_count >= 0),
  calendar_received_count INTEGER CHECK (calendar_received_count >= 0),
  attendance_expected_count INTEGER CHECK (attendance_expected_count >= 0),
  attendance_received_count INTEGER CHECK (attendance_received_count >= 0),
  series_count INTEGER CHECK (series_count >= 0),
  event_count INTEGER CHECK (event_count >= 0),
  participation_count INTEGER CHECK (participation_count >= 0),
  failure_code TEXT,
  failure_summary TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  CHECK (window_end_exclusive > window_start),
  CHECK (
    status <> 'succeeded'
    OR (
      calendar_expected_count IS NOT NULL
      AND calendar_received_count IS NOT NULL
      AND attendance_expected_count IS NOT NULL
      AND attendance_received_count IS NOT NULL
      AND series_count IS NOT NULL
      AND event_count IS NOT NULL
      AND participation_count IS NOT NULL
      AND calendar_expected_count = calendar_received_count
      AND attendance_expected_count = attendance_received_count
      AND completed_at IS NOT NULL
    )
  )
);

CREATE INDEX fc_lesson_sync_runs_started_idx
  ON fc_lesson_sync_runs (started_at DESC);

CREATE TABLE fc_lesson_series (
  fc_series_id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  observed_recurrence JSONB,
  state_hash TEXT NOT NULL CHECK (state_hash ~ '^[a-f0-9]{64}$'),
  first_observed_at TIMESTAMPTZ NOT NULL,
  last_observed_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE fc_lesson_events (
  fc_event_id TEXT PRIMARY KEY,
  fc_series_id TEXT REFERENCES fc_lesson_series(fc_series_id),
  source TEXT NOT NULL,
  local_date DATE NOT NULL,
  local_time TIME WITHOUT TIME ZONE NOT NULL,
  time_zone TEXT NOT NULL,
  source_start TEXT NOT NULL,
  duration_minutes INTEGER CHECK (duration_minutes >= 0),
  tutor_external_id TEXT,
  original_tutor_external_id TEXT,
  location_external_id TEXT,
  location_name TEXT,
  category_external_id TEXT,
  category_name TEXT,
  all_day BOOLEAN,
  source_status TEXT,
  source_recurring BOOLEAN,
  source_recurrence JSONB,
  calendar_observed BOOLEAN NOT NULL DEFAULT FALSE,
  attendance_observed BOOLEAN NOT NULL DEFAULT FALSE,
  state_hash TEXT NOT NULL CHECK (state_hash ~ '^[a-f0-9]{64}$'),
  first_observed_at TIMESTAMPTZ NOT NULL,
  last_observed_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX fc_lesson_events_date_idx
  ON fc_lesson_events (local_date, local_time);

CREATE INDEX fc_lesson_events_series_idx
  ON fc_lesson_events (fc_series_id, local_date, local_time);

CREATE TABLE fc_lesson_participations (
  fc_participation_id TEXT PRIMARY KEY,
  fc_event_id TEXT NOT NULL REFERENCES fc_lesson_events(fc_event_id),
  student_external_id TEXT NOT NULL,
  attendance_external_id TEXT,
  raw_attendance_status TEXT,
  state_hash TEXT NOT NULL CHECK (state_hash ~ '^[a-f0-9]{64}$'),
  first_observed_at TIMESTAMPTZ NOT NULL,
  last_observed_at TIMESTAMPTZ NOT NULL,
  UNIQUE (fc_event_id, student_external_id)
);

CREATE INDEX fc_lesson_participations_student_idx
  ON fc_lesson_participations (student_external_id, fc_event_id);

CREATE TABLE fc_lesson_external_refs (
  provider TEXT NOT NULL,
  reference_kind TEXT NOT NULL CHECK (reference_kind IN ('series', 'event', 'attendance')),
  external_id TEXT NOT NULL,
  entity_kind TEXT NOT NULL CHECK (entity_kind IN ('series', 'event', 'participation')),
  fc_entity_id TEXT NOT NULL,
  first_observed_at TIMESTAMPTZ NOT NULL,
  last_observed_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (provider, reference_kind, external_id)
);

CREATE INDEX fc_lesson_external_refs_entity_idx
  ON fc_lesson_external_refs (entity_kind, fc_entity_id);

CREATE TABLE fc_lesson_revisions (
  revision_id BIGSERIAL PRIMARY KEY,
  sync_run_id UUID NOT NULL REFERENCES fc_lesson_sync_runs(sync_run_id),
  entity_kind TEXT NOT NULL CHECK (entity_kind IN ('series', 'event', 'participation')),
  fc_entity_id TEXT NOT NULL,
  revision_kind TEXT NOT NULL CHECK (revision_kind IN ('created', 'changed')),
  state_hash TEXT NOT NULL CHECK (state_hash ~ '^[a-f0-9]{64}$'),
  snapshot JSONB NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX fc_lesson_revisions_entity_idx
  ON fc_lesson_revisions (entity_kind, fc_entity_id, observed_at DESC);

CREATE INDEX fc_lesson_revisions_run_idx
  ON fc_lesson_revisions (sync_run_id);
