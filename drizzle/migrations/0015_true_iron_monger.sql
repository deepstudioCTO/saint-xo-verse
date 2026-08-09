DROP TABLE "generations" CASCADE;--> statement-breakpoint
ALTER TABLE "editor_projects" DROP COLUMN "source_generation_id";--> statement-breakpoint
ALTER TABLE "node_runs" DROP COLUMN "legacy_generation_id";