# Simple GitHub Integration Check
Write-Host "Checking GitHub Integration..." -ForegroundColor Green

# Check GitHub token
Write-Host "`n1. Checking GitHub token..." -ForegroundColor Yellow
try {
    aws secretsmanager describe-secret --secret-id github-token | Out-Null
    Write-Host "✅ GitHub token exists" -ForegroundColor Green
} catch {
    Write-Host "❌ GitHub token missing" -ForegroundColor Red
    Write-Host "Run: .\setup-github-integration.ps1" -ForegroundColor Cyan
    exit 1
}

# Check pipeline
Write-Host "`n2. Checking pipeline..." -ForegroundColor Yellow
try {
    aws codepipeline get-pipeline --name dev-my-app-pipeline | Out-Null
    Write-Host "✅ Pipeline exists" -ForegroundColor Green
} catch {
    Write-Host "❌ Pipeline missing" -ForegroundColor Red
    Write-Host "Deploy: cd my-app-infrastructure && npm run deploy" -ForegroundColor Cyan
    exit 1
}

Write-Host "`n✅ Basic setup looks good!" -ForegroundColor Green
Write-Host "Next: Deploy pipeline to create webhook" -ForegroundColor Cyan