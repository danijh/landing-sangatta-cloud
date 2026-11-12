#!/usr/bin/env bash
# Provisioning Storage Area (bucket per user, privasi penuh + lifecycle expiry).
#
# Jalankan sebagai www-data di host Nextcloud, misalnya:
#   sudo -u www-data /path/website-2/deploy/nextcloud-storage-sync.sh /path/website-2/storage
#
# Input:
#   <storage-dir>/nextcloud-mounts.json — ditulis otomatis backend website:
#     {"s3": {...},
#      "users": {"fb_1": {
#          "mounts":              [{name, group, bucket, credentials_key, expires_at}],
#          "retained_buckets":    ["bucket-lain"],   // expired, masih dalam grace period
#          "decommission_buckets":["bucket-lama"]    // grace habis → dihapus
#      }}}
#   <storage-dir>/s3-credentials.json — access key MinIO per user (diisi otomatis)
#
# Yang dilakukan:
#   1. mc mb untuk bucket mounts + retained; mc rb --force untuk decommission.
#   2. MinIO user + policy per user NC (hanya bucket aktif yang di-mount).
#   3. occ defaultapp=files.
#   4. occ files_external:create per mount; mount amazons3 user yang tidak ada
#      lagi di spec akan DIHAPUS (pencabutan saat paket expired).
#   5. occ group:add/adduser/removeuser + user:setting quota — sinkronisasi
#      grup produk & kuota home (Provisioning API write diblokir NC35).
#
# Environment opsional:
#   NC_DIR, MC, MINIO_ALIAS, MINIO_ENDPOINT,
#   MINIO_ROOT_USER / MINIO_ROOT_PASSWORD (alias sementara dibuat otomatis)

set -euo pipefail

STORAGE_DIR="${1:?Usage: $0 <website-storage-dir>}"
NC_DIR="${NC_DIR:-/var/www/nextcloud}"
MC="${MC:-mc}"
MINIO_ALIAS="${MINIO_ALIAS:-minio}"
SPEC="$STORAGE_DIR/nextcloud-mounts.json"
CREDS="$STORAGE_DIR/s3-credentials.json"

[ -f "$SPEC" ] || { echo "Spec tidak ditemukan: $SPEC"; exit 1; }
command -v php >/dev/null || { echo "php CLI dibutuhkan"; exit 1; }
command -v "$MC" >/dev/null || { echo "mc (MinIO client) tidak ditemukan: $MC"; exit 1; }

TMP_USERS=""; TMP_BUCKETS=""; TMP_GROUPS=""
MC_CFG=""
if [ -n "${MINIO_ROOT_USER:-}" ] && [ -n "${MINIO_ROOT_PASSWORD:-}" ]; then
    MC_CFG="$(mktemp -d)"
    trap 'rm -rf "$MC_CFG"; rm -f "$TMP_USERS" "$TMP_BUCKETS" "$TMP_GROUPS"' EXIT
    MC=("$MC" --config-dir "$MC_CFG")
    "${MC[@]}" alias set "$MINIO_ALIAS" "${MINIO_ENDPOINT:-http://localhost:9000}" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null
else
    trap 'rm -f "$TMP_USERS" "$TMP_BUCKETS" "$TMP_GROUPS"' EXIT
fi

S3_JSON="$(php -r '$s=json_decode(file_get_contents($argv[1]),true); echo json_encode($s["s3"] ?? []);' "$SPEC")"
S3_HOST="$(php -r 'echo json_decode($argv[1],true)["hostname"] ?? "localhost:9000";' "$S3_JSON")"
S3_SSL="$(php -r 'echo !empty(json_decode($argv[1],true)["use_ssl"]) ? "1" : "0";' "$S3_JSON")"
S3_REGION="$(php -r 'echo json_decode($argv[1],true)["region"] ?? "us-east-1";' "$S3_JSON")"
S3_PATH_STYLE="$(php -r 'echo !empty(json_decode($argv[1],true)["use_path_style"]) ? "1" : "0";' "$S3_JSON")"
[ "$S3_SSL" = "1" ] && S3_SCHEME="https" || S3_SCHEME="http"
S3_PORT="$(printf '%s' "$S3_HOST" | sed -n 's/.*:\([0-9]*\)$/\1/p')"
[ -n "$S3_PORT" ] || S3_PORT=$([ "$S3_SSL" = "1" ] && echo 443 || echo 80)
S3_HOSTNAME="$(printf '%s' "$S3_HOST" | sed 's/:[0-9]*$//')"

[ -f "$CREDS" ] || echo '{}' > "$CREDS"

