#!/usr/bin/env bash
# Zostaví Android aplikáciu Laudate a uloží ju do dist-android/Laudate.apk
# Potrebuje Java 17+ a Android SDK (ANDROID_HOME alebo android/local.properties).
set -euo pipefail
cd "$(dirname "$0")/../android"
./gradlew assembleRelease
mkdir -p ../dist-android
cp app/build/outputs/apk/release/app-release.apk ../dist-android/Laudate.apk
echo "Hotovo: dist-android/Laudate.apk"
