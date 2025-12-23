ALTER TABLE "game" DROP CONSTRAINT "game_name_unique";--> statement-breakpoint
DROP INDEX "idx_game_bgg_id";--> statement-breakpoint
ALTER TABLE "game" ALTER COLUMN "bgg_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "rulebook" ALTER COLUMN "rulebook_type" SET DEFAULT 'base';--> statement-breakpoint
CREATE INDEX "idx_game_bgg_id" ON "game" USING btree ("bgg_id");--> statement-breakpoint
ALTER TABLE "game" ADD CONSTRAINT "year_published_check" CHECK ("game"."year_published" IS NULL OR ("game"."year_published" >= 1900 AND "game"."year_published" <= 2100));