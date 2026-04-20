FROM python:3.13-slim

# Install system dependencies to install uv
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && rm -rf /var/lib/apt/lists/*

# Install Astral's uv package manager
RUN curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR="/usr/local/bin" sh

WORKDIR /app

# Copy dependency definition files
COPY pyproject.toml uv.lock README.md ./

# Sync project dependencies (creates a .venv inside the container)
RUN uv sync --frozen --no-dev

# Copy application files
COPY . .

# Ensure local data directory is available and writable
RUN mkdir -p /app/data && chmod -R 777 /app/data

ENV IS_DOCKER=true
ENV PORT=8080
ENV BASE_PATH=/app-review

EXPOSE 8080

CMD ["uv", "run", "main.py"]
