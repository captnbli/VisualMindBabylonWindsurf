#!/bin/bash

ARCHIVE_NAME="visualmind_snapshot.zip"

# Clean up
rm -f "$ARCHIVE_NAME"

# Build list of files to include
INCLUDE_FILES=$(find ts \
  -type f \( -name "*.ts" -o -name "*.html" -o -name "*.json" -o -name "*.css" -o -name "*.sh" \) \
  ! -path "*/node_modules/*" \
  ! -path "*/dist/*" \
  ! -path "*/.git/*" \
  ! -path "./assets/helvetiker_regular.typeface.json")

# Add index.html if present
if [ -f "index.html" ]; then
  INCLUDE_FILES="$INCLUDE_FILES index.html"
fi

# Create zip archive
zip -r "$ARCHIVE_NAME" $INCLUDE_FILES

echo "✅ Snapshot complete: $ARCHIVE_NAME"
