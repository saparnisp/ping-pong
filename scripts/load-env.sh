#!/bin/bash

# Load environment variables from .env file
# Naudojama kitų skriptų

ENV_FILE="$(dirname "$0")/../.env"

if [ -f "$ENV_FILE" ]; then
    # Load .env file - naudoja eval su saugumu
    # Reikalauja, kad password būtų kabutėse jei turi specialių simbolių
    while IFS= read -r line || [ -n "$line" ]; do
        # Skip comments and empty lines
        [[ "$line" =~ ^[[:space:]]*# ]] && continue
        [[ -z "${line// }" ]] && continue
        
        # Check if line contains =
        if [[ "$line" == *"="* ]]; then
            # Use eval to properly handle special characters
            # But only if value is quoted or doesn't contain special chars
            if [[ "$line" =~ ^[[:space:]]*[A-Za-z_][A-Za-z0-9_]*[[:space:]]*=[[:space:]]*[\'\"] ]] || [[ ! "$line" =~ [\(\)\'\`\$] ]]; then
                eval "export $line"
            else
                # For unquoted values with special chars, try to quote them
                key="${line%%=*}"
                value="${line#*=}"
                key=$(echo "$key" | xargs)
                eval "export ${key}=\"${value}\""
            fi
        fi
    done < "$ENV_FILE"
else
    echo "⚠️  .env failas nerastas: $ENV_FILE"
    echo "💡 Sukurkite .env failą iš .env.example"
fi

# Set defaults if not set
export VPS_IP="${VPS_IP:-72.62.1.133}"
export VPS_USER="${VPS_USER:-root}"

