ALTER TABLE "looks" ADD COLUMN "style_preset" text;--> statement-breakpoint
ALTER TABLE "looks" ADD COLUMN "style_strength" real;--> statement-breakpoint
ALTER TABLE "looks" ADD COLUMN "seed" integer;--> statement-breakpoint
ALTER TABLE "looks" ADD COLUMN "aspect_ratio" text;--> statement-breakpoint
ALTER TABLE "looks" ADD COLUMN "resolution" text;--> statement-breakpoint
ALTER TABLE "looks" ADD COLUMN "batch_size" integer;--> statement-breakpoint
ALTER TABLE "looks" ADD COLUMN "enhance_prompt" boolean;