#!/usr/bin/env bash
# Provisioning Storage Area multi-provider (bucket per user, privasi penuh).
#
# Jalankan sebagai www-data di host Nextcloud:
#   sudo -u www-data /path/website-2/deploy/nextcloud-storage-sync.sh /path/website-2/storage
#
# Input:
#   <storage-dir>/nextcloud-mounts.json — ditulis otomatis backend website:
#     {"s3": {...legacy...},
#      "providers": {"<nama>": {"type": "s3-admin|cloudflare|b2", "s3": {...}, ...}},
#      "managed_groups": [...],
#      "users": {"fb_1": {
#          "mounts":              [{name, group, bucket, provider, credentials_key, expires_at}],
#          "retained_buckets":    [{bucket, provider} | "bucket-lama"],
#          "decommission_buckets":[{bucket, provider} | "bucket-lama"],
#          "groups": [...], "home_quota": "10 MB"
#      }}}
#   <storage-dir>/s3-credentials.json — access key per user per provider
#
# Provider type:
#   s3-admin   — MinIO/RustFS: mc alias + mc admin user/policy
#                (env admin: MINIO_ROOT_USER / MINIO_ROOT_PASSWORD,
#                 atau admin_user_env/admin_pass_env di config provider)
#   cloudflare — Cloudflare R2: bucket & token via Cloudflare API
#                (env: CLOUDFLARE_API_TOKEN, R2_ACCOUNT_ID)
#   b2         — Backblaze B2: native B2 API
#                (env: B2_KEY_ID, B2_APP_KEY, opsional B2_API_URL)
#
# Environment opsional:
#   NC_DIR, MC, PROVIDER_PHP, MINIO_ENDPOINT

set -euo pipefail

STORAGE_DIR="$(cd "${1:?Usage: $0 <website-storage-dir>}" && pwd)"
NC_DIR="${NC_DIR:-/var/www/nextcloud}"
MC="${MC:-mc}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROVIDER_PHP="${PROVIDER_PHP:-$SCRIPT_DIR/storage-provider.php}"
SPEC="$STORAGE_DIR/nextcloud-mounts.json"
CREDS="$STORAGE_DIR/s3-credentials.json"
WORK="$(mktemp -d)"
MC_CFG=""

cleanup() { rm -rf "$WORK" ${MC_CFG:+"$MC_CFG"}; }
trap cleanup EXIT

[ -f "$SPEC" ] || { echo "Spec tidak ditemukan: $SPEC"; exit 1; }
command -v php >/dev/null || { echo "php CLI dibutuhkan"; exit 1; }
command -v "$MC" >/dev/null || { echo "mc (MinIO client) tidak ditemukan: $MC"; exit 1; }
[ -f "$CREDS" ] || echo '{}' > "$CREDS"

