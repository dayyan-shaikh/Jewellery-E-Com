-- Cart price revalidation creates a pending quote after an expired lock rises.
ALTER TABLE price_locks
  DROP CONSTRAINT IF EXISTS price_locks_status_check;

ALTER TABLE price_locks
  ADD CONSTRAINT price_locks_status_check
  CHECK (status IN (
    'ACTIVE',
    'EXPIRED',
    'CONFIRMED',
    'PENDING_CONFIRMATION',
    'REPLACED'
  ));
