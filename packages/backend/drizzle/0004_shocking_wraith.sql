CREATE TABLE "conversation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"openai_conversation_id" text NOT NULL,
	"title" text DEFAULT 'New conversation' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversation_openai_conversation_id_unique" UNIQUE("openai_conversation_id")
);
--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_conversation_user_id" ON "conversation" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_conversation_openai_id" ON "conversation" USING btree ("openai_conversation_id");--> statement-breakpoint
CREATE INDEX "idx_conversation_created_at" ON "conversation" USING btree ("created_at");