-- Unique names per brand for editable config (templates + auto-reply rules).
CREATE UNIQUE INDEX "response_templates_brandId_name_key" ON "response_templates"("brandId", "name");
CREATE UNIQUE INDEX "auto_reply_rules_brandId_name_key" ON "auto_reply_rules"("brandId", "name");
