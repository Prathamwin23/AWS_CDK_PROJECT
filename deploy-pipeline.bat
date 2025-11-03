@echo off
echo Deploying CI/CD Pipeline...
echo.

echo Checking if we're in the right directory...
if not exist "my-app-infrastructure" (
    echo ❌ my-app-infrastructure directory not found
    echo Make sure you're in the project root directory
    exit /b 1
)

echo Changing to infrastructure directory...
cd my-app-infrastructure

echo.
echo Installing dependencies...
npm install

echo.
echo Deploying CI/CD Pipeline Stack...
npm run deploy -- --exclusively dev-CiCdPipelineStack

if %errorlevel% equ 0 (
    echo ✅ Pipeline deployed successfully!
    echo.
    echo The pipeline should now automatically trigger when you push to GitHub master branch.
    echo.
    echo Monitor your pipeline at:
    echo https://console.aws.amazon.com/codesuite/codepipeline/pipelines/dev-my-app-pipeline/view
) else (
    echo ❌ Pipeline deployment failed
    exit /b 1
)

cd ..
echo.
echo 🚀 Ready to test! Make a commit and push to trigger the pipeline.