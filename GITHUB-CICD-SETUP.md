# GitHub CI/CD Integration Setup

This guide will help you set up a proper CI/CD pipeline that triggers automatically when you push code to GitHub.

## Current Flow: GitHub → CodePipeline → ECS

Instead of the unrealistic S3 source, we now have:
1. **GitHub Repository** (Source)
2. **CodePipeline** (Orchestration) 
3. **CodeBuild** (Build Docker Image)
4. **ECS Deployment** (Deploy to Production)

## Setup Steps

### Step 1: Create GitHub Personal Access Token

1. Go to GitHub Settings: https://github.com/settings/tokens/new
2. Create a new token with these permissions:
   - `repo` (Full control of private repositories)
   - `admin:repo_hook` (Full control of repository hooks)
3. Copy the token (you'll need it in the next step)

### Step 2: Store GitHub Token in AWS

Run the setup script:
```powershell
.\setup-github-integration.ps1
```

Or manually create the secret:
```bash
aws secretsmanager create-secret \
  --name github-token \
  --description "GitHub Personal Access Token for CI/CD Pipeline" \
  --secret-string "your-github-token-here"
```

### Step 3: Deploy Updated CI/CD Stack

```bash
cd my-app-infrastructure
npm run deploy
```

### Step 4: Test the Pipeline

1. Make any change to your code
2. Commit and push to GitHub:
   ```bash
   git add .
   git commit -m "Test CI/CD pipeline"
   git push origin master
   ```
3. The pipeline should automatically trigger!

## Pipeline Stages

1. **Source Stage**: Automatically pulls code from GitHub when you push
2. **Build Stage**: Builds Docker image and pushes to ECR
3. **Deploy Stage**: Deploys new image to ECS

## Monitoring

- **Pipeline Console**: Check AWS CodePipeline console
- **Build Logs**: Check AWS CodeBuild console  
- **Application**: Check ECS service status

## Benefits of This Approach

✅ **Realistic**: Mirrors real-world CI/CD practices
✅ **Automatic**: No manual zip uploads to S3
✅ **Secure**: Uses proper GitHub integration
✅ **Scalable**: Easy to extend with more stages
✅ **Professional**: Industry-standard approach

## Troubleshooting

### Pipeline Not Triggering
- Check GitHub webhook in repository settings
- Verify GitHub token permissions
- Check CodePipeline source configuration

### Build Failures
- Check CodeBuild logs in AWS console
- Verify Dockerfile syntax
- Check ECR permissions

### Deployment Issues
- Check ECS service events
- Verify task definition
- Check security groups and networking