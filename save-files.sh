#!/bin/bash

# Directory to scan
PROJECT_DIR=${1:-.}

# Output file name
OUTPUT_FILE=${2:-"code_summary.md"}

# Clean previous output
echo "# Project Snapshot: $(basename "$PROJECT_DIR")" > "$OUTPUT_FILE"
echo >> "$OUTPUT_FILE"
echo "## Directory Structure" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
tree -I "node_modules|dist|.git" "$PROJECT_DIR" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"

echo >> "$OUTPUT_FILE"
echo "## Selected Files" >> "$OUTPUT_FILE"

# Patterns to match — add as needed
PATTERNS=(
  "*.ts"               # TypeScript files, including Babylon setup
  "*.tsx"              # If you ever use JSX/TSX components
  "*.html"             # Likely index.html in root or /public
  "*.json"             # tsconfig.json, package.json, etc.
  "*.css"              # Any styling
  "*.scss"             # If you use Sass
  "*.md"               # README.md or project notes
  "vite.config.*"      # Vite configuration
  "babylon.*"          # Custom Babylon helpers or configs
)


# Build file list using find
MATCHED_FILES=()
for pattern in "${PATTERNS[@]}"; do
  while IFS= read -r -d '' file; do
    MATCHED_FILES+=("$file")
  done < <(find "$PROJECT_DIR" -type f -name "$pattern" -not -path "*/node_modules/*" -not -path "*/dist/*" -print0)
done

# Sort and deduplicate
IFS=$'\n' MATCHED_FILES=($(sort -u <<<"${MATCHED_FILES[*]}"))
unset IFS

# Dump files into the output
for FILE in "${MATCHED_FILES[@]}"; do
  REL_PATH="${FILE#$PROJECT_DIR/}"
  echo -e "\n### $REL_PATH\n\`\`\`${FILE##*.}" >> "$OUTPUT_FILE"
  cat "$FILE" >> "$OUTPUT_FILE"
  echo -e "\n\`\`\`" >> "$OUTPUT_FILE"
done

echo "✅ Exported ${#MATCHED_FILES[@]} files to $OUTPUT_FILE"
