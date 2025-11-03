# BULLETPROOF Django Dockerfile - SIMPLE AND GUARANTEED
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    default-mysql-client \
    default-libmysqlclient-dev \
    gcc \
    pkg-config \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy ALL files
COPY . .

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    DJANGO_SETTINGS_MODULE=bulletproof_settings

# Create static files directory
RUN mkdir -p staticfiles

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health/ || exit 1

# Run the application
CMD python manage.py makemigrations && \
    python manage.py migrate && \
    python manage.py populate_data && \
    python manage.py collectstatic --noinput && \
    python manage.py runserver 0.0.0.0:8000