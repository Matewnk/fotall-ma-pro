# ADR-004 — Offline sync

Les mutations offline portent tenant_id, device_id, UUID local, timestamp et idempotency key.
La caisse est événementielle et les statuts de commande ne régressent pas.