TMP_USERS="$(mktemp)"
# format baris:
#   user|bucket1,bucket2        → user summary (semua bucket aktif+retained)
#   user|DECOM|bucket           → bucket yang harus dihapus
#   user⇥name⇥bucket⇥credkey    → detail mount aktif
php -r '
    $spec = json_decode(file_get_contents($argv[1]), true);
    foreach (($spec["users"] ?? []) as $user => $entry) {
        if (!is_array($entry)) { $entry = ["mounts" => $entry]; } // kompat format lama
        $mounts = is_array($entry["mounts"] ?? null) ? $entry["mounts"] : [];
        $retained = is_array($entry["retained_buckets"] ?? null) ? $entry["retained_buckets"] : [];
        $decom = is_array($entry["decommission_buckets"] ?? null) ? $entry["decommission_buckets"] : [];

        $keep = [];
        foreach ($mounts as $m) { if (is_array($m) && !empty($m["bucket"])) $keep[$m["bucket"]] = 1; }
        foreach ($retained as $b) { if (is_string($b) && $b !== "") $keep[$b] = 1; }
        echo $user, "|", implode(",", array_keys($keep)), "\n";
        foreach ($decom as $b) { if (is_string($b) && $b !== "") echo $user, "|DECOM|", $b, "\n"; }
        foreach ($mounts as $m) {
            if (!is_array($m) || empty($m["bucket"])) continue;
            echo $user, "\t", $m["name"] ?? $m["bucket"], "\t", $m["bucket"], "\t", $m["credentials_key"] ?? $user, "\n";
        }
    }
' "$SPEC" > "$TMP_USERS"

BUCKET_LIST="$(grep '|' "$TMP_USERS" | grep -v '|DECOM|' | cut -d'|' -f2 | tr ',' '\n' | grep -v '^$' | sort -u || true)"
DECOM_LIST="$(grep '|DECOM|' "$TMP_USERS" | cut -d'|' -f3 | sort -u || true)"

# --- 1a. hapus bucket decommission ---
for bucket in $DECOM_LIST; do
    if "${MC[@]}" ls "$MINIO_ALIAS/$bucket" >/dev/null 2>&1; then
        "${MC[@]}" rb --force "$MINIO_ALIAS/$bucket" && echo "bucket $bucket dihapus (grace habis)" \
            || echo "   GAGAL menghapus bucket $bucket"
    else
        echo "bucket $bucket sudah tidak ada"
    fi
done

# --- 1b. buat bucket yang dibutuhkan ---
for bucket in $BUCKET_LIST; do
    if "${MC[@]}" ls "$MINIO_ALIAS/$bucket" >/dev/null 2>&1; then
        echo "bucket $bucket sudah ada"
    else
        "${MC[@]}" mb "$MINIO_ALIAS/$bucket" && echo "bucket $bucket dibuat"
    fi
done

