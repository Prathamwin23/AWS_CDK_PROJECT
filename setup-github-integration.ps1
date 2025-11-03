# Setup GitHub Integration for CI/CD Pipeline
# This script creates the necessary GitHub token in AWS Secrets Manager

Write-Host "Setting up GitHub Integration for CI/CD Pipeline..." -ForegroundColor Green

# Check if AWS CLI is configured
try {
    aws sts get-caller-identity | Out-Null
    Write-Host "✅ AWS CLI is configured" -ForegroundColor Green
} catch {
    Write-Host "❌ AWS CLI not configured. Please run 'aws configure' first" -ForegroundColor Red
    exit 1
}

# Prompt for GitHub Personal Access Token
Write-Host "`nYou need to create a GitHub Personal Access Token with the following permissions:" -ForegroundColor Yellow
Write-Host "- repo (Full control of private repositories)" -ForegroundColor Yellow
Write-Host "- admin:repo_hook (Full control of repository hooks)" -ForegroundColor Yellow
Write-Host "`nCreate token at: https://github.com/settings/tokens/new" -ForegroundColor Cyan

$githubToken = Read-Host -Prompt "`nEnter your GitHub Personal Access Token" -AsSecureString
$githubTokenPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($githubToken))

if ([string]::IsNullOrEmpty($githubTokenPlain)) {
    Write-Host "❌ GitHub token cannot be empty" -ForegroundColor Red
    exit 1
}

# Create secret in AWS Secrets Manager
Write-Host "`nCreating GitHub token secret in AWS Secrets Manager..." -ForegroundColor Yellow

try {
    # Check if secret already exists
    aws secretsmanager describe-secret --secret-id github-token 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Secret already exists. Updating..." -ForegroundColor Yellow
        aws secretsmanager update-secret --secret-id github-token --secret-string $githubTokenPlain
    } else {
        Write-Host "Creating new secret..." -ForegroundColor Yellow
        aws secretsmanager create-secret --name github-token --description "GitHub Personal Access Token for CI/CD Pipeline" --secret-string $githubTokenPlain
    }
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ GitHub token successfully stored in AWS Secrets Manager" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to store GitHub token" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Error creating secret: $_" -ForegroundColor Red
    exit 1
}

Write-Host "`n🚀 GitHub integration setup complete!" -ForegroundColor Green
Write-Host "Now you can deploy the updated CI/CD stack with:" -ForegroundColor Cyan
Write-Host "cd my-app-infrastructure && npm run deploy" -ForegroundColor Cyan
Write-Host "`nAfter deployment, pushing to GitHub master branch will automatically trigger the pipeline!" -ForegroundColor Green