# Normalisasi spec → file kerja per jenis data
php -r '
    $spec = json_decode(file_get_contents($argv[1]), true);
    $w = $argv[2];

    $providers = $spec["providers"] ?? [];
    if (!is_array($providers) || $providers === []) {
        $providers = ["default" => ["type" => "s3-admin", "s3" => $spec["s3"] ?? []]];
    }
    file_put_contents("$w/providers.json", json_encode($providers));

    $norm = function ($x) {
        if (is_string($x)) { return ["bucket" => $x, "provider" => "default"]; }
        if (is_array($x)) {
            return ["bucket" => (string) ($x["bucket"] ?? ""),
                    "provider" => (string) ($x["provider"] ?? "default")];
        }
        return null;
    };

    $buckets = fopen("$w/buckets.tsv", "w");
    $mounts  = fopen("$w/mounts.tsv", "w");
    $creds   = fopen("$w/creds.tsv", "w");
    $groups  = fopen("$w/groups.tsv", "w");
    $users   = fopen("$w/users.txt", "w");

    foreach (($spec["users"] ?? []) as $u => $e) {
        fwrite($users, "$u\n");
        if (!is_array($e)) { continue; }
        $mList = is_array($e["mounts"] ?? null) ? $e["mounts"] : [];
        foreach ($mList as $m) {
            if (!is_array($m) || empty($m["bucket"])) { continue; }
            $p = (string) ($m["provider"] ?? "default");
            fwrite($buckets, "KEEP\t$p\t" . $m["bucket"] . "\n");
            fwrite($mounts, "MOUNT\t$u\t" . ($m["name"] ?? $m["bucket"]) . "\t"
                . $m["bucket"] . "\t$p\t" . ($m["credentials_key"] ?? $u) . "\n");
        }
        foreach ((array) ($e["retained_buckets"] ?? []) as $r) {
            $n = $norm($r);
            if ($n && $n["bucket"] !== "") { fwrite($buckets, "KEEP\t{$n["provider"]}\t{$n["bucket"]}\n"); }
        }
        foreach ((array) ($e["decommission_buckets"] ?? []) as $d) {
            $n = $norm($d);
            if ($n && $n["bucket"] !== "") { fwrite($buckets, "DECOM\t{$n["provider"]}\t{$n["bucket"]}\n"); }
        }
        $byProv = [];
        foreach ($mList as $m) {
            if (!is_array($m) || empty($m["bucket"])) { continue; }
            $byProv[(string) ($m["provider"] ?? "default")][] = $m["bucket"];
        }
        foreach ($byProv as $p => $bs) {
            fwrite($creds, "CREDS\t$u\t$p\t" . implode(",", array_unique($bs)) . "\n");
        }
    }

    $managed = array_map("strval", (array) ($spec["managed_groups"] ?? []));
    fwrite($groups, "MANAGED\t" . implode(",", $managed) . "\n");
    foreach (($spec["users"] ?? []) as $u => $e) {
        if (!is_array($e)) { continue; }
        $hasGroups = isset($e["groups"]) && is_array($e["groups"]);
        $hasQuota = isset($e["home_quota"]) && is_string($e["home_quota"]) && $e["home_quota"] !== "";
        if (!$hasGroups && !$hasQuota) { continue; }
        $g = $hasGroups ? implode(",", array_map("strval", $e["groups"])) : "";
        $q = $hasQuota ? $e["home_quota"] : "";
        fwrite($groups, "USER\t$u\t$g\t$q\n");
    }
    fclose($buckets); fclose($mounts); fclose($creds); fclose($groups); fclose($users);
' "$SPEC" "$WORK"

# Helper: ambil field dari providers.json
prov_json() { # $1=provider → cetak JSON provider tsb
    php -r '$p=json_decode(file_get_contents($argv[1]),true); echo json_encode($p[$argv[2]]??[]);' \
        "$WORK/providers.json" "$1"
}
prov_type() { prov_json "$1" | php -r '$p=json_decode(stream_get_contents(STDIN),true); echo $p["type"]??"s3-admin";'; }
prov_s3_field() { # $1=provider $2=field (hostname|region|use_ssl|use_path_style)
    prov_json "$1" | php -r '$p=json_decode(stream_get_contents(STDIN),true); $s=$p["s3"]??[]; echo $s[$argv[1]]??"";' "$2"
}
# port diturunkan dari hostname seperti sebelumnya
prov_endpoint() { # $1=provider → "scheme://host" untuk mc alias
    local host ssl port
    host="$(prov_s3_field "$1" hostname)"
    ssl="$(prov_s3_field "$1" use_ssl)"
    [ "$ssl" = "1" ] || [ "$ssl" = "true" ] && scheme="https" || scheme="http"
    port="$(printf '%s' "$host" | sed -n 's/.*:\([0-9]*\)$/\1/p')"
    [ -n "$port" ] || port=$([ "$scheme" = "https" ] && echo 443 || echo 80)
    host="$(printf '%s' "$host" | sed 's/:[0-9]*$//')"
    echo "$scheme://$host:$port"
}
prov_admin_env() { # $1=provider $2=field (user|pass) → nama env var
    local def_user="MINIO_ROOT_USER" def_pass="MINIO_ROOT_PASSWORD"
    prov_json "$1" | php -r '$p=json_decode(stream_get_contents(STDIN),true); echo $p[$argv[1]]??"";' \
        "admin_${2}_env" | { read -r v; echo "${v:-$([ "$2" = user ] && echo $def_user || echo $def_pass)}"; }
}

# mc butuh config-dir writable — www-data tidak punya home config.
MC_CFG="$(mktemp -d)"
chmod 700 "$MC_CFG"
MC=("$MC" --config-dir "$MC_CFG")

