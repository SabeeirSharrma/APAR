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
