CREATE TABLE "campaign_image" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" uuid NOT NULL,
	"mime" text NOT NULL,
	"bytes" "bytea" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"orphan_since" timestamp
);
--> statement-breakpoint
ALTER TABLE "campaign_image" ADD CONSTRAINT "campaign_image_campaign_id_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaign"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campaign_image_campaign_id_idx" ON "campaign_image" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "campaign_image_orphan_since_idx" ON "campaign_image" USING btree ("orphan_since");