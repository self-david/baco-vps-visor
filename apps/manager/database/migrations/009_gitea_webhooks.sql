CREATE TABLE gitea_webhook_deliveries (
  delivery_id UUID PRIMARY KEY,
  event TEXT NOT NULL CHECK (event = 'push'),
  repository TEXT NOT NULL,
  ref TEXT NOT NULL,
  commit_sha TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX gitea_webhook_deliveries_received_at_idx
  ON gitea_webhook_deliveries (received_at DESC);
