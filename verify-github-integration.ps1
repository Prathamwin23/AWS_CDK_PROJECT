# Verify GitHub Integration for Pipeline
# This script checks if GitHub token and webhook are properly configured

Write-Host "🔍 Verifying GitHub Integration..." -ForegroundColor Green

# Check if GitHub token exists in Secrets Manager
Write-Host "`n1. Checking GitHub token in AWS Secrets Manager..." -ForegroundColor Yellow
try {
    $secret = aws secretsmanager describe-secret --secret-id github-token | ConvertFrom-Json
    Write-Host "✅ GitHub token found in Secrets Manager" -ForegroundColor Green
    Write-Host "Created: $($secret.CreatedDate)" -ForegroundColor White
    Write-Host "Last Modified: $($secret.LastChangedDate)" -ForegroundColor White
} catch {
    Write-Host "❌ GitHub token not found in Secrets Manager" -ForegroundColor Red
    Write-Host "Run: .\setup-github-integration.ps1" -ForegroundColor Cyan
    exit 1
}

# Test GitHub token permissions (basic check)
Write-Host "`n2. Testing GitHub token permissions..." -ForegroundColor Yellow
try {
    $tokenValue = aws secretsmanager get-secret-value --secret-id github-token --query SecretString --output text
    
    # Test GitHub API access (basic repo info)
    $headers = @{
        'Authorization' = "token $tokenValue"
        'Accept' = 'application/vnd.github.v3+json'
    }
    
    $repoInfo = Invoke-RestMethod -Uri "https://api.github.com/repos/Prathamwin23/AWS_CDK_PROJECT" -Headers $headers
    Write-Host "✅ GitHub token has access to repository" -ForegroundColor Green
    Write-Host "Repository: $($repoInfo.full_name)" -ForegroundColor White
    Write-Host "Default Branch: $($repoInfo.default_branch)" -ForegroundColor White
    Write-Host "Private: $($repoInfo.private)" -ForegroundColor White
    
    # Check webhook permissions
    try {
        $hooks = Invoke-RestMethod -Uri "https://api.github.com/repos/Prathamwin23/AWS_CDK_PROJECT/hooks" -Headers $headers
        Write-Host "✅ Token has webhook permissions" -ForegroundColor Green
        
        if ($hooks.Count -gt 0) {
            Write-Host "`n📡 Existing Webhooks:" -ForegroundColor Yellow
            foreach ($hook in $hooks) {
                if ($hook.config.url -like "*codepipeline*" -or $hook.config.url -like "*amazonaws.com*") {
                    Write-Host "✅ CodePipeline webhook found: $($hook.config.url)" -ForegroundColor Green
                } else {
                    Write-Host "ℹ️  Other webhook: $($hook.config.url)" -ForegroundColor White
                }
            }
        } else {
            Write-Host "⚠️  No webhooks found - this might be the issue!" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "❌ Token doesn't have webhook permissions" -ForegroundColor Red
        Write-Host "Ensure token has 'admin:repo_hook' permission" -ForegroundColor Cyan
    }
    
} catch {
    Write-Host "❌ GitHub token test failed" -ForegroundColor Red
    Write-Host "Token might be invalid or have insufficient permissions" -ForegroundColor Yellow
    Write-Host "Required permissions: repo, admin:repo_hook" -ForegroundColor Cyan
}

Write-Host "`n3. Pipeline Deployment Status..." -ForegroundColor Yellow
try {
    $pipeline = aws codepipeline get-pipeline --name dev-my-app-pipeline | ConvertFrom-Json
    Write-Host "✅ Pipeline exists and is configured" -ForegroundColor Green
} catch {
    Write-Host "❌ Pipeline not found or not accessible" -ForegroundColor Red
    Write-Host "Deploy pipeline: cd my-app-infrastructure && npm run deploy" -ForegroundColor Cyan
}

Write-Host "`n🔧 Next Steps:" -ForegroundColor Green
Write-Host "1. If webhook is missing, redeploy pipeline to create it" -ForegroundColor White
Write-Host "2. Make a test commit and push to trigger pipeline" -ForegroundColor White
Write-Host "3. Monitor pipeline at: https://console.aws.amazon.com/codesuite/codepipeline/" -ForegroundColor White

Write-Host "`n🚀 Quick Test:" -ForegroundColor Cyan
Write-Host "echo `"# Test change`" >> README.md" -ForegroundColor White
Write-Host "git add README.md" -ForegroundColor White
Write-Host "git commit -m `"test pipeline trigger`"" -ForegroundColor White
Write-Host "git push origin master" -ForegroundColor White