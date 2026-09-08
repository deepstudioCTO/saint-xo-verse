ALTER TABLE "workflow_runs" ADD COLUMN "adopted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD COLUMN "adopted_at" timestamp;