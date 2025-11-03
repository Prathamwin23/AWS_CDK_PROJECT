@echo off
echo Checking GitHub Integration for Pipeline...
echo.

echo 1. Checking GitHub token in AWS Secrets Manager...
aws secretsmanager describe-secret --secret-id github-token >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ GitHub token exists in Secrets Manager
) else (
    echo ❌ GitHub token missing
    echo Run: setup-github-integration.bat
    exit /b 1
)

echo.
echo 2. Checking pipeline...
aws codepipeline get-pipeline --name dev-my-app-pipeline >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Pipeline exists
) else (
    echo ❌ Pipeline missing
    echo Deploy: cd my-app-infrastructure ^&^& npm run deploy
    exit /b 1
)

echo.
echo 3. Checking recent pipeline executions...
aws codepipeline list-pipeline-executions --pipeline-name dev-my-app-pipeline --max-items 3

echo.
echo ✅ Basic setup looks good!
echo.
echo Next steps:
echo 1. Deploy pipeline: cd my-app-infrastructure ^&^& npm run deploy
echo 2. Test trigger: make a commit and push to master branch
echo 3. Monitor: https://console.aws.amazon.com/codesuite/codepipeline/