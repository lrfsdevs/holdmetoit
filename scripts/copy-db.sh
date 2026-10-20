#!/usr/bin/env bash
# Full PostgreSQL database copy.
#
#   ./scripts/copy-db.sh <SOURCE_URL> <TARGET_URL> [options]
#
# SOURCE may be local or hosted. TARGET must resolve to loopback only.
# See docs/database/README.md for the full operator guide.

set -Eeuo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
BACKUP_ROOT="$REPO_ROOT/backups/copy-db"

EXIT_USAGE=2
EXIT_SAFEGUARD=3
EXIT_PREFLIGHT=4
EXIT_DUMP=5
EXIT_RESTORE=6
EXIT_VERIFY=7

if [[ -t 1 ]]; then
   BOLD=$'\033[1m'
   DIM=$'\033[2m'
   RED=$'\033[31m'
   GREEN=$'\033[32m'
   YELLOW=$'\033[33m'
   RESET=$'\033[0m'
else
   BOLD="" DIM="" RED="" GREEN="" YELLOW="" RESET=""
fi

say() { printf '%s\n' "$*"; }
step() { printf '\n%s==>%s %s\n' "$BOLD" "$RESET" "$*"; }
warn() { printf '%s warning:%s %s\n' "$YELLOW" "$RESET" "$*" >&2; }
die() {
   local code="${2:-1}"
   printf '%s error:%s %s\n' "$RED" "$RESET" "$1" >&2
   exit "$code"
}

usage() {
   cat <<'EOF'
Usage: copy-db.sh <SOURCE_URL> <TARGET_URL> [options]

Copies an entire PostgreSQL database (schema, data, sequences, functions,
triggers, extensions and migration history) from SOURCE to TARGET.

The TARGET must be local: localhost, 127.0.0.0/8, ::1, or a Unix socket.
It is dropped and recreated. There is no override for this rule.

URL schemes: postgresql://, postgres://, http://, https://
(http/https are normalized to postgresql://; https implies sslmode=require)

Options:
  -y, --yes                   Skip the interactive confirmation
      --dry-run               Validate and print the plan; never connect
      --no-verify             Skip post-restore row-count verification
      --no-keep-dump          Delete the dump file after a successful copy
      --public-only           Dump only the public schema
      --exclude-schema NAME   Exclude a schema from the dump (repeatable)
      --exclude-extension NAME
                              Exclude an extension from the dump (repeatable,
                              requires pg_dump 17+)
      --ignore-restore-errors Continue to verification despite pg_restore errors
      --docker[=IMAGE]        Run pg_dump/pg_restore/psql inside Docker
                              (default image: postgres:17-alpine)
      --jobs N                Parallel restore jobs
  -v, --verbose               Verbose tool output
  -h, --help                  Show this help

Environment:
  COPY_DB_DOCKER_IMAGE        Default Docker image
  COPY_DB_CONNECT_TIMEOUT     Connection timeout in seconds (default: 15)

Exit codes:
  0 success  2 usage  3 safeguard  4 preflight
  5 dump     6 restore  7 verification
EOF
}

# ---------------------------------------------------------------------------
# Option parsing
# ---------------------------------------------------------------------------

ASSUME_YES=0
DRY_RUN=0
VERIFY=1
KEEP_DUMP=1
PUBLIC_ONLY=0
IGNORE_RESTORE_ERRORS=0
VERBOSE=0
FORCE_DOCKER=0
DOCKER_IMAGE_EXPLICIT=0
JOBS=""
DOCKER_IMAGE="${COPY_DB_DOCKER_IMAGE:-postgres:17-alpine}"
POSITIONAL=()
EXCLUDE_SCHEMAS=()
EXCLUDE_EXTENSIONS=()

while (($# > 0)); do
   case "$1" in
      -y | --yes) ASSUME_YES=1 ;;
      --dry-run) DRY_RUN=1 ;;
      --no-verify) VERIFY=0 ;;
      --no-keep-dump) KEEP_DUMP=0 ;;
      --public-only) PUBLIC_ONLY=1 ;;
      --exclude-schema)
         [[ $# -ge 2 ]] || die "--exclude-schema requires a value" "$EXIT_USAGE"
         EXCLUDE_SCHEMAS+=("$2")
         shift
         ;;
      --exclude-schema=*) EXCLUDE_SCHEMAS+=("${1#*=}") ;;
      --exclude-extension)
         [[ $# -ge 2 ]] || die "--exclude-extension requires a value" "$EXIT_USAGE"
         EXCLUDE_EXTENSIONS+=("$2")
         shift
         ;;
      --exclude-extension=*) EXCLUDE_EXTENSIONS+=("${1#*=}") ;;
      --ignore-restore-errors) IGNORE_RESTORE_ERRORS=1 ;;
      --docker) FORCE_DOCKER=1 ;;
      --docker=*)
         FORCE_DOCKER=1
         DOCKER_IMAGE_EXPLICIT=1
         DOCKER_IMAGE="${1#*=}"
         ;;
      --jobs)
         [[ $# -ge 2 ]] || die "--jobs requires a value" "$EXIT_USAGE"
         JOBS="$2"
         shift
         ;;
      --jobs=*) JOBS="${1#*=}" ;;
      -v | --verbose) VERBOSE=1 ;;
      -h | --help)
         usage
         exit 0
         ;;
      --)
         shift
         while (($# > 0)); do
            POSITIONAL+=("$1")
            shift
         done
         break
         ;;
      -*)
         die "unknown option: $1 (see --help)" "$EXIT_USAGE"
         ;;
      *)
         POSITIONAL+=("$1")
         ;;
   esac
   shift
