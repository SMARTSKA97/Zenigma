-- Payments reported by a webhook carry the sender's own id, so a retried delivery is recorded once.
ALTER TABLE supporter_contributions ADD COLUMN external_id varchar(64);
CREATE UNIQUE INDEX ux_supporter_external ON supporter_contributions (external_id) WHERE external_id IS NOT NULL;
