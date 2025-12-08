#!/bin/bash

# Load environment variables from .env file
# Naudojama kitų skriptų

ENV_FILE="$(dirname "$0")/../.env"

if [ -f "$ENV_FILE" ]; then
    # Load .env file
    export $(grep -v '^#' "$ENV_FILE" | grep -v '^$' | xargs)
else
    echo "⚠️  .env failas nerastas: $ENV_FILE"
    echo "💡 Sukurkite .env failą iš .env.example"
fi

# Set defaults if not set
export VPS_IP="${VPS_IP:-72.62.1.133}"
export VPS_USER="${VPS_USER:-root}"

