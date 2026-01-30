ALTER TABLE "generations" ADD COLUMN "upscale_status" text;--> statement-breakpoint
ALTER TABLE "generations" ADD COLUMN "upscale_model" text;--> statement-breakpoint
ALTER TABLE "generations" ADD COLUMN "upscale_prediction_id" text;--> statement-breakpoint
ALTER TABLE "generations" ADD COLUMN "upscaled_video_url" text;--> statement-breakpoint
ALTER TABLE "generations" ADD COLUMN "upscaled_storage_path" text;--> statement-breakpoint
ALTER TABLE "generations" ADD COLUMN "upscale_error_message" text;