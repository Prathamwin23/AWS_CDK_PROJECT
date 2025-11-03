# Django Deployment Script
# Run this after Docker Desktop is installed

Write-Host "🚀 Starting Django deployment to ECS..." -ForegroundColor Green

# Step 1: Build Docker image
Write-Host "📦 Building Django Docker image..." -ForegroundColor Yellow
docker build -t django-app .

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker build failed!" -ForegroundColor Red
    exit 1
}

# Step 2: Login to ECR
Write-Host "🔐 Logging into ECR..." -ForegroundColor Yellow
aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin 516268691462.dkr.ecr.ap-south-1.amazonaws.com

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ ECR login failed!" -ForegroundColor Red
    exit 1
}

# Step 3: Tag image
Write-Host "🏷️ Tagging Docker image..." -ForegroundColor Yellow
docker tag django-app:latest 516268691462.dkr.ecr.ap-south-1.amazonaws.com/dev/django-app:latest

# Step 4: Push to ECR
Write-Host "⬆️ Pushing image to ECR..." -ForegroundColor Yellow
docker push 516268691462.dkr.ecr.ap-south-1.amazonaws.com/dev/django-app:latest

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker push failed!" -ForegroundColor Red
    exit 1
}

# Step 5: Update ECS stack
Write-Host "🔄 Updating ECS stack..." -ForegroundColor Yellow
Set-Location my-app-infrastructure
npm run build
npx cdk deploy dev-EcsStack --require-approval never

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ ECS deployment failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Django deployment completed successfully!" -ForegroundColor Green
Write-Host "🌐 Your Django app should be available at: http://dev-django-alb-1402722688.ap-south-1.elb.amazonaws.com" -ForegroundColor Cyan