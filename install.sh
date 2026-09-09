#!/usr/bin/env bash
#
# Install or update PS4 PKG Downloader (Linux AppImage).
#   curl -fsSL https://raw.githubusercontent.com/aor-rex/ps4-pkg-dl/main/install.sh | bash
# Re-running the script updates to the latest release.
set -euo pipefail

REPO="aor-rex/ps4-pkg-dl"
APP_DIR="${HOME}/Applications"
DESKTOP_DIR="${HOME}/.local/share/applications"
ICON_DIR="${HOME}/.local/share/icons"
APP_FILE="${APP_DIR}/PS4-PKG-Downloader.AppImage"
DESKTOP_FILE="${DESKTOP_DIR}/ps4-pkg-downloader.desktop"

mkdir -p "${APP_DIR}" "${DESKTOP_DIR}" "${ICON_DIR}"

echo "Fetching latest release info..."
API_JSON="$(curl -fsSL "https://api.github.com/repos/${REPO}/releases" )"
TAG="$(printf '%s' "${API_JSON}" | grep -m1 '"tag_name"' | cut -d'"' -f4)"
if [ -z "${TAG}" ]; then
  echo "Could not determine latest release. Check your connection and try again." >&2
  exit 1
fi
ASSET_URL="$(printf '%s' "${API_JSON}" | grep -m1 '"browser_download_url": *"[^"]*\.AppImage"' | cut -d'"' -f4)"
if [ -z "${ASSET_URL}" ]; then
  echo "No AppImage found in release ${TAG}." >&2
  exit 1
fi

if [ -f "${APP_FILE}" ]; then
  echo "Updating existing install to ${TAG}..."
else
  echo "Installing ${TAG}..."
fi
curl -fsSL -o "${APP_FILE}.new" "${ASSET_URL}"
chmod +x "${APP_FILE}.new"
mv "${APP_FILE}.new" "${APP_FILE}"

# Extract icon from the AppImage for the launcher entry
if command -v python3 >/dev/null 2>&1; then
  "${APP_FILE}" --appimage-extract "ps4-pkg-dl.png" >/dev/null 2>&1 || true
  if [ -f "squashfs-root/ps4-pkg-dl.png" ]; then
    mv "squashfs-root/ps4-pkg-dl.png" "${ICON_DIR}/ps4-pkg-downloader.png"
    rm -rf squashfs-root
  fi
fi
ICON_LINE="Icon=ps4-pkg-downloader"
[ -f "${ICON_DIR}/ps4-pkg-downloader.png" ] || ICON_LINE="Icon=applications-games"

cat > "${DESKTOP_FILE}" <<EOF
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
