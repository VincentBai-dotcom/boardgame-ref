CREATE TYPE "public"."chat_provider" AS ENUM('openai-agents-sdk', 'anthropic');--> statement-breakpoint
CREATE TYPE "public"."rulebook_type" AS ENUM('base', 'expansion', 'quickstart', 'reference', 'faq', 'other');--> statement-breakpoint
CREATE TABLE "message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"content" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversation" DROP CONSTRAINT "conversation_openai_conversation_id_unique";--> statement-breakpoint
ALTER TABLE "rulebook" DROP CONSTRAINT "rulebook_type_check";--> statement-breakpoint
DROP INDEX "idx_conversation_openai_id";--> statement-breakpoint
ALTER TABLE "rulebook" ALTER COLUMN "rulebook_type" SET DEFAULT 'base'::"public"."rulebook_type";--> statement-breakpoint
ALTER TABLE "rulebook" ALTER COLUMN "rulebook_type" SET DATA TYPE "public"."rulebook_type" USING "rulebook_type"::"public"."rulebook_type";--> statement-breakpoint
ALTER TABLE "conversation" ADD COLUMN "provider" "chat_provider" NOT NULL;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_message_conversation_id" ON "message" USING btree ("conversation_id");--> statement-breakpoint
ALTER TABLE "conversation" DROP COLUMN "openai_conversation_id";