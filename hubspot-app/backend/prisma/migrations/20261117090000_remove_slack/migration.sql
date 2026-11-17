-- Slack alerts were dropped from the product; alerts go by email only.
ALTER TABLE "brands" DROP COLUMN "slackWebhookUrl";
