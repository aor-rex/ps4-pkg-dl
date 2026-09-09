#!/usr/bin/env bash
#
# Install or update PS4 PKG Downloader (Linux AppImage).
#   curl -fsSL https://cdn.jsdelivr.net/gh/aor-rex/ps4-pkg-dl@main/install.sh | bash
# Re-running the script updates to the latest release.
#
# Every fallible step reports what failed and why — this script never
# exits silently. (set -e is deliberately OFF; all errors are explicit.)
set -uo pipefail

REPO="aor-rex/ps4-pkg-dl"
APP_DIR="${HOME}/Applications"
DESKTOP_DIR="${HOME}/.local/share/applications"
ICON_DIR="${HOME}/.local/share/icons"
APP_FILE="${APP_DIR}/PS4-PKG-Downloader.AppImage"
DESKTOP_FILE="${DESKTOP_DIR}/ps4-pkg-downloader.desktop"

fatal() { echo "ERROR: $*" >&2; exit 1; }
step()  { echo "==> $*"; }

CURL="curl --retry 3 --retry-all-errors --connect-timeout 15"

mkdir -p "${APP_DIR}" "${DESKTOP_DIR}" "${ICON_DIR}" \
  || fatal "cannot create install directories (check disk/permissions)"

# ── 1. Find the latest release (API first, /tags page as fallback) ──
step "Finding latest release..."
TAG=""
ASSET_URL=""

if command -v python3 >/dev/null 2>&1; then
  API_JSON="$(${CURL} -fsSL "https://api.github.com/repos/${REPO}/releases" 2>/tmp/ps4dl-api.err)" \
    || echo "WARNING: releases API unreachable ($(head -c 120 /tmp/ps4dl-api.err 2>/dev/null || echo 'no response'))" >&2
  if [ -n "${API_JSON:-}" ]; then
    TAG="$(printf '%s' "${API_JSON}" | python3 -c 'import json,sys; print(json.load(sys.stdin)[0]["tag_name"])' 2>/dev/null)" || true
    if [ -n "${TAG:-}" ]; then
      ASSET_URL="$(printf '%s' "${API_JSON}" | python3 -c '
import json,sys
for a in json.load(sys.stdin)[0].get("assets", []):
    if a.get("name", "").endswith(".AppImage"):
        print(a["browser_download_url"]); break
' 2>/dev/null)" || true
    fi
  fi
else
  echo "WARNING: python3 not found, falling back to grep parsing" >&2
  API_JSON="$(${CURL} -fsSL "https://api.github.com/repos/${REPO}/releases" 2>/dev/null)" || true
  if [ -n "${API_JSON:-}" ]; then
    TAG="$(printf '%s' "${API_JSON}" | grep -m1 '"tag_name"' | cut -d'"' -f4)" || true
    ASSET_URL="$(printf '%s' "${API_JSON}" | grep -m1 '"browser_download_url": *"[^"]*\.AppImage"' | cut -d'"' -f4)" || true
  fi
fi

if [ -z "${TAG:-}" ]; then
  step "API failed, trying tags page as fallback..."
  TAG="$(${CURL} -fsSL "https://github.com/${REPO}/tags" 2>/dev/null | grep -oE 'releases/tag/v[0-9][^"]*' | head -1 | sed 's|releases/tag/||')" || true
  if [ -n "${TAG:-}" ]; then
    VER="${TAG#v}"
    ASSET_URL="https://github.com/${REPO}/releases/download/${TAG}/PS4-PKG-Downloader-${VER}.AppImage"
  fi
fi

[ -n "${TAG:-}" ] || fatal "could not determine latest release from API or tags page (network down?)"
[ -n "${ASSET_URL:-}" ] || fatal "release ${TAG} has no AppImage asset"

# ── 2. Download the AppImage (visible progress, resumable) ──
if [ -f "${APP_FILE}" ]; then
  step "Updating existing install to ${TAG} (~125 MB, resumes if interrupted)..."
else
  step "Installing ${TAG} (~125 MB)..."
fi
${CURL} -fSL -# -C - -o "${APP_FILE}.new" "${ASSET_URL}" \
  || fatal "download failed from ${ASSET_URL}"
[ -s "${APP_FILE}.new" ] || fatal "downloaded file is empty — try again"
chmod +x "${APP_FILE}.new" || fatal "cannot chmod ${APP_FILE}.new"
mv "${APP_FILE}.new" "${APP_FILE}" || fatal "cannot move new AppImage into place"

# ── 3. Launcher icon (non-fatal) ──
if ${CURL} -fsSL -o "${ICON_DIR}/ps4-pkg-downloader.png" \
  "https://cdn.jsdelivr.net/gh/${REPO}@main/assets/icon.png" 2>/dev/null; then
  :
else
  echo "WARNING: could not download icon; launcher will use a generic one." >&2
fi
ICON_LINE="Icon=ps4-pkg-downloader"
[ -f "${ICON_DIR}/ps4-pkg-downloader.png" ] || ICON_LINE="Icon=applications-games"

# ── 4. Launcher entry ──
cat > "${DESKTOP_FILE}" <<EOF || fatal "cannot write ${DESKTOP_FILE}"
[Desktop Entry]
Type=Application
Name=PS4 PKG Downloader
Comment=Browse and download PS4 PKG catalogs
Exec=${APP_FILE} %U
${ICON_LINE}
Categories=Game;
Terminal=false
StartupWMClass=com.ps4pkgdl.app
EOF

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "${DESKTOP_DIR}" >/dev/null 2>&1 || true
fi

echo "Done — ${TAG} installed at ${APP_FILE}"
echo "Launch it from your app menu (PS4 PKG Downloader) or run: ${APP_FILE}"