# mc alias per provider s3-admin: pv-<name>
declare -A MC_ALIAS=()
for prov in $(php -r '$p=json_decode(file_get_contents($argv[1]),true); echo implode("\n",array_keys($p));' "$WORK/providers.json"); do
    [ "$(prov_type "$prov")" = "s3-admin" ] || continue
    alias_name="pv-$prov"
    endpoint="$(prov_endpoint "$prov")"
    user_env="$(prov_admin_env "$prov" user)"; pass_env="$(prov_admin_env "$prov" pass)"
    user_val="${!user_env:-}"; pass_val="${!pass_env:-}"
    if [ -z "$user_val" ] || [ -z "$pass_val" ]; then
        echo "   !! provider $prov: env $user_env/$pass_env kosong — bucket via mc dilewati"
        continue
    fi
    "${MC[@]}" alias set "$alias_name" "$endpoint" "$user_val" "$pass_val" >/dev/null 2>&1 \
        && MC_ALIAS[$prov]="$alias_name" \
        || echo "   !! gagal set mc alias $alias_name ($endpoint)"
done

# --- 1. bucket: decommission dulu, lalu keep ---
sort -u "$WORK/buckets.tsv" > "$WORK/buckets-sorted.tsv"
while IFS=$'\t' read -r ACTION PROVIDER BUCKET; do
    [ -n "${BUCKET:-}" ] || continue
    ptype="$(prov_type "$PROVIDER")"
    case "$ptype" in
        cloudflare|b2)
            if [ "$ACTION" = "DECOM" ]; then
                php "$PROVIDER_PHP" "$SPEC" "$PROVIDER" remove-bucket "$BUCKET" >/dev/null 2>&1 \
                    && echo "bucket $BUCKET ($PROVIDER) dihapus (grace habis)" \
                    || echo "   GAGAL menghapus bucket $BUCKET ($PROVIDER)"
            else
                php "$PROVIDER_PHP" "$SPEC" "$PROVIDER" ensure-bucket "$BUCKET" >/dev/null 2>&1 \
                    && echo "bucket $BUCKET ($PROVIDER) siap" \
                    || echo "   GAGAL menyiapkan bucket $BUCKET ($PROVIDER)"
            fi
            ;;
        *)
            alias_name="${MC_ALIAS[$PROVIDER]:-}"
            [ -n "$alias_name" ] || { echo "   !! skip bucket $BUCKET ($PROVIDER): tidak ada mc alias"; continue; }
            if [ "$ACTION" = "DECOM" ]; then
                if "${MC[@]}" ls "$alias_name/$BUCKET" >/dev/null 2>&1; then
                    "${MC[@]}" rb --force "$alias_name/$BUCKET" >/dev/null 2>&1 \
                        && echo "bucket $BUCKET ($PROVIDER) dihapus (grace habis)" \
                        || echo "   GAGAL menghapus bucket $BUCKET ($PROVIDER)"
                else
                    echo "bucket $BUCKET ($PROVIDER) sudah tidak ada"
                fi
            else
                if "${MC[@]}" ls "$alias_name/$BUCKET" >/dev/null 2>&1; then
                    echo "bucket $BUCKET ($PROVIDER) sudah ada"
                else
                    "${MC[@]}" mb "$alias_name/$BUCKET" >/dev/null 2>&1 \
                        && echo "bucket $BUCKET ($PROVIDER) dibuat" \
                        || echo "   GAGAL membuat bucket $BUCKET ($PROVIDER)"
                fi
            fi
            ;;
    esac
done < "$WORK/buckets-sorted.tsv"

# --- 2. kredensial per user × provider ---
# himpunan aktif user|provider
ACTIVE_UP="$(awk -F'\t' '$1=="CREDS"{print $2"|"$3}' "$WORK/creds.tsv" | sort -u)"

creds_get() { # $1=user $2=provider $3=field → access_key|secret_key (fallback minio/default/legacy)
    php -r '
        $c=json_decode(file_get_contents($argv[1]),true);
        $u=$argv[2]; $p=$argv[3]; $f=$argv[4];
        $e=$c[$u][$p] ?? $c[$u]["minio"] ?? $c[$u]["default"] ?? null;
        if (!is_array($e) || !isset($e[$f])) {
            // legacy flat {user:{access_key,secret_key}} — hanya untuk provider minio/default
            if (in_array($p, ["minio","default","s3-admin"], true)) { $e=$c[$u] ?? null; }
        }
        echo is_array($e) ? ($e[$f] ?? "") : "";
    ' "$CREDS" "$1" "$2" "$3"
}

