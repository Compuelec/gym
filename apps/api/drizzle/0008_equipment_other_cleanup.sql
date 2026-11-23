-- "Otro equipo" used to cover anything (sled, plates, bars…). It is now split into specific
-- equipment and "other" only means strongman/rare implements, so old selections are removed;
-- the new server version makes every device pull the change.
UPDATE "locations" SET "equipment" = array_remove("equipment", 'other'), "updated_at" = now(), "server_version" = nextval('sync_version_seq') WHERE 'other' = ANY("equipment");
