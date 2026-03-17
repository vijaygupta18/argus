-- ============================================
-- Argus - Production Issue Dashboard Schema
-- PostgreSQL 16+
-- Run as superuser (postgres or RDS master)
-- ============================================

-- 0. Create schema and grant access
CREATE SCHEMA IF NOT EXISTS argus;

-- Change 'db_user' to your actual RDS/DB user
GRANT ALL ON SCHEMA argus TO db_user;

-- 1. Teams
CREATE TABLE IF NOT EXISTS argus.teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    reminder_frequency_minutes INTEGER NOT NULL DEFAULT 1440,
    reminder_start_hour INTEGER NOT NULL DEFAULT 9,
    notifications_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Team Members
CREATE TABLE IF NOT EXISTS argus.team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES argus.teams(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slack_user_id VARCHAR(64) NOT NULL,
    email VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT true,
    notifications_muted BOOLEAN NOT NULL DEFAULT false,
    role VARCHAR(20) NOT NULL DEFAULT 'worker',
    open_issue_count INTEGER NOT NULL DEFAULT 0,
    total_assigned_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (team_id, email)
);

CREATE INDEX IF NOT EXISTS ix_team_members_email ON argus.team_members(email);

-- 3. Issues
CREATE TABLE IF NOT EXISTS argus.issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    priority VARCHAR(20),
    category VARCHAR(255),
    team_id UUID REFERENCES argus.teams(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES argus.team_members(id) ON DELETE SET NULL,
    assignees JSONB NOT NULL DEFAULT '[]',
    reported_by_slack_id VARCHAR(64),
    reported_by_name VARCHAR(255),
    reported_by_email VARCHAR(255),
    slack_channel_id VARCHAR(64),
    slack_channel_name VARCHAR(255),
    slack_thread_ts VARCHAR(64),
    slack_message_ts VARCHAR(64),
    ai_categorization JSONB,
    ai_rca JSONB,
    ai_provider_used VARCHAR(32),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES argus.team_members(id) ON DELETE SET NULL,
    notifications_muted BOOLEAN NOT NULL DEFAULT false,
    last_reminder_sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_issues_team_id_status ON argus.issues(team_id, status);
CREATE INDEX IF NOT EXISTS ix_issues_assigned_to_status ON argus.issues(assigned_to, status);
CREATE INDEX IF NOT EXISTS ix_issues_created_at_desc ON argus.issues(created_at DESC);

-- 4. Issue History
CREATE TABLE IF NOT EXISTS argus.issue_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id UUID NOT NULL REFERENCES argus.issues(id) ON DELETE CASCADE,
    action VARCHAR(64) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    performed_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_issue_history_issue_id_created_at ON argus.issue_history(issue_id, created_at);

-- 5. Users
CREATE TABLE IF NOT EXISTS argus.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255),
    slack_user_id VARCHAR(64),
    is_admin BOOLEAN NOT NULL DEFAULT false,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 7. Grant permissions to app user
GRANT ALL ON ALL TABLES IN SCHEMA argus TO db_user;
GRANT ALL ON ALL SEQUENCES IN SCHEMA argus TO db_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA argus GRANT ALL ON TABLES TO db_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA argus GRANT ALL ON SEQUENCES TO db_user;