# --- 2. user minio + policy per user NC ---
grep '|' "$TMP_USERS" | grep -v '|DECOM|' | cut -d'|' -f1 | sort -u | while read -r NC_USER; do
    [ -n "$NC_USER" ] || continue
    MOUNT_USER="${NC_USER//_/-}"
    # hanya bucket dengan mount aktif (bukan retained) yang masuk policy
    ACTIVE_BUCKETS="$(awk -F'\t' -v u="$NC_USER" '$1==u {print $3}' "$TMP_USERS" | sort -u | tr '\n' ' ')"

    # policy JSON (kosong → tidak dipasang)
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

    # kredensial
    CREDS_JSON="$(php -r '$c=json_decode(file_get_contents($argv[1]),true); echo json_encode($c[$argv[2]] ?? null);' "$CREDS" "$NC_USER")"
    ACCESS_KEY=""; SECRET_KEY=""
    if [ "$CREDS_JSON" != "null" ]; then
        ACCESS_KEY="$(php -r '$c=json_decode($argv[1],true); echo $c["access_key"];' "$CREDS_JSON")"
        SECRET_KEY="$(php -r '$c=json_decode($argv[1],true); echo $c["secret_key"];' "$CREDS_JSON")"
    fi

    # pastikan user minio ada (buat ulang dari kredensial tersimpan bila perlu)
    if ! "${MC[@]}" admin user info "$MINIO_ALIAS" "$ACCESS_KEY" >/dev/null 2>&1; then
        if [ -z "$ACCESS_KEY" ]; then
            ACCESS_KEY="$MOUNT_USER-$(head -c4 /dev/urandom | od -An -tx1 | tr -d ' \n')"
            SECRET_KEY="$(head -c24 /dev/urandom | od -An -tx1 | tr -d ' \n')"
        fi
        if "${MC[@]}" admin user add "$MINIO_ALIAS" "$ACCESS_KEY" "$SECRET_KEY" >/dev/null 2>&1; then
            php -r '
                $f=$argv[1]; $u=$argv[2]; $ak=$argv[3]; $sk=$argv[4];
                $c=is_file($f)?json_decode(file_get_contents($f),true):[];
                $c[$u]=["access_key"=>$ak,"secret_key"=>$sk];
                file_put_contents($f, json_encode($c, JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES));
            ' "$CREDS" "$NC_USER" "$ACCESS_KEY" "$SECRET_KEY"
            echo "   minio user $ACCESS_KEY dibuat untuk $NC_USER"
        else
            echo "   GAGAL: minio user add $ACCESS_KEY untuk $NC_USER"
            rm -f "$POLICY_JSON"; continue
        fi
    fi

    POLICY_NAME="$MOUNT_USER-policy"
    if [ "$HAS_POLICY" = "0" ]; then
        # tidak ada bucket aktif → copot policy & user minio
        "${MC[@]}" admin policy detach "$MINIO_ALIAS" "$POLICY_NAME" --user "$ACCESS_KEY" >/dev/null 2>&1 || true
        "${MC[@]}" admin policy remove "$MINIO_ALIAS" "$POLICY_NAME" >/dev/null 2>&1 || true
        "${MC[@]}" admin user remove "$MINIO_ALIAS" "$ACCESS_KEY" >/dev/null 2>&1 || true
        echo "   akses minio $NC_USER dicabut (tidak ada paket aktif)"
        rm -f "$POLICY_JSON"; continue
    fi

    if "${MC[@]}" admin policy info "$MINIO_ALIAS" "$POLICY_NAME" >/dev/null 2>&1; then
        "${MC[@]}" admin policy detach "$MINIO_ALIAS" "$POLICY_NAME" --user "$ACCESS_KEY" >/dev/null 2>&1 || true
        "${MC[@]}" admin policy remove "$MINIO_ALIAS" "$POLICY_NAME" >/dev/null \
            || { echo "   GAGAL: policy remove $POLICY_NAME"; rm -f "$POLICY_JSON"; continue; }
    fi
    "${MC[@]}" admin policy create "$MINIO_ALIAS" "$POLICY_NAME" "$POLICY_JSON" >/dev/null \
        || { echo "   GAGAL: policy create $POLICY_NAME"; rm -f "$POLICY_JSON"; continue; }
    "${MC[@]}" admin policy attach "$MINIO_ALIAS" "$POLICY_NAME" --user "$ACCESS_KEY" >/dev/null \
        || { echo "   GAGAL: policy attach $POLICY_NAME"; rm -f "$POLICY_JSON"; continue; }
    rm -f "$POLICY_JSON"
    echo "   policy $POLICY_NAME terpasang untuk $NC_USER"
done

# --- 3. mount Nextcloud ---
cd "$NC_DIR"
OCC="php occ"
$OCC config:system:set defaultapp --value=files >/dev/null 2>&1 || true

# --- 3a. cabut mount milik user yang tidak ada lagi di spec ---
# user list = field1 dari baris summary (ada untuk semua user di spec)
grep '|' "$TMP_USERS" | grep -v '|DECOM|' | cut -d'|' -f1 | sort -u | while read -r NC_USER; do
    [ -n "$NC_USER" ] || continue
    DESIRED="$(awk -F'\t' -v u="$NC_USER" '$1==u {print "/" $2}' "$TMP_USERS" | sort -u)"
    EXISTING="$(php -r '
        $out = shell_exec("php occ files_external:list --output=json " . escapeshellarg($argv[1]) . " 2>/dev/null");
        $rows = json_decode((string)$out, true);
        $desired = array_flip(array_filter(explode("\n", $argv[2])));
        foreach ((array)$rows as $r) {
            $cls = (string)($r["storage"] ?? "");
            if (stripos($cls, "S3") === false) continue;
            $mp = $r["mount_point"] ?? "";
            if (!isset($desired[$mp])) echo $r["mount_id"], "\n";
        }
    ' "$NC_USER" "$DESIRED" 2>/dev/null || true)"
    for mid in $EXISTING; do
        [ -n "$mid" ] || continue
        $OCC files_external:delete "$mid" --yes >/dev/null 2>&1 \
            && echo "   mount id=$mid dicabut dari $NC_USER (paket tidak aktif)" \
            || echo "   GAGAL mencabut mount id=$mid"
    done
done