# 2a. provider non-s3-admin: ensure/revoke via helper PHP
while IFS=$'\t' read -r _ NC_USER PROVIDER BUCKETS_CSV; do
    [ -n "${NC_USER:-}" ] || continue
    ptype="$(prov_type "$PROVIDER")"
    case "$ptype" in
        cloudflare|b2)
            out="$(php "$PROVIDER_PHP" "$SPEC" "$PROVIDER" ensure-credentials "$NC_USER" "$BUCKETS_CSV" 2>&1)" \
                && echo "   kredensial $NC_USER/$PROVIDER siap" \
                || echo "   GAGAL kredensial $NC_USER/$PROVIDER: $out"
            ;;
    esac
done < "$WORK/creds.tsv"

# 2b. revoke: user|provider di creds file tapi tidak aktif
php -r '
    $c=json_decode(file_get_contents($argv[1]),true)?:[];
    $active=array_flip(explode("\n",trim($argv[2])));
    foreach($c as $u=>$provs){
        if(!is_array($provs)) continue;
        foreach($provs as $p=>$e){
            if(is_array($e) && !isset($active[$u."|".$p])) echo "$u\t$p\n";
        }
        // legacy flat entry
        if(isset($provs["access_key"]) && !isset($active[$u."|minio"]) && !isset($active[$u."|default"])){
            echo "$u\tminio\n";
        }
    }
' "$CREDS" "$ACTIVE_UP" | while IFS=$'\t' read -r NC_USER PROVIDER; do
    [ -n "$NC_USER" ] || continue
    ptype="$(prov_type "$PROVIDER")"
    case "$ptype" in
        cloudflare|b2)
            php "$PROVIDER_PHP" "$SPEC" "$PROVIDER" revoke-credentials "$NC_USER" >/dev/null 2>&1 \
                && echo "   akses $NC_USER/$PROVIDER dicabut" || true
            ;;
        *)
            alias_name="${MC_ALIAS[$PROVIDER]:-}"
            [ -n "$alias_name" ] || continue
            AK="$(creds_get "$NC_USER" "$PROVIDER" access_key)"
            [ -n "$AK" ] || continue
            "${MC[@]}" admin policy detach "$alias_name" "$NC_USER-$PROVIDER-policy" --user "$AK" >/dev/null 2>&1 || true
            "${MC[@]}" admin policy remove "$alias_name" "$NC_USER-$PROVIDER-policy" >/dev/null 2>&1 || true
            "${MC[@]}" admin user remove "$alias_name" "$AK" >/dev/null 2>&1 || true
            echo "   akses minio $NC_USER/$PROVIDER dicabut (tidak ada paket aktif)"
            ;;
    esac
done

