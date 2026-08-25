CREATE TABLE `applications` (
	`id` text PRIMARY KEY NOT NULL,
	`position_id` text NOT NULL,
	`applicant_filename` text NOT NULL,
	`resume_pdf` text NOT NULL,
	`resume_text` text NOT NULL,
	`criteria_snapshot` text NOT NULL,
	`status` text NOT NULL,
	`assigned_user_id` text,
	`assigned_at_ms` integer,
	`viewed_at_ms` integer,
	`created_at_ms` integer NOT NULL,
	FOREIGN KEY (`position_id`) REFERENCES `positions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`assigned_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `position_pool` (
	`position_id` text NOT NULL,
	`interviewer_id` text NOT NULL,
	FOREIGN KEY (`position_id`) REFERENCES `positions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`interviewer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `position_pool_pair_unique` ON `position_pool` (`position_id`,`interviewer_id`);--> statement-breakpoint
CREATE TABLE `positions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`criteria` text NOT NULL,
	`provider` text NOT NULL,
	`openrouter_api_key` text,
	`openrouter_model` text,
	`ollama_endpoint` text,
	`ollama_model` text,
	`verifier_model_override` text,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `results` (
	`application_id` text PRIMARY KEY NOT NULL,
	`overall_verdict` text NOT NULL,
	`summary` text NOT NULL,
	`per_criterion_json` text NOT NULL,
	`strengths_json` text NOT NULL,
	`concerns_json` text NOT NULL,
	`confidence` text NOT NULL,
	`attempts` integer NOT NULL,
	`verification_issues_json` text NOT NULL,
	`provider` text NOT NULL,
	`main_model` text NOT NULL,
	`verifier_model` text NOT NULL,
	`duration_ms` integer NOT NULL,
	`result_created_at_ms` integer NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at_ms` integer NOT NULL,
	`expires_at_ms` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`role` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);