# --- 3b. buat mount yang diinginkan ---
awk -F'\t' 'NF==4' "$TMP_USERS" | while IFS=$'\t' read -r NC_USER MOUNT_NAME BUCKET CRED_KEY; do
    [ -n "$NC_USER" ] || continue
    ACCESS_KEY="$(php -r '$c=json_decode(file_get_contents($argv[1]),true); echo $c[$argv[2]]["access_key"] ?? "";' "$CREDS" "$NC_USER")"
    SECRET_KEY="$(php -r '$c=json_decode(file_get_contents($argv[1]),true); echo $c[$argv[2]]["secret_key"] ?? "";' "$CREDS" "$NC_USER")"
    if [ -z "$ACCESS_KEY" ] || [ -z "$SECRET_KEY" ]; then
        echo "   SKIP $NC_USER/$MOUNT_NAME: kredensial belum ada"
        continue
    fi

    HAVE="$(php -r '
        $out = shell_exec("php occ files_external:list --output=json " . escapeshellarg($argv[1]) . " 2>/dev/null");
        $rows = json_decode((string)$out, true);
        foreach ((array)$rows as $r) echo ($r["mount_point"] ?? ""), "\n";
    ' "$NC_USER" 2>/dev/null || true)"
    if printf '%s\n' "$HAVE" | grep -qxF "/$MOUNT_NAME"; then
        echo "   mount '/$MOUNT_NAME' sudah ada untuk $NC_USER"; continue
    fi

    if $OCC files_external:create "/$MOUNT_NAME" amazons3 'amazons3::accesskey' \
        --user="$NC_USER" \
        --applicable-user="$NC_USER" \
        --config="bucket=$BUCKET" \
        --config="hostname=$S3_HOSTNAME" \
        --config="port=$S3_PORT" \
        --config="region=$S3_REGION" \
        --config="use_ssl=$([ "$S3_SSL" = "1" ] && echo true || echo false)" \
        --config="use_path_style=$([ "$S3_PATH_STYLE" = "1" ] && echo true || echo false)" \
        --config="key=$ACCESS_KEY" \
        --config="secret=$SECRET_KEY"; then
        echo "   mount '/$MOUNT_NAME' → $NC_USER (bucket $BUCKET)"
    else
        echo "   GAGAL membuat mount '/$MOUNT_NAME' untuk $NC_USER"
    fi
done

# --- 4. grup & kuota home via occ ---
# Nextcloud 35 mewajibkan password confirmation untuk mengubah grup/kuota
# lewat Provisioning API, jadi mutasi dilakukan di sini sebagai www-data.
# Spec menyediakan: managed_groups (top-level), users.<u>.groups (grup
# produk yang diinginkan) dan users.<u>.home_quota.
TMP_GROUPS="$(mktemp)"
php -r '
    $spec = json_decode(file_get_contents($argv[1]), true);
    $managed = array_map("strval", (array) ($spec["managed_groups"] ?? []));
    echo "MANAGED\t", implode(",", $managed), "\n";
    foreach (($spec["users"] ?? []) as $u => $e) {
        if (!is_array($e)) { continue; }
        $hasGroups = isset($e["groups"]) && is_array($e["groups"]);
        $hasQuota = isset($e["home_quota"]) && is_string($e["home_quota"]) && $e["home_quota"] !== "";
        if (!$hasGroups && !$hasQuota) { continue; }
        $groups = $hasGroups ? implode(",", array_map("strval", $e["groups"])) : "";
        $quota = $hasQuota ? $e["home_quota"] : "";
        echo "USER\t", $u, "\t", $groups, "\t", $quota, "\n";
    }
' "$SPEC" > "$TMP_GROUPS" || true

MANAGED_CSV="$(awk -F'\t' '$1=="MANAGED"{print $2}' "$TMP_GROUPS" | head -1)"
# Pastikan semua grup managed + yang diinginkan user ada.
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

    # Keluar dari grup managed yang tidak lagi diinginkan.
    comm -12 \
        <(printf '%s\n' "$CURRENT_GROUPS" | sort -u) \
        <(printf '%s\n' "$MANAGED_CSV" | tr ',' '\n' | sort -u) \
    | while read -r GROUP_ID; do
        [ -n "$GROUP_ID" ] || continue
        case ",$DESIRED_CSV," in
            *,"$GROUP_ID",*) : ;;  # masih diinginkan
            *) $OCC group:removeuser "$GROUP_ID" "$NC_USER" >/dev/null 2>&1 \
                && echo "   $NC_USER keluar dari grup $GROUP_ID" \
                || echo "   GAGAL mengeluarkan $NC_USER dari grup $GROUP_ID" ;;
        esac
    done

    # Masuk ke grup yang diinginkan.
    printf '%s\n' "$DESIRED_CSV" | tr ',' '\n' | sort -u | while read -r GROUP_ID; do
        [ -n "$GROUP_ID" ] || continue
        printf '%s\n' "$CURRENT_GROUPS" | grep -qxF "$GROUP_ID" && continue
        $OCC group:adduser "$GROUP_ID" "$NC_USER" >/dev/null 2>&1 \
            && echo "   $NC_USER masuk grup $GROUP_ID" \
            || echo "   GAGAL menambahkan $NC_USER ke grup $GROUP_ID"
    done

    if [ -n "$HOME_QUOTA" ]; then
        # NC35 typed preferences: key lama bisa konflik tipe — fallback hapus+set.
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
