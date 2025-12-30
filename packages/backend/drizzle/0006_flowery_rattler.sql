DROP INDEX "idx_game_name";--> statement-breakpoint
CREATE INDEX "idx_game_name_trgm" ON "game" USING gin ("name" gin_trgm_ops);