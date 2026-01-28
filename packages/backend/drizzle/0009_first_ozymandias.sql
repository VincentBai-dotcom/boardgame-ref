CREATE TYPE "public"."oauth_provider" AS ENUM('google', 'apple');--> statement-breakpoint
CREATE TABLE "email_verification_code" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"purpose" varchar(50) NOT NULL,
	"code_hash" varchar(255) NOT NULL,
	"code_salt" varchar(255) NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "oauth_provider" SET DATA TYPE "public"."oauth_provider" USING "oauth_provider"::"public"."oauth_provider";--> statement-breakpoint
CREATE INDEX "idx_email_verification_code_email" ON "email_verification_code" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_email_verification_code_hash" ON "email_verification_code" USING btree ("code_hash");--> statement-breakpoint
CREATE INDEX "idx_email_verification_code_expires" ON "email_verification_code" USING btree ("expires_at");