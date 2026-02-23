CREATE TABLE "node_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"node_id" text NOT NULL,
	"node_type" text NOT NULL,
	"inputs" text NOT NULL,
	"outputs" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"external_id" text,
	"external_provider" text,
	"legacy_generation_id" uuid,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "workflow_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid,
	"template_version" integer,
	"template_snapshot" text NOT NULL,
	"inputs" text NOT NULL,
	"outputs" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "workflow_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text,
	"nodes" text DEFAULT '[]' NOT NULL,
	"edges" text DEFAULT '[]' NOT NULL,
	"viewport" text DEFAULT '{"x":0,"y":0,"zoom":1}',
	"thumbnail_url" text,
	"current_version" integer DEFAULT 1 NOT NULL,
	"is_published" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