done

if ((${#POSITIONAL[@]} != 2)); then
   usage >&2
   die "expected exactly 2 arguments: SOURCE_URL and TARGET_URL" "$EXIT_USAGE"
fi

SOURCE_URL="${POSITIONAL[0]}"
TARGET_URL="${POSITIONAL[1]}"

if [[ -n "$JOBS" ]]; then
   if ! [[ "$JOBS" =~ ^[0-9]+$ ]] || ((${JOBS:-0} < 1)); then
      die "--jobs must be a positive integer" "$EXIT_USAGE"
   fi
fi
if ((PUBLIC_ONLY && ${#EXCLUDE_SCHEMAS[@]} > 0)); then
   die "--public-only cannot be combined with --exclude-schema" "$EXIT_USAGE"
fi

# ---------------------------------------------------------------------------
# URL parsing / normalization
#
# A small embedded Node program does the parsing: it correctly handles
# percent-encoded credentials, IPv6 literals, and query strings. It prints
# shell-quoted assignments which are eval'd. Node >= 22 is required by the repo.
# ---------------------------------------------------------------------------

parse_db_url() {
   local url="$1" prefix="$2"
   DB_URL="$url" DB_PREFIX="$prefix" node --input-type=commonjs - <<'NODE'
const { DB_URL: raw, DB_PREFIX: prefix } = process.env;

function fail(msg) {
  console.error(`${prefix} URL: ${msg}`);
  process.exit(2);
}

const shellQuote = (value) =>
  "'" + String(value).replace(/'/g, "'\\''") + "'";

if (!raw || !raw.trim()) fail("is empty");
let value = raw.trim();

const schemeMatch = value.match(/^([A-Za-z][A-Za-z0-9+.-]*):\/\//);
if (!schemeMatch) {
  fail("must include a scheme (postgresql://, postgres://, http:// or https://)");
}
const scheme = schemeMatch[1].toLowerCase();
if (!["postgres", "postgresql", "http", "https"].includes(scheme)) {
  fail(`unsupported scheme "${scheme}" (use postgresql://, postgres://, http:// or https://)`);
}
const isHttps = scheme === "https";
value = "postgresql://" + value.slice(schemeMatch[0].length);

let url;
try {
  url = new URL(value);
} catch (err) {
  fail(`could not be parsed (${err.message})`);
}

const decode = (part, field) => {
  try {
    return decodeURIComponent(part);
  } catch {
    fail(`has an invalid percent-encoded ${field}`);
  }
};

const rawHostname = url.hostname;
const host = decode(rawHostname.replace(/^\[|\]$/g, ""), "host");
const port = url.port || "5432";
const user = decode(url.username, "username") || "postgres";
const password = decode(url.password, "password");
const database = decode(url.pathname.replace(/^\//, ""), "database name");

if (!database) fail("is missing a database name");

const params = url.searchParams;
const stripped = [
  "pgbouncer",
  "schema",
  "connection_limit",
  "pool_timeout",
  "socket_timeout",
  "statement_cache_size",
];
for (const key of stripped) params.delete(key);

let pgHost = host;
const hostParam = params.get("host");
if (hostParam) {
  pgHost = hostParam;
  params.delete("host");
}

const sslAllowed = [
  "disable",
  "allow",
  "prefer",
  "require",
  "verify-ca",
  "verify-full",
];
let sslmode = (params.get("sslmode") || "").toLowerCase();
if (sslmode && !sslAllowed.includes(sslmode)) {
  fail(`has invalid sslmode "${sslmode}"`);
}
params.delete("sslmode");
if (!sslmode && isHttps) sslmode = "require";

const known = {
  connect_timeout: "CONNECT_TIMEOUT",
  application_name: "APPNAME",
  sslrootcert: "SSLROOTCERT",
  sslcert: "SSLCERT",
  sslkey: "SSLKEY",
  options: "OPTIONS",
  target_session_attrs: "TARGET_SESSION_ATTRS",
};
const extra = {};
for (const [param, key] of Object.entries(known)) {
  if (params.has(param)) {
    extra[key] = params.get(param);
    params.delete(param);
  }
}

const unknown = [...params.keys()];

const emitted = {
  HOST: pgHost,
  HOST_DISPLAY: rawHostname,
  PORT: port,
  USER: user,
  PASSWORD: password,
  NAME: database,
  SSLMODE: sslmode,
  CONNECT_TIMEOUT: extra.CONNECT_TIMEOUT || "",
  APPNAME: extra.APPNAME || "",
  SSLROOTCERT: extra.SSLROOTCERT || "",
  SSLCERT: extra.SSLCERT || "",
  SSLKEY: extra.SSLKEY || "",
  OPTIONS: extra.OPTIONS || "",
  TARGET_SESSION_ATTRS: extra.TARGET_SESSION_ATTRS || "",
  WARNINGS: unknown.length
    ? `ignored unsupported URL parameter(s): ${unknown.join(", ")}`
    : "",
  REDACTED: `postgresql://${user}${password ? ":****" : ""}@${
    rawHostname || pgHost
  }:${port}/${database}`,
};

for (const [key, val] of Object.entries(emitted)) {
  console.log(`${prefix}_${key}=${shellQuote(val)}`);
}
NODE
}

step "Validating connection URLs"

parsed="$(parse_db_url "$SOURCE_URL" SRC)" || die "invalid source URL" "$EXIT_USAGE"
eval "$parsed"

parsed="$(parse_db_url "$TARGET_URL" DST)" || die "invalid target URL" "$EXIT_USAGE"
eval "$parsed"

getv() {
   local name="${1}_${2}"
   printf '%s' "${!name-}"
}

[[ -n "$(getv SRC WARNINGS)" ]] && warn "source URL: $(getv SRC WARNINGS)"
[[ -n "$(getv DST WARNINGS)" ]] && warn "target URL: $(getv DST WARNINGS)"

# ---------------------------------------------------------------------------
# Safeguards
# ---------------------------------------------------------------------------

step "Enforcing target safeguards"

normalize_host() {
   local host="$1"
   printf '%s' "${host,,}"
}

is_loopback_host() {
   local host
   host="$(normalize_host "$1")"

   [[ -z "$host" || "$host" == /* ]] && return 0
   [[ "$host" == "localhost" || "$host" == "::1" ]] && return 0

   if [[ "$host" =~ ^127\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
      return 0
   fi

   command -v getent >/dev/null 2>&1 || return 1

   local addresses address
   addresses="$(getent ahosts "$host" 2>/dev/null | awk '{print $1}' | sort -u)" || true
   [[ -n "$addresses" ]] || return 1

   while IFS= read -r address; do
      [[ -z "$address" ]] && continue
      case "$address" in
         127.* | ::1) ;;
         *) return 1 ;;
      esac
   done <<<"$addresses"

   return 0
}

DST_HOST_LC="$(normalize_host "$(getv DST HOST)")"
SRC_HOST_LC="$(normalize_host "$(getv SRC HOST)")"

# Any loopback spelling (localhost, 127.0.0.1, ::1, socket) may reach the same
# server, so collapse them before comparing source and target.
canonical_host() {
   if is_loopback_host "$1"; then
      printf 'loopback'
   else
      normalize_host "$1"
   fi
}

case "$DST_HOST_LC" in
   *.supabase.co | *.supabase.com | *.neon.tech | *.render.com | *.railway.app | *.fly.dev | *.rds.amazonaws.com | *.azure.com | *.cockroachlabs.cloud)
      die "refusing target '$(getv DST REDACTED)': target must be a local database, not a hosted provider" "$EXIT_SAFEGUARD"
      ;;
esac

if ! is_loopback_host "$(getv DST HOST)"; then
   die "refusing target '$(getv DST REDACTED)': target host must resolve to loopback (localhost, 127.0.0.0/8, ::1, or a Unix socket)" "$EXIT_SAFEGUARD"
fi

DST_NAME="$(getv DST NAME)"
case "$DST_NAME" in
   postgres | template0 | template1)
      die "refusing target database \"$DST_NAME\": reserved maintenance database" "$EXIT_SAFEGUARD"
      ;;
esac

if [[ "$(canonical_host "$(getv SRC HOST)")" == "$(canonical_host "$(getv DST HOST)")" &&
   "$(getv SRC PORT)" == "$(getv DST PORT)" &&
   "$(getv SRC NAME)" == "$DST_NAME" ]]; then
   die "source and target are the same database; refusing to overwrite the source" "$EXIT_SAFEGUARD"
fi

if [[ "$(getv SRC PORT)" == "6543" ]]; then
   die "source '$(getv SRC REDACTED)' uses port 6543 (transaction pooler), which does not support pg_dump. Use the direct connection on port 5432 (DIRECT_URL in .env)" "$EXIT_USAGE"
fi

# Connection mode. Fall back to Docker automatically when the local client
# tools are missing, which is the case on this workstation.
USE_DOCKER=$FORCE_DOCKER
if ((USE_DOCKER == 0)); then
   if ! command -v pg_dump >/dev/null 2>&1 ||
      ! command -v pg_restore >/dev/null 2>&1 ||
      ! command -v psql >/dev/null 2>&1; then
      if command -v docker >/dev/null 2>&1; then
         USE_DOCKER=1
         say "${DIM}PostgreSQL client tools not found; using Docker image $DOCKER_IMAGE${RESET}"
      else
         die "pg_dump/pg_restore/psql are missing and Docker is unavailable. Install postgresql-client (or Docker)." "$EXIT_PREFLIGHT"
      fi
   fi
fi

if ((USE_DOCKER)); then
   command -v docker >/dev/null 2>&1 || die "--docker was requested but docker is not installed" "$EXIT_PREFLIGHT"
   if [[ "$(getv SRC HOST)" == /* || "$(getv DST HOST)" == /* ]]; then
      die "Unix-socket connections are not supported in --docker mode" "$EXIT_PREFLIGHT"
   fi
fi

set_conn_env() {
   local prefix="$1"

   local conn_host conn_is_local=0
   conn_host="$(getv "$prefix" HOST)"
   if is_loopback_host "$conn_host"; then
      conn_is_local=1
      # Docker containers cannot reach the host's loopback; bridge networking
      # plus host-gateway is used instead of --network host so external DNS
      # (hosted sources) keeps working through Docker's embedded resolver.
      if ((USE_DOCKER)); then
         conn_host="host.docker.internal"
      fi
   fi
   export PGHOST="$conn_host"
   export PGPORT="$(getv "$prefix" PORT)"
   export PGUSER="$(getv "$prefix" USER)"
   export PGDATABASE="$(getv "$prefix" NAME)"
   local appname
   appname="$(getv "$prefix" APPNAME)"
   export PGAPPNAME="${appname:-holdmetoit-copy-db}"

   local password
   password="$(getv "$prefix" PASSWORD)"
   if [[ -n "$password" ]]; then
      export PGPASSWORD="$password"
   else
      unset PGPASSWORD
   fi

   local sslmode
   sslmode="$(getv "$prefix" SSLMODE)"
   if [[ -z "$sslmode" ]]; then
      if ((conn_is_local)); then
         sslmode="prefer"
      else
         sslmode="require"
      fi
   fi
   export PGSSLMODE="$sslmode"

   local connect_timeout
   connect_timeout="$(getv "$prefix" CONNECT_TIMEOUT)"
   export PGCONNECT_TIMEOUT="${connect_timeout:-${COPY_DB_CONNECT_TIMEOUT:-15}}"

   local target_attrs
   target_attrs="$(getv "$prefix" TARGET_SESSION_ATTRS)"
   if [[ -n "$target_attrs" ]]; then
      export PGTARGETSESSIONATTRS="$target_attrs"
   else
      unset PGTARGETSESSIONATTRS
   fi

   local extra value var
   for extra in SSLROOTCERT SSLCERT SSLKEY OPTIONS; do
      value="$(getv "$prefix" "$extra")"
      if [[ -n "$value" ]]; then
         var="PG${extra}"
         printf -v "$var" '%s' "$value"
         export "$var"
      else
         unset "PG${extra}"
      fi
   done
}

clear_conn_env() {
   unset PGHOST PGHOSTADDR PGPORT PGUSER PGPASSWORD PGPASSFILE PGDATABASE \
      PGSSLMODE PGREQUIRESSL PGSSLROOTCERT PGSSLCERT PGSSLKEY PGSSLCRL \
      PGSSLCRLDIR PGOPTIONS PGTARGETSESSIONATTRS PGLOADBALANCEHOSTS \
      PGREQUIREAUTH PGCONNECT_TIMEOUT PGAPPNAME
}

# Never let ambient libpq state silently retarget a connection.
clear_conn_env
unset PGSERVICE PGSERVICEFILE

run_pg() {
   local image="${RUN_PG_IMAGE:-$DOCKER_IMAGE}"
   if ((USE_DOCKER)); then
      docker run --rm \
         --add-host=host.docker.internal:host-gateway \
         --user "$(id -u):$(id -g)" \
         -e PGPASSWORD -e PGHOST -e PGPORT -e PGUSER -e PGDATABASE \
         -e PGSSLMODE -e PGCONNECT_TIMEOUT -e PGAPPNAME \
         -v "$BACKUP_ROOT:/dump" \
         "$image" "$@"
   else
      "$@"
   fi
}

# The compose database is not named "postgres", and some hosts remove it.
# template1 always exists and can run CREATE/DROP DATABASE.
select_maintenance_db() {
   local candidate
   for candidate in postgres template1; do
      export PGDATABASE="$candidate"
      if run_pg psql -X -w -q -A -t -v ON_ERROR_STOP=1 -c 'SELECT 1' >/dev/null 2>&1; then
         MAINTENANCE_DB="$candidate"
         return 0
      fi
   done
   return 1
}

# ---------------------------------------------------------------------------
# Plan confirmation
# ---------------------------------------------------------------------------

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
safe_name() { printf '%s' "$1" | tr -c 'A-Za-z0-9_.-' '_'; }
DUMP_FILE="$BACKUP_ROOT/$TIMESTAMP-$(safe_name "$(getv SRC NAME)")-to-$(safe_name "$DST_NAME").dump"
DUMP_LOG="$BACKUP_ROOT/$TIMESTAMP-dump.log"
RESTORE_LOG="$BACKUP_ROOT/$TIMESTAMP-restore.log"

if ((USE_DOCKER)); then
   CONTAINER_DUMP_FILE="/dump/$(basename "$DUMP_FILE")"
else
   CONTAINER_DUMP_FILE="$DUMP_FILE"
fi

say ""
say "${BOLD}Source${RESET}  $(getv SRC REDACTED)  ${DIM}(${SRC_HOST_LC:-socket})${RESET}"
say "${BOLD}Target${RESET}  $(getv DST REDACTED)  ${DIM}(local — will be dropped and recreated)${RESET}"
say "${BOLD}Dump${RESET}    $DUMP_FILE"
say "${BOLD}Mode${RESET}    $([[ $USE_DOCKER == 1 ]] && printf 'Docker (%s)' "$DOCKER_IMAGE" || printf 'local client tools')"

if ((DRY_RUN)); then
   step "Dry run complete — no database was contacted"
   exit 0
fi

if ((ASSUME_YES == 0)); then
   if [[ ! -t 0 ]]; then
      die "confirmation required but stdin is not a TTY; re-run with --yes" "$EXIT_USAGE"
   fi
   printf '\nThis will DROP DATABASE "%s" on the target server.\n' "$DST_NAME"
   printf 'Type the target database name to continue: '
   read -r confirmation
   [[ "$confirmation" == "$DST_NAME" ]] || die "confirmation did not match; aborted" "$EXIT_USAGE"
fi

# ---------------------------------------------------------------------------
# Server versions and client selection
#
# pg_restore 17 emits "SET transaction_timeout = 0" unconditionally, which a
# PostgreSQL 16 server rejects. Pick clients matching each server's major and
# fall back to a filtered plain-SQL restore when the target is older.
# ---------------------------------------------------------------------------

major_from_version_num() {
   [[ "$1" =~ ^[0-9]+$ ]] || return 1
   printf '%s' $(($1 / 10000))
}

step "Detecting server versions"

RUN_PG_IMAGE="$DOCKER_IMAGE"
set_conn_env SRC
src_version_num="$(run_pg psql -X -w -q -A -t -c 'SHOW server_version_num' 2>/dev/null)" ||
   die "could not connect to the source database" "$EXIT_PREFLIGHT"
SRC_MAJOR="$(major_from_version_num "$src_version_num")" ||
   die "could not determine the source server version" "$EXIT_PREFLIGHT"

set_conn_env DST
select_maintenance_db ||
   die "could not connect to the target server (tried postgres, template1)" "$EXIT_PREFLIGHT"
dst_version_num="$(run_pg psql -X -w -q -A -t -c 'SHOW server_version_num' 2>/dev/null)" ||
   die "could not determine the target server version" "$EXIT_PREFLIGHT"
DST_MAJOR="$(major_from_version_num "$dst_version_num")" ||
   die "could not determine the target server version" "$EXIT_PREFLIGHT"

if ((USE_DOCKER)) && ((DOCKER_IMAGE_EXPLICIT == 0)); then
   DUMP_IMAGE="postgres:${SRC_MAJOR}-alpine"
   RESTORE_IMAGE="postgres:${DST_MAJOR}-alpine"
else
   DUMP_IMAGE="$DOCKER_IMAGE"
   RESTORE_IMAGE="$DOCKER_IMAGE"
fi

if ((USE_DOCKER)); then
   DUMP_CLIENT_MAJOR="$SRC_MAJOR"
   RESTORE_CLIENT_MAJOR="$DST_MAJOR"
else
   DUMP_CLIENT_MAJOR="$(pg_dump --version | sed -E 's/^[^0-9]*([0-9]+).*/\1/')"
   RESTORE_CLIENT_MAJOR="$(pg_restore --version | sed -E 's/^[^0-9]*([0-9]+).*/\1/')"
   ((DUMP_CLIENT_MAJOR >= SRC_MAJOR)) ||
      die "pg_dump $DUMP_CLIENT_MAJOR cannot dump a PostgreSQL $SRC_MAJOR server; re-run with --docker" "$EXIT_PREFLIGHT"
   ((RESTORE_CLIENT_MAJOR >= SRC_MAJOR)) ||
      die "pg_restore $RESTORE_CLIENT_MAJOR cannot read a PostgreSQL $SRC_MAJOR archive; re-run with --docker" "$EXIT_PREFLIGHT"
fi

RESTORE_VIA_SQL=0
if ((RESTORE_CLIENT_MAJOR > DST_MAJOR || RESTORE_CLIENT_MAJOR < SRC_MAJOR)); then
   RESTORE_VIA_SQL=1
fi

if ((${#EXCLUDE_EXTENSIONS[@]} > 0)) && ((DUMP_CLIENT_MAJOR < 17)); then
   die "--exclude-extension requires pg_dump 17 or newer (using client $DUMP_CLIENT_MAJOR). Re-run with --docker=postgres:17-alpine" "$EXIT_PREFLIGHT"
fi

say "Source server: PostgreSQL $SRC_MAJOR"
say "Target server: PostgreSQL $DST_MAJOR"
if ((USE_DOCKER)); then
   say "Dump image:    $DUMP_IMAGE"
   say "Restore image: $RESTORE_IMAGE"
fi
if ((RESTORE_VIA_SQL)); then
   say "${DIM}Cross-major restore detected; using a filtered SQL restore.${RESET}"
   [[ -n "$JOBS" ]] && warn "--jobs is ignored for a cross-major SQL restore"
fi

# ---------------------------------------------------------------------------
# Dump
# ---------------------------------------------------------------------------

start_seconds=$SECONDS
umask 077
mkdir -p "$BACKUP_ROOT"

TMP_DIR="$(mktemp -d)"
cleanup() {
   local status=$?
   trap - EXIT INT TERM
   clear_conn_env
   [[ -n "${SQL_FILE:-}" && -f "${SQL_FILE:-}" ]] && rm -f "$SQL_FILE"
   [[ -n "${TMP_DIR:-}" && -d "${TMP_DIR:-}" ]] && rm -rf "$TMP_DIR"
   exit "$status"
}
trap cleanup EXIT INT TERM

step "Dumping source database"

RUN_PG_IMAGE="$DUMP_IMAGE"
set_conn_env SRC
dump_cmd=(
   pg_dump
   --format=custom
   --compress=9
   --no-owner
   --no-privileges
   --no-tablespaces
   --no-password
   --file "$CONTAINER_DUMP_FILE"
)

((PUBLIC_ONLY)) && dump_cmd+=(--schema=public)
for schema in "${EXCLUDE_SCHEMAS[@]}"; do
   dump_cmd+=(--exclude-schema="$schema")
done
for extension in "${EXCLUDE_EXTENSIONS[@]}"; do
   dump_cmd+=(--exclude-extension="$extension")
done

if ((VERBOSE)); then
   say "${DIM}${dump_cmd[*]}${RESET}"
fi

if ! run_pg "${dump_cmd[@]}" 2>"$DUMP_LOG"; then
   say ""
   tail -n 20 "$DUMP_LOG" >&2 || true
   die "pg_dump failed (log: $DUMP_LOG)" "$EXIT_DUMP"
fi

[[ -s "$DUMP_FILE" ]] || die "pg_dump produced no output (log: $DUMP_LOG)" "$EXIT_DUMP"
say "Dump written: $(du -h "$DUMP_FILE" | awk '{print $1}')"

# ---------------------------------------------------------------------------
# Reset target database
# ---------------------------------------------------------------------------

step "Recreating target database \"$DST_NAME\""

RUN_PG_IMAGE="$RESTORE_IMAGE"
set_conn_env DST
if ! select_maintenance_db; then
   die "could not connect to a maintenance database on the target server (tried postgres, template1)" "$EXIT_RESTORE"
fi
say "${DIM}Using maintenance database \"$MAINTENANCE_DB\"${RESET}"

sql_ident="${DST_NAME//\"/\"\"}"
sql_literal="${DST_NAME//\'/\'\'}"

if ! run_pg psql -X -w -q -v ON_ERROR_STOP=1 \
   -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$sql_literal' AND pid <> pg_backend_pid();" >/dev/null; then
   die "could not terminate existing sessions on \"$DST_NAME\"" "$EXIT_RESTORE"
fi

if ! run_pg psql -X -w -q -v ON_ERROR_STOP=1 \
   -c "DROP DATABASE IF EXISTS \"$sql_ident\" WITH (FORCE);" >/dev/null 2>&1; then
   warn "DROP DATABASE ... WITH (FORCE) failed; retrying without FORCE"
   if ! run_pg psql -X -w -q -v ON_ERROR_STOP=1 \
      -c "DROP DATABASE IF EXISTS \"$sql_ident\";" >/dev/null; then
      die "could not drop target database \"$DST_NAME\" (does the role have CREATEDB?)" "$EXIT_RESTORE"
   fi
fi

if ! run_pg psql -X -w -q -v ON_ERROR_STOP=1 \
   -c "CREATE DATABASE \"$sql_ident\";" >/dev/null; then
   die "could not create target database \"$DST_NAME\" (does the role have CREATEDB?)" "$EXIT_RESTORE"
fi

export PGDATABASE="$DST_NAME"

# ---------------------------------------------------------------------------
# Restore
# ---------------------------------------------------------------------------

step "Restoring into target"

restore_failed=0

if ((RESTORE_VIA_SQL == 0)); then
   RUN_PG_IMAGE="$RESTORE_IMAGE"
   restore_cmd=(
      pg_restore
      --no-owner
      --no-privileges
      --no-tablespaces
      --no-password
      --dbname "$DST_NAME"
   )
   [[ -n "$JOBS" ]] && restore_cmd+=(--jobs "$JOBS")
   restore_cmd+=("$CONTAINER_DUMP_FILE")

   if ! run_pg "${restore_cmd[@]}" 2>"$RESTORE_LOG"; then
      restore_failed=1
   fi
else
   # Cross-major path: expand the archive to SQL with a client that can read
   # it, strip GUCs the target server does not know, then apply with psql.
   SQL_FILE="$BACKUP_ROOT/$TIMESTAMP-restore.sql"
   if ((USE_DOCKER)); then
      SQL_FILE_ARG="/dump/$(basename "$SQL_FILE")"
   else
      SQL_FILE_ARG="$SQL_FILE"
   fi

   RUN_PG_IMAGE="$DUMP_IMAGE"
   if ! run_pg pg_restore --no-owner --no-privileges --no-tablespaces \
      --no-password --file "$SQL_FILE_ARG" "$CONTAINER_DUMP_FILE" 2>>"$RESTORE_LOG"; then
      restore_failed=1
   fi

   if ((restore_failed == 0)); then
      sed -E '/^SET transaction_timeout = 0;$/d' "$SQL_FILE" >"$SQL_FILE.filtered"
      mv "$SQL_FILE.filtered" "$SQL_FILE"
      RUN_PG_IMAGE="$RESTORE_IMAGE"
      set_conn_env DST
      export PGDATABASE="$DST_NAME"
      if ! run_pg psql -X -w -q -v ON_ERROR_STOP=0 -f "$SQL_FILE_ARG" >>"$RESTORE_LOG" 2>&1; then
         restore_failed=1
      fi
      if grep -qE '(^|: )ERROR:' "$RESTORE_LOG"; then
         restore_failed=1
      fi
      rm -f "$SQL_FILE"
   fi
fi

if ((restore_failed != 0)); then
   say ""
   say "${YELLOW}Restore reported errors:${RESET}"
   grep -m 20 -E 'pg_restore: error:|(^|: )ERROR:' "$RESTORE_LOG" >&2 ||
      tail -n 20 "$RESTORE_LOG" >&2 || true
   say "${DIM}Full log: $RESTORE_LOG${RESET}"
   if grep -qiE 'extension|schema "(auth|storage|extensions|realtime|vault)"' "$RESTORE_LOG"; then
      say "${DIM}Hint: hosted-internal schemas/extensions may not exist locally. Retry with --public-only for an application-data copy.${RESET}"
   fi
   if ((IGNORE_RESTORE_ERRORS == 0)); then
      die "restore failed (use --ignore-restore-errors to verify the partial copy)" "$EXIT_RESTORE"
   fi
   warn "continuing despite restore errors (--ignore-restore-errors)"
fi

# ---------------------------------------------------------------------------
# Verification
# ---------------------------------------------------------------------------

if ((VERIFY)); then
   step "Verifying row counts"

   if ((PUBLIC_ONLY)); then
      schema_filter="schemaname = 'public'"
   elif ((${#EXCLUDE_SCHEMAS[@]} > 0)); then
      excluded=""
      for schema in "${EXCLUDE_SCHEMAS[@]}"; do
         excluded+="${excluded:+,}'${schema//\'/\'\'}'"
      done
      schema_filter="schemaname NOT IN ($excluded)"
   else
      schema_filter="TRUE"
   fi

   verify_sql="
WITH t AS (
  SELECT format('%I.%I', schemaname, relname) AS fqtn
  FROM pg_stat_user_tables
  WHERE $schema_filter
)
SELECT fqtn || E'\t' || ((xpath('/row/c/text()', query_to_xml('SELECT count(*) AS c FROM ' || fqtn, false, true, '')))[1]::text)::bigint
FROM t
ORDER BY fqtn;"

   set_conn_env SRC
   RUN_PG_IMAGE="$DUMP_IMAGE"
   if ! run_pg psql -X -w -q -A -t -F $'\t' -v ON_ERROR_STOP=1 -c "$verify_sql" >"$TMP_DIR/source-counts" 2>"$TMP_DIR/source-counts.err"; then
      tail -n 20 "$TMP_DIR/source-counts.err" >&2 || true
      die "could not read table counts from the source" "$EXIT_VERIFY"
   fi

   set_conn_env DST
   RUN_PG_IMAGE="$RESTORE_IMAGE"
   if ! run_pg psql -X -w -q -A -t -F $'\t' -v ON_ERROR_STOP=1 -c "$verify_sql" >"$TMP_DIR/target-counts" 2>"$TMP_DIR/target-counts.err"; then
      tail -n 20 "$TMP_DIR/target-counts.err" >&2 || true
      die "could not read table counts from the target" "$EXIT_VERIFY"
   fi

   if ! diff -u "$TMP_DIR/source-counts" "$TMP_DIR/target-counts" >"$TMP_DIR/counts.diff"; then
      say ""
      say "${RED}Row-count verification failed:${RESET}"
      head -n 60 "$TMP_DIR/counts.diff" >&2 || true
      die "source and target do not match (use --no-verify to skip)" "$EXIT_VERIFY"
   fi

   summary="$(awk -F'\t' '{tables++; rows += $2} END {printf "%d tables, %d rows", tables, rows}' "$TMP_DIR/source-counts")"
   say "${GREEN}Verified:${RESET} $summary match exactly"
fi

# ---------------------------------------------------------------------------
# Finish
# ---------------------------------------------------------------------------

if ((KEEP_DUMP == 0)); then
   rm -f "$DUMP_FILE"
   rm -f "$DUMP_LOG"
fi
rm -f "$RESTORE_LOG"

elapsed=$((SECONDS - start_seconds))
step "Done in ${elapsed}s"
say "Target: $(getv DST REDACTED)"
if ((KEEP_DUMP)); then
   say "Dump:   $DUMP_FILE ${DIM}(contains a full copy of your data; backups/ is gitignored)${RESET}"
fi
say "Inspect: psql -h $(getv DST HOST) -p $(getv DST PORT) -U $(getv DST USER) -d $DST_NAME"
