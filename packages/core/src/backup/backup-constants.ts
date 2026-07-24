// Must be >= the production Neon project's own major version — pg_dump refuses outright to dump
// a server newer than itself (see the PostgreSQL docs on pg_dump version compatibility).
// The moe production project is on Postgres 18 (verified live via `neonctl projects list`,
// 2026-07-24) — this deliberately does NOT match the postgres:17-alpine image CI/local dev use
// as a Neon stand-in; that pin is unrelated to this one and tracks something different.
export const BACKUP_IMAGE = 'postgres:18-alpine';
export const CONTAINER_BACKUP_DIR = '/backups';
