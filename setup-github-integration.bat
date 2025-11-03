@echo off
echo Setting up GitHub Integration for CI/CD Pipeline...
echo.

echo Checking AWS CLI configuration...
aws sts get-caller-identity >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ AWS CLI not configured. Please run 'aws configure' first
    exit /b 1
)
echo ✅ AWS CLI is configured

echo.
echo You need to create a GitHub Personal Access Token with these permissions:
echo - repo (Full control of private repositories)
echo - admin:repo_hook (Full control of repository hooks)
echo.
echo Create token at: https://github.com/settings/tokens/new
echo.

set /p GITHUB_TOKEN="Enter your GitHub Personal Access Token: "

if "%GITHUB_TOKEN%"=="" (
    echo ❌ GitHub token cannot be empty
    exit /b 1
)

echo.
echo Creating GitHub token secret in AWS Secrets Manager...

REM Check if secret exists
aws secretsmanager describe-secret --secret-id github-token >nul 2>&1
if %errorlevel% equ 0 (
    echo Secret already exists. Updating...
    aws secretsmanager update-secret --secret-id github-token --secret-string "%GITHUB_TOKEN%"
) else (
    echo Creating new secret...
    aws secretsmanager create-secret --name github-token --description "GitHub Personal Access Token for CI/CD Pipeline" --secret-string "%GITHUB_TOKEN%"
)

if %errorlevel% equ 0 (
    echo ✅ GitHub token successfully stored in AWS Secrets Manager
) else (
    echo ❌ Failed to store GitHub token
    exit /b 1
)

echo.
echo 🚀 GitHub integration setup complete!
echo Now deploy the CI/CD stack with:
echo cd my-app-infrastructure ^&^& npm run deploy