#!/usr/bin/env bash
# Runs a command with Firebase's local emulators (Auth + Firestore) around it, on a "demo-" project
# that can never reach the real one. The Firestore emulator needs Java 21+: if the system Java is
# older, a portable one in ~/.cache/jdk21 is used (see docs/dev.md).
#   firebase/emulators.sh                 start them and keep them running (for npm run dev)
#   firebase/emulators.sh "<command>"     start them, run the command, stop them
set -euo pipefail
cd "$(dirname "$0")/.."
major=$(java -version 2>&1 | sed -n 's/.*version "\([0-9]*\).*/\1/p' | head -1 || true)
if [[ -z "${major}" || "${major}" -lt 21 ]]; then
  jre=$(ls -d "$HOME"/.cache/jdk21/*/ 2>/dev/null | head -1 || true)
  [[ -n "$jre" ]] || { echo "The Firestore emulator needs Java 21+. See docs/dev.md." >&2; exit 1; }
  export JAVA_HOME="${jre%/}" PATH="${jre%/}/bin:$PATH"
fi
export FIREBASE_PROJECT_ID=demo-dineri
if [[ $# -eq 0 ]]; then
  exec firebase emulators:start --only auth,firestore --project demo-dineri
fi
exec firebase emulators:exec --only auth,firestore --project demo-dineri "$1"