# 2c. s3-admin: pastikan user minio + policy untuk CREDS aktif
while IFS=$'\t' read -r _ NC_USER PROVIDER BUCKETS_CSV; do
    [ -n "${NC_USER:-}" ] || continue
    [ "$(prov_type "$PROVIDER")" = "s3-admin" ] || continue
    alias_name="${MC_ALIAS[$PROVIDER]:-}"
    [ -n "$alias_name" ] || { echo "   !! skip creds $NC_USER/$PROVIDER: tidak ada mc alias"; continue; }

    # hanya bucket dengan mount aktif yang masuk policy
    ACTIVE_BUCKETS="$(awk -F'\t' -v u="$NC_USER" -v p="$PROVIDER" '$1=="MOUNT" && $2==u && $5==p {print $4}' "$WORK/mounts.tsv" | sort -u | tr '\n' ' ')"

    POLICY_JSON="$(mktemp)"
    php -r '
        $buckets = array_filter(explode(" ", $argv[1]));
        if (!$buckets) { echo "{}"; exit; }
        $arns = array_map(fn($b) => "arn:aws:s3:::" . $b, $buckets);
        $arnsObj = array_map(fn($b) => "arn:aws:s3:::" . $b . "/*", $buckets);
        echo json_encode([
            "Version" => "2012-10-17",
            "Statement" => [[
                "Effect" => "Allow",
                "Action" => ["s3:ListBucket", "s3:GetBucketLocation", "s3:ListBucketMultipartUploads"],
                "Resource" => $arns,
            ], [
                "Effect" => "Allow",
                "Action" => ["s3:*"],
                "Resource" => $arnsObj,
            ]],
        ], JSON_PRETTY_PRINT);
    ' "$ACTIVE_BUCKETS" > "$POLICY_JSON"
    HAS_POLICY="$(php -r '$p=json_decode(file_get_contents($argv[1]),true); echo empty($p["Statement"] ?? null) ? "0" : "1";' "$POLICY_JSON")"

    ACCESS_KEY="$(creds_get "$NC_USER" "$PROVIDER" access_key)"
    SECRET_KEY="$(creds_get "$NC_USER" "$PROVIDER" secret_key)"

    if ! "${MC[@]}" admin user info "$alias_name" "$ACCESS_KEY" >/dev/null 2>&1; then
        if [ -z "$ACCESS_KEY" ]; then
            MOUNT_USER="${NC_USER//_/-}"
            ACCESS_KEY="$MOUNT_USER-$(head -c4 /dev/urandom | od -An -tx1 | tr -d ' \n')"
            SECRET_KEY="$(head -c24 /dev/urandom | od -An -tx1 | tr -d ' \n')"
        fi
        if "${MC[@]}" admin user add "$alias_name" "$ACCESS_KEY" "$SECRET_KEY" >/dev/null 2>&1; then
            php -r '
                $f=$argv[1]; $u=$argv[2]; $p=$argv[3]; $ak=$argv[4]; $sk=$argv[5];
                $c=is_file($f)?json_decode(file_get_contents($f),true):[];
                $c[$u][$p]=["access_key"=>$ak,"secret_key"=>$sk];
                file_put_contents($f, json_encode($c, JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES));
            ' "$CREDS" "$NC_USER" "$PROVIDER" "$ACCESS_KEY" "$SECRET_KEY"
            echo "   minio user $ACCESS_KEY dibuat untuk $NC_USER/$PROVIDER"
        else
            echo "   GAGAL: minio user add $ACCESS_KEY untuk $NC_USER/$PROVIDER"
            rm -f "$POLICY_JSON"; continue
        fi
    fi

    POLICY_NAME="$NC_USER-$PROVIDER-policy"
    if [ "$HAS_POLICY" = "0" ]; then
        "${MC[@]}" admin policy detach "$alias_name" "$POLICY_NAME" --user "$ACCESS_KEY" >/dev/null 2>&1 || true
        "${MC[@]}" admin policy remove "$alias_name" "$POLICY_NAME" >/dev/null 2>&1 || true
        "${MC[@]}" admin user remove "$alias_name" "$ACCESS_KEY" >/dev/null 2>&1 || true
        echo "   akses $NC_USER/$PROVIDER dicabut (tidak ada bucket aktif)"
        rm -f "$POLICY_JSON"; continue
    fi

    if "${MC[@]}" admin policy info "$alias_name" "$POLICY_NAME" >/dev/null 2>&1; then
        "${MC[@]}" admin policy detach "$alias_name" "$POLICY_NAME" --user "$ACCESS_KEY" >/dev/null 2>&1 || true
        "${MC[@]}" admin policy remove "$alias_name" "$POLICY_NAME" >/dev/null \
            || { echo "   GAGAL: policy remove $POLICY_NAME"; rm -f "$POLICY_JSON"; continue; }
    fi
    "${MC[@]}" admin policy create "$alias_name" "$POLICY_NAME" "$POLICY_JSON" >/dev/null \
        || { echo "   GAGAL: policy create $POLICY_NAME"; rm -f "$POLICY_JSON"; continue; }
    "${MC[@]}" admin policy attach "$alias_name" "$POLICY_NAME" --user "$ACCESS_KEY" >/dev/null \
        || { echo "   GAGAL: policy attach $POLICY_NAME"; rm -f "$POLICY_JSON"; continue; }
    rm -f "$POLICY_JSON"
    echo "   policy $POLICY_NAME terpasang untuk $NC_USER/$PROVIDER"
done < "$WORK/creds.tsv"

