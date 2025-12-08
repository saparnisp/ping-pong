#!/bin/bash

# Docker Hub configuration
DOCKER_HUB_USERNAME="${DOCKER_HUB_USERNAME:-your-username}"
IMAGE_NAME="blokeliai-app"
IMAGE_TAG="${IMAGE_TAG:-latest}"
FULL_IMAGE_NAME="${DOCKER_HUB_USERNAME}/${IMAGE_NAME}:${IMAGE_TAG}"

echo "🐳 Docker image build'inimas..."
echo "📦 Image: ${FULL_IMAGE_NAME}"

# Build image
docker build -t ${FULL_IMAGE_NAME} .

if [ $? -ne 0 ]; then
    echo "❌ Build'inimas nepavyko"
    exit 1
fi

echo "✅ Image sukurtas!"

# Login to Docker Hub
echo "🔐 Prisijungimas prie Docker Hub..."
docker login

if [ $? -ne 0 ]; then
    echo "❌ Docker Hub login nepavyko"
    exit 1
fi

# Push image
echo "📤 Push'inimas į Docker Hub..."
docker push ${FULL_IMAGE_NAME}

if [ $? -ne 0 ]; then
    echo "❌ Push'inimas nepavyko"
    exit 1
fi

echo "✅ Image push'intas į Docker Hub!"
echo "📦 Image: ${FULL_IMAGE_NAME}"
echo ""
echo "Dabar galite naudoti šį image docker-compose.yml faile"

