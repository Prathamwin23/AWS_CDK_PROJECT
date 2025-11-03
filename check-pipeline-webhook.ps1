# Check and Fix Pipeline Webhook Configuration
# This script helps diagnose and fix automatic pipeline triggering issues

Write-Host "🔍 Checking Pipeline Webhook Configuration..." -ForegroundColor Green

# Check if pipeline exists
$pipelineName = "dev-my-app-pipeline"
Write-Host "`nChecking if pipeline exists..." -ForegroundColor Yellow

try {
    $pipeline = aws codepipeline get-pipeline --name $pipelineName | ConvertFrom-Json
    Write-Host "✅ Pipeline '$pipelineName' found" -ForegroundColor Green
} catch {
    Write-Host "❌ Pipeline '$pipelineName' not found" -ForegroundColor Red
    Write-Host "Please deploy the pipeline first with: cd my-app-infrastructure && npm run deploy" -ForegroundColor Cyan
    exit 1
}

# Check GitHub source configuration
$sourceAction = $pipeline.pipeline.stages[0].actions[0]
Write-Host "`n📋 Current GitHub Source Configuration:" -ForegroundColor Yellow
Write-Host "Owner: $($sourceAction.configuration.Owner)" -ForegroundColor White
Write-Host "Repo: $($sourceAction.configuration.Repo)" -ForegroundColor White
Write-Host "Branch: $($sourceAction.configuration.Branch)" -ForegroundColor White
Write-Host "PollForSourceChanges: $($sourceAction.configuration.PollForSourceChanges)" -ForegroundColor White

# Check if webhook is properly configured
if ($sourceAction.configuration.PollForSourceChanges -eq "false") {
    Write-Host "✅ Polling is disabled (good - should use webhooks)" -ForegroundColor Green
} else {
    Write-Host "⚠️  Polling is enabled (webhooks might not work properly)" -ForegroundColor Yellow
}

# Check GitHub repository webhooks
Write-Host "`n🔗 Checking GitHub Webhooks..." -ForegroundColor Yellow
Write-Host "Please manually check your GitHub repository webhooks at:" -ForegroundColor Cyan
Write-Host "https://github.com/Prathamwin23/AWS_CDK_PROJECT/settings/hooks" -ForegroundColor Cyan
Write-Host "`nLook for a webhook with URL containing 'codepipeline' and 'amazonaws.com'" -ForegroundColor White

# Check recent pipeline executions
Write-Host "`n📊 Recent Pipeline Executions:" -ForegroundColor Yellow
try {
    $executions = aws codepipeline list-pipeline-executions --pipeline-name $pipelineName --max-items 5 | ConvertFrom-Json
    if ($executions.pipelineExecutionSummaries.Count -eq 0) {
        Write-Host "❌ No recent executions found" -ForegroundColor Red
    } else {
        foreach ($execution in $executions.pipelineExecutionSummaries) {
            $status = $execution.status
            $startTime = $execution.startTime
            $trigger = $execution.trigger.triggerType
            Write-Host "Status: $status | Started: $startTime | Trigger: $trigger" -ForegroundColor White
        }
    }
} catch {
    Write-Host "❌ Could not retrieve pipeline executions" -ForegroundColor Red
}

Write-Host "`n🔧 Troubleshooting Steps:" -ForegroundColor Green
Write-Host "1. Ensure GitHub token has correct permissions (repo, admin:repo_hook)" -ForegroundColor White
Write-Host "2. Check if webhook exists in GitHub repository settings" -ForegroundColor White
Write-Host "3. Try manually triggering pipeline to test build process" -ForegroundColor White
Write-Host "4. If webhook missing, redeploy pipeline: cd my-app-infrastructure && npm run deploy" -ForegroundColor White

Write-Host "`n🚀 To manually trigger pipeline:" -ForegroundColor Cyan
Write-Host "aws codepipeline start-pipeline-execution --name $pipelineName" -ForegroundColor White

Write-Host "`n📝 To test automatic triggering:" -ForegroundColor Cyan
Write-Host "1. Make a small change to any file" -ForegroundColor White
Write-Host "2. git add . && git commit -m 'test pipeline trigger' && git push origin master" -ForegroundColor White
Write-Host "3. Check pipeline console: https://console.aws.amazon.com/codesuite/codepipeline/pipelines/$pipelineName/view" -ForegroundColor White