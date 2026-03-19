-- Migration: Rename roles from leader/worker to manager/agent
-- Run against: atlas_driver_offer_bpp database as atlas_rw or cloud_admin

BEGIN;

-- 1. Drop the old constraint
ALTER TABLE argus.team_members DROP CONSTRAINT IF EXISTS ck_team_members_role;

-- 2. Rename existing role values
UPDATE argus.team_members SET role = 'manager' WHERE role = 'leader';
UPDATE argus.team_members SET role = 'agent'   WHERE role = 'worker';

-- 3. Update default
ALTER TABLE argus.team_members ALTER COLUMN role SET DEFAULT 'agent';

-- 4. Add new constraint
ALTER TABLE argus.team_members ADD CONSTRAINT ck_team_members_role CHECK (role IN ('manager', 'agent'));

COMMIT;
