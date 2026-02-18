CREATE TABLE "editor_projects" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text DEFAULT 'Untitled Project' NOT NULL,
	"nodes" text DEFAULT '[]' NOT NULL,
	"edges" text DEFAULT '[]' NOT NULL,
	"viewport" text DEFAULT '{"x":0,"y":0,"zoom":1}' NOT NULL,
	"source_generation_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
