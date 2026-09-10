-- DNS-level app lock through NextDNS, driven by the minutes wallet.
ALTER TABLE users ADD COLUMN nextdns_key TEXT;
ALTER TABLE users ADD COLUMN nextdns_profile TEXT;
ALTER TABLE users ADD COLUMN lock_state TEXT;          -- 'locked' | 'open' | NULL (not configured)
ALTER TABLE users ADD COLUMN lock_until TEXT;          -- ISO datetime while open
ALTER TABLE users ADD COLUMN lock_password TEXT;       -- profile removal password
ALTER TABLE users ADD COLUMN lock_error TEXT;          -- last NextDNS error, if any
