#!/bin/bash

# Directory to scan
PROJECT_DIR=${1:-.}

# Output file name (relative to PROJECT_DIR)
OUTPUT_FILE=${2:-"code_summary.md"}
OUTPUT_PATH="$PROJECT_DIR/$OUTPUT_FILE"

# Clean previous output
echo "# Project Snapshot: $(basename "$PROJECT_DIR")" > "$OUTPUT_PATH"
echo >> "$OUTPUT_PATH"
echo "## Directory Structure" >> "$OUTPUT_PATH"
echo '```' >> "$OUTPUT_PATH"
tree -I "node_modules|dist|.git|$OUTPUT_FILE|helvetiker_regular.typefaceon" "$PROJECT_DIR" >> "$OUTPUT_PATH"
echo '```' >> "$OUTPUT_PATH"

echo >> "$OUTPUT_PATH"
echo "## Selected Files" >> "$OUTPUT_PATH"

# Patterns to match — tailored for VisualMind + Babylon setup
PATTERNS=(
  "*.ts"
  "*"
  "*.html"
  "*on"
  "*.css"
  "*.md"
  "vite.config.*"
)

# Build file list using find, excluding unneeded files
MATCHED_FILES=()
for pattern in "${PATTERNS[@]}"; do
  while IFS= read -r -d '' file; do
    [[ "$file" == "$OUTPUT_PATH" ]] && continue
    [[ "$(basename "$file")" == "helvetiker_regular.typefaceon" ]] && continue
    MATCHED_FILES+=("$file")
  done < <(find "$PROJECT_DIR" -type f -name "$pattern" \
    -not -path "*/node_modules/*" \
    -not -path "*/dist/*" \
    -print0)
done

# Sort and deduplicate
IFS=$'\n' MATCHED_FILES=($(sort -u <<<"${MATCHED_FILES[*]}"))
unset IFS

# Dump files into the output
for FILE in "${MATCHED_FILES[@]}"; do
  REL_PATH="${FILE#$PROJECT_DIR/}"
  EXT="${FILE##*.}"
  echo -e "\n### $REL_PATH\n\`\`\`${EXT}" >> "$OUTPUT_PATH"
  cat "$FILE" >> "$OUTPUT_PATH"
  echo -e "\n\`\`\`" >> "$OUTPUT_PATH"
done

echo "✅ Exported ${#MATCHED_FILES[@]} files to $OUTPUT_FILE"
