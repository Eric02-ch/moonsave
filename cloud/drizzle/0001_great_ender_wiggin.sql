CREATE TABLE `ai_feedback_cache` (
	`user_id` text NOT NULL,
	`cache_key` text NOT NULL,
	`result` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `cache_key`)
);
--> statement-breakpoint
CREATE TABLE `ai_feedback_usage` (
	`user_id` text NOT NULL,
	`day` text NOT NULL,
	`attempts` integer NOT NULL,
	`last_started_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `day`)
);