# --- 3. mount Nextcloud ---
cd "$NC_DIR"
OCC="php occ"
$OCC config:system:set defaultapp --value=files >/dev/null 2>&1 || true

# --- 3a. cabut mount yang tidak lagi diinginkan / salah provider ---
# Signature mount: mount_point|bucket|hostname|port
# Iterasi SEMUA user di spec — user tanpa mount aktif kehilangan semua mount S3.
sort -u "$WORK/users.txt" | while read -r NC_USER; do
    [ -n "$NC_USER" ] || continue
    # signature yang diinginkan user ini; provider tanpa hostname = belum
    # dikonfigurasi → cabut mount user ini ditunda demi keamanan.
    UNCONFIGURED=0
    DESIRED="$(awk -F'\t' -v u="$NC_USER" '$2==u {print "/" $3 "|" $4 "|" $5}' "$WORK/mounts.tsv" \
        | while IFS='|' read -r MP BUCKET PROVIDER; do
        host_raw="$(prov_s3_field "$PROVIDER" hostname)"
        [ -z "$host_raw" ] && continue
        host="$(printf '%s' "$host_raw" | sed 's/:[0-9]*$//')"
        port="$(printf '%s' "$host_raw" | sed -n 's/.*:\([0-9]*\)$/\1/p')"
        if [ -z "$port" ]; then
            ssl="$(prov_s3_field "$PROVIDER" use_ssl)"
            { [ "$ssl" = "1" ] || [ "$ssl" = "true" ]; } && port=443 || port=80
        fi
        echo "$MP|$BUCKET|$host|$port"
    done)"
    # deteksi provider kosong via mounts.tsv user ini (field ke-5 = provider)
    while IFS= read -r PROVIDER; do
        [ -n "$PROVIDER" ] || continue
        [ -z "$(prov_s3_field "$PROVIDER" hostname)" ] && UNCONFIGURED=1 && break
    done < <(awk -F'\t' -v u="$NC_USER" '$2==u {print $5}' "$WORK/mounts.tsv")
    if [ "$UNCONFIGURED" = "1" ]; then
        echo "   !! $NC_USER: ada provider belum dikonfigurasi (hostname kosong) — pencabutan mount dilewati"
        continue
    fi

    # mounts existing user (hanya S3): mount_id \t mp \t bucket \t host \t port
    php -r '
        $out = shell_exec("php occ files_external:list " . escapeshellarg($argv[1]) . " --output=json --show-password 2>/dev/null");
        $rows = json_decode((string)$out, true);
        foreach ((array)$rows as $r) {
            $cls = (string)($r["storage"] ?? "");
            if (stripos($cls, "S3") === false) continue;
            $cfg = (array)($r["configuration"] ?? []);
            echo $r["mount_id"], "\t", $r["mount_point"], "\t", ($cfg["bucket"] ?? ""), "\t",
                 ($cfg["hostname"] ?? ""), "\t", ($cfg["port"] ?? ""), "\n";
        }
    ' "$NC_USER" 2>/dev/null | { SEEN=""; while IFS=$'\t' read -r MID MP EBUCKET EHOST EPORT; do
        [ -n "$MID" ] || continue
        ESIG="$MP|$EBUCKET|$EHOST|$EPORT"
        if ! printf '%s\n' "$DESIRED" | grep -qxF "$ESIG"; then
            php occ files_external:delete "$MID" --yes >/dev/null 2>&1 \
                && echo "   mount id=$MID dicabut dari $NC_USER (tidak sesuai spec)" \
                || echo "   GAGAL mencabut mount id=$MID"
            continue
        fi
        # signature cocok spec — pertahankan satu, hapus duplikat
        if printf '%s\n' "$SEEN" | grep -qxF "$ESIG"; then
            php occ files_external:delete "$MID" --yes >/dev/null 2>&1 \
                && echo "   mount duplikat id=$MID dicabut dari $NC_USER" \
                || echo "   GAGAL mencabut duplikat id=$MID"
        else
            SEEN="$SEEN$ESIG"$'\n'
        fi
    done; }
done

