CREATE TABLE "oauth_account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" "oauth_provider" NOT NULL,
	"provider_user_id" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "oauth_account_provider_provider_user_id_unique" UNIQUE("provider","provider_user_id"),
	CONSTRAINT "oauth_account_user_id_provider_unique" UNIQUE("user_id","provider")
);
--> statement-breakpoint
ALTER TABLE "user" DROP CONSTRAINT "user_oauth_provider_oauth_provider_user_id_unique";--> statement-breakpoint
DROP INDEX "idx_user_oauth";--> statement-breakpoint
ALTER TABLE "oauth_account" ADD CONSTRAINT "oauth_account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_oauth_account_user_id" ON "oauth_account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_oauth_account_provider" ON "oauth_account" USING btree ("provider","provider_user_id");--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "oauth_provider";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "oauth_provider_user_id";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "oauth_refresh_token";