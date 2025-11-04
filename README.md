# 🚀 Django AWS Infrastructure as Code

[![AWS](https://img.shields.io/badge/AWS-Cloud-orange?style=for-the-badge&logo=amazon-aws)](https://aws.amazon.com/)
[![CDK](https://img.shields.io/badge/AWS_CDK-TypeScript-blue?style=for-the-badge&logo=typescript)](https://aws.amazon.com/cdk/)
[![Django](https://img.shields.io/badge/Django-4.2-green?style=for-the-badge&logo=django)](https://www.djangoproject.com/)
[![Docker](https://img.shields.io/badge/Docker-Container-blue?style=for-the-badge&logo=docker)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

> **A production-ready, fully automated cloud infrastructure for deploying Django applications on AWS using Infrastructure as Code (IaC) with AWS CDK and TypeScript.**

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Architecture](#-architecture)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Prerequisites](#-prerequisites)
- [Quick Start](#-quick-start)
- [Project Structure](#-project-structure)
- [Infrastructure Components](#-infrastructure-components)
- [CI/CD Pipeline](#-cicd-pipeline)
- [Commands Reference](#-commands-reference)
- [Monitoring & Logs](#-monitoring--logs)
- [Cost Estimation](#-cost-estimation)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🎯 Overview

This project demonstrates a **complete production-ready infrastructure** for deploying a Django web application on AWS using modern DevOps practices:

- ✅ **Infrastructure as Code** with AWS CDK (TypeScript)
- ✅ **Fully Automated CI/CD** with GitHub integration
- ✅ **Zero-Downtime Deployments** with ECS Fargate
- ✅ **High Availability** across multiple availability zones
- ✅ **Auto-Scaling** based on CPU utilization
- ✅ **Secure** with isolated database subnets and secrets management
- ✅ **Monitored** with CloudWatch alarms and SNS notifications

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         GITHUB REPOSITORY                        │
│                    (Source Code + Dockerfile)                    │
└────────────────┬────────────────────────────────────────────────┘
                 │ Push to master → Triggers Webhook
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      CI/CD PIPELINE                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐                 │
│  │  GitHub  │───►│CodeBuild │───►│   ECS    │                 │
│  │  Source  │    │ +  ECR   │    │  Deploy  │                 │
│  └──────────┘    └──────────┘    └──────────┘                 │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PRODUCTION ENVIRONMENT                        │
│                                                                  │
│  Internet → ALB (Port 80) → ECS Fargate (Port 8000)            │
│                                    ↓                             │
│                              RDS MySQL (Port 3306)              │
│                                                                  │
│  📊 Monitoring: CloudWatch → SNS → Email Alerts                │
└─────────────────────────────────────────────────────────────────┘
```

### Network Architecture

```
VPC (10.0.0.0/16)
├── Public Subnets (2 AZs)
│   ├── Application Load Balancer
│   └── NAT Gateways
├── Private Subnets (2 AZs)
│   └── ECS Fargate Tasks (Django Containers)
└── Database Subnets (2 AZs - Isolated)
    └── RDS MySQL Instance
```

---

## ✨ Features

### Infrastructure
- 🌐 **VPC** with public, private, and isolated database subnets
- 🔀 **Application Load Balancer** with health checks and auto-scaling
- 🐳 **ECS Fargate** for serverless container orchestration
- 💾 **RDS MySQL** with automated backups and encryption
- 🔒 **AWS Secrets Manager** for secure credential storage
- 📦 **ECR** for Docker image storage with vulnerability scanning

### CI/CD
- 🔄 **Automated builds** triggered by GitHub commits
- 🚀 **Zero-downtime deployments** with rolling updates
- 🛡️ **Circuit breaker** for automatic rollback on failures
- 📝 **Build logs** in CloudWatch for debugging

### Operations
- 📊 **CloudWatch monitoring** with custom alarms
- 📧 **SNS notifications** for critical alerts
- 📈 **Auto-scaling** from 1-3 containers based on CPU
- 🔍 **Centralized logging** for all application logs

---

## 🛠️ Tech Stack

### Infrastructure as Code
- **AWS CDK** 2.215.0 (TypeScript)
- **AWS CloudFormation** (generated from CDK)

### Cloud Services
- **VPC** - Network isolation
- **ALB** - Application Load Balancer
- **ECS Fargate** - Serverless containers
- **ECR** - Container registry
- **RDS MySQL** - Managed database
- **CloudWatch** - Monitoring & logging
- **SNS** - Notifications
- **Secrets Manager** - Credential storage
- **CodePipeline** - CI/CD orchestration
- **CodeBuild** - Build automation

### Application
- **Django 4.2.16** - Python web framework
- **MySQL 8.0** - Database
- **Docker** - Containerization
- **Gunicorn** - WSGI HTTP Server
- **WhiteNoise** - Static file serving

---

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

```bash
# Node.js (v18 or later)
node --version

# AWS CLI (configured with credentials)
aws --version
aws configure

# AWS CDK CLI
npm install -g aws-cdk

# Docker (for local testing)
docker --version

# Git
git --version
```

### AWS Account Setup
- AWS Account with admin access
- AWS CLI configured with access keys
- Region: `ap-south-1` (Mumbai)

---

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/Prathamwin23/AWS_CDK_PROJECT.git
cd AWS_CDK_PROJECT
```

### 2. Install Dependencies

```bash
cd my-app-infrastructure
npm install
```

### 3. Bootstrap CDK (One-Time Setup)

```bash
# Bootstrap your AWS account for CDK
cdk bootstrap aws://YOUR_ACCOUNT_ID/ap-south-1
```

### 4. Configure GitHub Integration

```bash
# Windows (PowerShell)
.\setup-github-integration.ps1

# Linux/Mac
chmod +x setup-github-integration.sh
./setup-github-integration.sh
```

**You'll need a GitHub Personal Access Token with these permissions:**
- `repo` (Full control of private repositories)
- `admin:repo_hook` (Full control of repository hooks)

Create token at: https://github.com/settings/tokens/new

### 5. Deploy Infrastructure

```bash
# Deploy all stacks
npm run deploy

# Or deploy individually
cdk deploy dev-VpcStack
cdk deploy dev-RdsStack
cdk deploy dev-EcsStack
cdk deploy dev-CloudWatchStack
cdk deploy dev-CiCdPipelineStack
```

### 6. Trigger First Deployment

```bash
# Make a change
echo "# Initial deployment" >> README.md

# Commit and push (triggers CI/CD automatically)
git add .
git commit -m "Initial deployment"
git push origin master
```

### 7. Access Your Application

After deployment completes (~10 minutes), get your application URL:

```bash
aws elbv2 describe-load-balancers \
  --query 'LoadBalancers[?LoadBalancerName==`dev-django-alb`].DNSName' \
  --output text
```

Open the URL in your browser: `http://dev-django-alb-XXXXXXXXX.ap-south-1.elb.amazonaws.com`

---

## 📁 Project Structure

```
AWS_CDK_PROJECT/
├── my-app-infrastructure/          # Infrastructure as Code
│   ├── bin/
│   │   └── app.ts                  # CDK app entry point
│   ├── lib/
│   │   ├── VpcStack.ts            # VPC and networking
│   │   ├── RdsStack.ts            # Database infrastructure
│   │   ├── EcsStack.ts            # Container orchestration
│   │   ├── CloudWatchStack.ts     # Monitoring and alarms
│   │   └── CiCdPipelineStack.ts   # CI/CD pipeline
│   ├── package.json
│   └── tsconfig.json
│
├── Class_Based_Viewsapp/          # Django application
│   ├── models.py                  # Data models
│   ├── views.py                   # Application logic
│   ├── urls.py                    # URL routing
│   └── management/
│       └── commands/
│           └── populate_data.py   # Sample data generator
│
├── templates/                     # Django templates
│   ├── base.html
│   └── class_based_viewsapp/
│
├── Dockerfile                     # Container build instructions
├── requirements.txt               # Python dependencies
├── bulletproof_settings.py        # Production Django settings
├── bulletproof_urls.py            # URL configuration with health check
├── bulletproof_wsgi.py            # WSGI entry point
├── manage.py                      # Django management script
└── README.md                      # This file
```

---

## 🧩 Infrastructure Components

### 1. VPC Stack
- **CIDR**: 10.0.0.0/16
- **Availability Zones**: 2
- **Subnets**: Public, Private, Database (Isolated)
- **Gateways**: Internet Gateway, NAT Gateways

### 2. RDS Stack
- **Engine**: MySQL 8.0.39
- **Instance Type**: db.t3.micro
- **Storage**: 20 GB encrypted (GP2)
- **Backups**: 7 days retention
- **Multi-AZ**: No (dev environment)

### 3. ECS Stack
- **Cluster**: dev-django-cluster
- **Service**: dev-django-service
- **Task CPU**: 256 (0.25 vCPU)
- **Task Memory**: 512 MB
- **Desired Count**: 1 (auto-scales to 3)

### 4. Application Load Balancer
- **Type**: Application Load Balancer (Layer 7)
- **Listener**: Port 80 (HTTP)
- **Target Port**: 8000 (Django)
- **Health Check**: HTTP GET / every 30s
- **Subnets**: Public (2 AZs)

### 5. CloudWatch Stack
- **Alarms**: No healthy tasks
- **Notifications**: SNS email alerts
- **Log Groups**: Application logs, container logs

### 6. CI/CD Pipeline
- **Source**: GitHub (webhook trigger)
- **Build**: CodeBuild (Docker image)
- **Deploy**: ECS (rolling update)

---

## 🔄 CI/CD Pipeline

### Pipeline Flow

```
1. Developer pushes code to GitHub
   ↓
2. GitHub webhook triggers CodePipeline
   ↓
3. Source Stage: Pull code from GitHub
   ↓
4. Build Stage:
   - CodeBuild builds Docker image
   - Runs tests (if configured)
   - Pushes image to ECR with tags (latest, commit SHA)
   - Creates imagedefinitions.json
   ↓
5. Deploy Stage:
   - ECS pulls new image from ECR
   - Starts new tasks with new image
   - Health checks new tasks (60s grace period)
   - Shifts traffic to healthy tasks
   - Drains connections from old tasks (300s)
   - Terminates old tasks
   ↓
6. Deployment Complete (Total: ~5 minutes)
```

### Zero-Downtime Deployment Strategy

1. **New task starts** with updated image
2. **Health check period** (60 seconds)
3. **ALB validates** new task is healthy
4. **Traffic gradually shifts** to new task
5. **Old task drains** connections (up to 300 seconds)
6. **Old task terminates** after all connections complete

---

## 📝 Commands Referen