# --- 3b. buat mount yang diinginkan ---
while IFS=$'\t' read -r _ NC_USER MOUNT_NAME BUCKET PROVIDER CRED_KEY; do
    [ -n "$NC_USER" ] || continue
    ACCESS_KEY="$(creds_get "$CRED_KEY" "$PROVIDER" access_key)"
    SECRET_KEY="$(creds_get "$CRED_KEY" "$PROVIDER" secret_key)"
    # fallback provider generik
    if [ -z "$ACCESS_KEY" ] || [ -z "$SECRET_KEY" ]; then
        ACCESS_KEY="$(creds_get "$CRED_KEY" "default" access_key)"
        SECRET_KEY="$(creds_get "$CRED_KEY" "default" secret_key)"
    fi
    if [ -z "$ACCESS_KEY" ] || [ -z "$SECRET_KEY" ]; then
        echo "   SKIP $NC_USER/$MOUNT_NAME: kredensial $PROVIDER belum ada"
        continue
    fi

    S3_HOST="$(prov_s3_field "$PROVIDER" hostname)"
    S3_REGION="$(prov_s3_field "$PROVIDER" region)"; [ -z "$S3_REGION" ] && S3_REGION="us-east-1"
    S3_SSL="$(prov_s3_field "$PROVIDER" use_ssl)"
    S3_PATH="$(prov_s3_field "$PROVIDER" use_path_style)"
    [ -z "$S3_HOST" ] && { echo "   SKIP $NC_USER/$MOUNT_NAME: hostname provider $PROVIDER kosong"; continue; }
    S3_PORT="$(printf '%s' "$S3_HOST" | sed -n 's/.*:\([0-9]*\)$/\1/p')"
    [ -n "$S3_PORT" ] || { [ "$S3_SSL" = "1" ] || [ "$S3_SSL" = "true" ] && S3_PORT=443 || S3_PORT=80; }
    S3_HOSTNAME="$(printf '%s' "$S3_HOST" | sed 's/:[0-9]*$//')"
    [ "$S3_SSL" = "1" ] || [ "$S3_SSL" = "true" ] && S3_SSL_CFG=true || S3_SSL_CFG=false
    [ "$S3_PATH" = "1" ] || [ "$S3_PATH" = "true" ] && S3_PATH_CFG=true || S3_PATH_CFG=false

    # cek mount existing: mount_point + bucket + host harus cocok
    HAVE="$(php -r '
        $out = shell_exec("php occ files_external:list " . escapeshellarg($argv[1]) . " --output=json --show-password 2>/dev/null");
        $rows = json_decode((string)$out, true);
        foreach ((array)$rows as $r) {
            $cfg = (array)($r["configuration"] ?? []);
            echo ($r["mount_point"] ?? ""), "\t", ($cfg["bucket"] ?? ""), "\t",
                 ($cfg["hostname"] ?? ""), "\t", ($cfg["port"] ?? ""), "\n";
        }
    ' "$NC_USER" 2>/dev/null || true)"

    MATCH=0
    while IFS=$'\t' read -r MP MB MH MPOR; do
        [ "$MP" = "/$MOUNT_NAME" ] || continue
        MB_HOST="$(printf '%s' "$MH" | sed 's/:[0-9]*$//')"
        MB_PORT="$(printf '%s' "$MH" | sed -n 's/.*:\([0-9]*\)$/\1/p')"; [ -z "$MB_PORT" ] && MB_PORT="$MPOR"
        if [ "$MB" = "$BUCKET" ] && [ "$MB_HOST" = "$S3_HOSTNAME" ] && [ "$MB_PORT" = "$S3_PORT" ]; then MATCH=1; break; fi
    done <<< "$HAVE"

    if [ "$MATCH" = "1" ]; then
        echo "   mount '/$MOUNT_NAME' sudah ada untuk $NC_USER ($PROVIDER)"; continue
    fi

    if $OCC files_external:create "/$MOUNT_NAME" amazons3 'amazons3::accesskey' \
        --user="$NC_USER" \
        --applicable-user="$NC_USER" \
        --config="bucket=$BUCKET" \
        --config="hostname=$S3_HOSTNAME" \
        --config="port=$S3_PORT" \
        --config="region=$S3_REGION" \
        --config="use_ssl=$S3_SSL_CFG" \
        --config="use_path_style=$S3_PATH_CFG" \
        --config="key=$ACCESS_KEY" \
        --config="secret=$SECRET_KEY"; then
        echo "   mount '/$MOUNT_NAME' → $NC_USER (bucket $BUCKET via $PROVIDER)"
    else
        echo "   GAGAL membuat mount '/$MOUNT_NAME' untuk $NC_USER ($PROVIDER)"
    fi
