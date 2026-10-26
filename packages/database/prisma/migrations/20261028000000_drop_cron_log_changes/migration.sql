-- Per-member change history and undo support were removed.
-- CronLog alone now records job runs.
DROP TABLE IF EXISTS "CronLogChange";
