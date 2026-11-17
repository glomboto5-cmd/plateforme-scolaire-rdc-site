#!/usr/bin/env bash
# Usage : scripts/set-abi.sh "arm64-v8a" "armeabi-v7a"
# Ne garde que les architectures demandées dans l'APK (retire x86/x86_64 des émulateurs).
set -euo pipefail
F=android/app/build.gradle
LIST=$(printf '"%s", ' "$@"); LIST=${LIST%, }
if ! grep -q "abiFilters" "$F"; then
  sed -i "0,/defaultConfig {/s//defaultConfig {\n        ndk { abiFilters ABI_PLACEHOLDER }/" "$F"
fi
sed -i -E "s/abiFilters [^}]*\}/abiFilters $LIST }/" "$F"
sed -i "s/ABI_PLACEHOLDER/$LIST/" "$F"
sed -i "s/^reactNativeArchitectures=.*/reactNativeArchitectures=$(IFS=,; echo "$*")/" android/gradle.properties
grep -n "abiFilters" "$F"
grep reactNativeArchitectures android/gradle.properties