done < "$WORK/mounts.tsv"

# --- 4. grup & kuota home via occ ---
# Nextcloud 35 mewajibkan password confirmation untuk mengubah grup/kuota
# lewat Provisioning API, jadi mutasi dilakukan di sini sebagai www-data.
TMP_GROUPS="$WORK/groups-run.tsv"
awk -F'\t' '{print}' "$WORK/groups.tsv" > "$TMP_GROUPS"

MANAGED_CSV="$(awk -F'\t' '$1=="MANAGED"{print $2}' "$TMP_GROUPS" | head -1)"
{
    [ -n "$MANAGED_CSV" ] && printf '%s\n' "$MANAGED_CSV" | tr ',' '\n'
    awk -F'\t' '$1=="USER" && $3!=""{print $3}' "$TMP_GROUPS" | tr ',' '\n'
} | sort -u | while read -r GROUP_ID; do
    [ -n "$GROUP_ID" ] || continue
    if ! $OCC group:info "$GROUP_ID" >/dev/null 2>&1; then
        $OCC group:add "$GROUP_ID" >/dev/null 2>&1 \
            && echo "   grup $GROUP_ID dibuat" \
            || echo "   GAGAL membuat grup $GROUP_ID"
    fi
done

awk -F'\t' '$1=="USER"' "$TMP_GROUPS" | while IFS=$'\t' read -r _ NC_USER DESIRED_CSV HOME_QUOTA; do
    [ -n "$NC_USER" ] || continue
    if ! $OCC user:info "$NC_USER" >/dev/null 2>&1; then
        echo "   user $NC_USER tidak ada di Nextcloud — lewati grup/kuota"
        continue
    fi
    CURRENT_GROUPS="$($OCC user:info "$NC_USER" --output=json 2>/dev/null \
        | php -r '$d=json_decode(stream_get_contents(STDIN),true); echo implode("\n", array_map("strval",(array)($d["groups"]??[])));' 2>/dev/null || true)"

    comm -12 \
        <(printf '%s\n' "$CURRENT_GROUPS" | sort -u) \
        <(printf '%s\n' "$MANAGED_CSV" | tr ',' '\n' | sort -u) \
    | while read -r GROUP_ID; do
        [ -n "$GROUP_ID" ] || continue
        case ",$DESIRED_CSV," in
            *,"$GROUP_ID",*) : ;;
            *) $OCC group:removeuser "$GROUP_ID" "$NC_USER" >/dev/null 2>&1 \
                && echo "   $NC_USER keluar dari grup $GROUP_ID" \
                || echo "   GAGAL mengeluarkan $NC_USER dari grup $GROUP_ID" ;;
        esac
    done

    printf '%s\n' "$DESIRED_CSV" | tr ',' '\n' | sort -u | while read -r GROUP_ID; do
        [ -n "$GROUP_ID" ] || continue
        printf '%s\n' "$CURRENT_GROUPS" | grep -qxF "$GROUP_ID" && continue
        $OCC group:adduser "$GROUP_ID" "$NC_USER" >/dev/null 2>&1 \
            && echo "   $NC_USER masuk grup $GROUP_ID" \
            || echo "   GAGAL menambahkan $NC_USER ke grup $GROUP_ID"
    done

    if [ -n "$HOME_QUOTA" ]; then
        QUOTA_OK=0
        $OCC user:setting "$NC_USER" files quota "$HOME_QUOTA" >/dev/null 2>&1 && QUOTA_OK=1
        if [ "$QUOTA_OK" = 0 ]; then
            $OCC user:setting "$NC_USER" files quota --delete >/dev/null 2>&1 || true
            $OCC user:setting "$NC_USER" files quota "$HOME_QUOTA" >/dev/null 2>&1 && QUOTA_OK=1
        fi
        if [ "$QUOTA_OK" = 1 ]; then
            echo "   kuota home $NC_USER → $HOME_QUOTA"
        else
            echo "   GAGAL mengatur kuota $NC_USER"
        fi
    fi
done

echo "Selesai."
