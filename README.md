# 🚀 Django on AWS with CDK - Full Stack Deployment

A production-ready Django application deployed on AWS using Infrastructure as Code (CDK), featuring automated CI/CD, containerization, and managed database services.

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Deployment](#deployment)
- [Database Setup](#database-setup)
- [CI/CD Pipeline](#cicd-pipeline)
- [Monitoring & Logs](#monitoring--logs)
- [Cleanup](#cleanup)
- [Troubleshooting](#troubleshooting)

## 🎯 Overview

This project demonstrates a complete AWS cloud deployment of a Django application using modern DevOps practices:

- **Infrastructure as Code** using AWS CDK (TypeScript)
- **Containerized** Django application with Docker
- **Automated CI/CD** pipeline with AWS CodePipeline
- **Managed Database** with Amazon RDS MySQL
- **High Availability** with ECS Fargate and Application Load Balancer
- **API Gateway** for public access
- **Secure Networking** with VPC, private subnets, and security groups

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Internet                                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │   API Gateway        │ (Public Endpoint)
              │  HTTPS Traffic       │
              └──────────┬───────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │  Application Load    │ (Public)
              │     Balancer         │
              └──────────┬───────────┘
                         │
         ┌───────────────┴───────────────┐
         │         VPC (10.0.0.0/16)     │
         │                               │
         │  ┌─────────────────────────┐  │
         │  │  Public Subnets         │  │
         │  │  (10.0.0.0/24, 10.0.1.0/24) │
         │  │  - ALB                  │  │
         │  │  - NAT Gateways         │  │
         │  │  - Internet Gateway     │  │
         │  │  - Bastion Host         │  │
         │  └─────────────────────────┘  │
         │                               │
         │  ┌─────────────────────────┐  │
         │  │  Private Subnets        │  │
         │  │  (10.0.2.0/24, 10.0.3.0/24) │
         │  │                         │  │
         │  │  ┌──────────────────┐   │  │
         │  │  │  ECS Fargate     │   │  │
         │  │  │  Django App      │   │  │
         │  │  │  (Auto-scaling)  │   │  │
         │  │  └──────────────────┘   │  │
         │  └─────────────────────────┘  │
         │                               │
         │  ┌─────────────────────────┐  │
         │  │  Database Subnets       │  │
         │  │  (10.0.4.0/24, 10.0.5.0/24) │
         │  │  (Isolated - No Internet)  │
         │  │                         │  │
         │  │  ┌──────────────────┐   │  │
         │  │  │  RDS MySQL       │   │  │
         │  │  │  (Multi-AZ)      │   │  │
         │  │  └──────────────────┘   │  │
         │  └─────────────────────────┘  │
         └───────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      CI/CD Pipeline                              │
│                                                                  │
│  GitHub → CodePipeline → CodeBuild → ECR → ECS Deploy          │
└─────────────────────────────────────────────────────────────────┘
```

### VPC and Subnet Configuration

The infrastructure uses a **3-tier VPC architecture** with the following subnet types:

#### 1. Public Subnets (10.0.0.0/24, 10.0.1.0/24)
**Resources deployed here:**
- ✅ **Application Load Balancer (ALB)** - Receives traffic from API Gateway
- ✅ **NAT Gateways** - Provides internet access for private subnets
- ✅ **Internet Gateway** - Allows public internet access
- ✅ **Bastion Host (EC2)** - Jump server for database access

**Characteristics:**
- Has direct route to Internet Gateway
- Can receive inbound traffic from internet
- Used for resources that need public IP addresses

#### 2. Private Subnets (10.0.2.0/24, 10.0.3.0/24)
**Resources deployed here:**
- ✅ **ECS Fargate Tasks** - Django application containers
- ✅ **ECS Service** - Container orchestration

**Characteristics:**
- No direct internet access
- Outbound internet via NAT Gateway (for pulling Docker images, etc.)
- Cannot receive inbound traffic from internet
- Can communicate with public and database subnets

#### 3. Database Subnets (10.0.4.0/24, 10.0.5.0/24)
**Resources deployed here:**
- ✅ **RDS MySQL Instance** - Database server

**Characteristics:**
- Completely isolated (no internet access)
- No route to NAT Gateway or Internet Gateway
- Can only communicate within VPC
- Maximum security for sensitive data

**How Database is Accessed (Despite No Internet):**

The database doesn't need internet access because all communication happens **within the VPC**:

1. **ECS Tasks → RDS**: 
   - ECS tasks in private subnets connect to RDS using **private IP addresses**
   - Traffic stays within VPC, never goes to internet
   - Security groups control which services can connect

2. **Bastion Host → RDS**:
   - Bastion in public subnet connects to RDS via **VPC internal routing**
   - Uses private IP address of RDS endpoint
   - No internet involved, just VPC routing tables

3. **Why This Works**:
   ```
   VPC Internal Communication (No Internet Required)
   
   Bastion (10.0.0.x) ──────┐
                             │
                             ├──> VPC Router ──> RDS (10.0.4.x)
                             │
   ECS Task (10.0.2.x) ─────┘
   
   All traffic uses VPC's internal network
   Security Groups act as firewalls
   ```

4. **Security Benefits**:
   - ✅ Database cannot be accessed from internet (even if credentials leak)
   - ✅ No inbound routes from outside VPC
   - ✅ No outbound routes to internet (prevents data exfiltration)
   - ✅ Only authorized VPC resources can connect
   - ✅ All traffic encrypted in transit within VPC

### Subnet Configuration Code

```typescript
// From VpcStack.ts
this.vpc = new ec2.Vpc(this, 'Vpc', {
  maxAzs: 2,  // Deploy across 2 Availability Zones for high availability
  subnetConfiguration: [
    {
      cidrMask: 24,           // 256 IP addresses per subnet
      name: 'public',
      subnetType: ec2.SubnetType.PUBLIC,  // Has Internet Gateway route
    },
    {
      cidrMask: 24,
      name: 'private',
      subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,  // Has NAT Gateway route
    },
    {
      cidrMask: 24,
      name: 'database',
      subnetType: ec2.SubnetType.PRIVATE_ISOLATED,  // No internet access
    },
  ],
});
```

### Resource to Subnet Mapping

| Resource | Subnet Type | CIDR Range | Internet Access | Reason |
|----------|-------------|------------|-----------------|--------|
| **ALB** | Public | 10.0.0.0/24, 10.0.1.0/24 | ✅ Yes (Inbound & Outbound) | Needs to receive traffic from internet |
| **Bastion Host** | Public | 10.0.0.0/24, 10.0.1.0/24 | ✅ Yes (Inbound & Outbound) | Needs SSH/SSM access from internet |
| **NAT Gateway** | Public | 10.0.0.0/24, 10.0.1.0/24 | ✅ Yes (Outbound only) | Provides internet for private subnets |
| **ECS Fargate** | Private | 10.0.2.0/24, 10.0.3.0/24 | ⚠️ Outbound only (via NAT) | Needs to pull Docker images from ECR |
| **RDS MySQL** | Database | 10.0.4.0/24, 10.0.5.0/24 | ❌ No internet access | Maximum security, no external access needed |

### How Database Communication Works (Without Internet)

**Question: If the database subnet has no internet access, how do we connect to it?**

**Answer: All communication happens through VPC's internal network**

```
┌──────────────────────────────────────────────────────────────┐
│                    VPC (10.0.0.0/16)                         │
│                                                              │
│  ┌────────────────┐         VPC Router         ┌──────────┐ │
│  │ Bastion Host   │────────────┬───────────────│   RDS    │ │
│  │ (10.0.0.50)    │            │               │(10.0.4.x)│ │
│  │ Public Subnet  │            │               │ Database │ │
│  └────────────────┘            │               │  Subnet  │ │
│                                │               └──────────┘ │
│  ┌────────────────┐            │                            │
│  │  ECS Task      │────────────┘                            │
│  │ (10.0.2.100)   │                                         │
│  │ Private Subnet │                                         │
│  └────────────────┘                                         │
│                                                              │
│  All connections use PRIVATE IP addresses                   │
│  No traffic leaves the VPC                                  │
└──────────────────────────────────────────────────────────────┘
```

**Connection Flow:**

1. **Application Connects to Database**:
   ```python
   # Django settings.py
   DATABASES = {
       'default': {
           'HOST': 'dev-classic-app-db.cfqe002kq5rb.ap-south-1.rds.amazonaws.com',
           # This DNS resolves to PRIVATE IP: 10.0.4.x
           # Connection stays within VPC
       }
   }
   ```

2. **Bastion Connects to Database**:
   ```bash
   # From bastion host
   mysql -h dev-classic-app-db.cfqe002kq5rb.ap-south-1.rds.amazonaws.com -u classicadmin -p
   # DNS resolves to private IP 10.0.4.x
   # Traffic routed through VPC, not internet
   ```

3. **VPC Routing Table**:
   ```
   Destination         Target
   10.0.0.0/16    →   local (VPC internal routing)
   0.0.0.0/0      →   (no route - isolated subnet)
   ```

**Why This is Secure:**

| Scenario | Result | Reason |
|----------|--------|--------|
| Hacker tries to connect from internet | ❌ **Blocked** | No public IP, no internet route |
| Compromised ECS task tries to exfiltrate data | ❌ **Blocked** | Database subnet has no outbound internet |
| Authorized ECS task connects | ✅ **Allowed** | Security group permits VPC traffic |
| Bastion host connects | ✅ **Allowed** | Security group permits VPC traffic |
| Database tries to call external API | ❌ **Blocked** | No route to internet |

### Security Groups

Each resource has its own security group controlling traffic:

```
┌─────────────────────────────────────────────────────────────┐
│ ALB Security Group                                          │
│ - Inbound: Port 80 from 0.0.0.0/0 (Internet)              │
│ - Outbound: Port 8000 to ECS Security Group                │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ ECS Security Group                                          │
│ - Inbound: Port 8000 from ALB Security Group               │
│ - Outbound: Port 3306 to RDS Security Group                │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ RDS Security Group                                          │
│ - Inbound: Port 3306 from ECS Security Group               │
│ - Inbound: Port 3306 from Bastion Security Group           │
│ - Outbound: None (Database is isolated)                    │
└─────────────────────────────────────────────────────────────┘
                         ▲
                         │
┌─────────────────────────────────────────────────────────────┐
│ Bastion Security Group                                      │
│ - Inbound: Port 22 (SSH) from your IP                      │
│ - Outbound: Port 3306 to RDS Security Group                │
└─────────────────────────────────────────────────────────────┘
```

**Key Point**: Security groups reference each other by ID, not IP addresses. This means:
- ECS can connect to RDS because ECS security group is allowed
- Bastion can connect to RDS because Bastion security group is allowed
- Internet cannot connect to RDS because no security group from outside VPC is allowed

## 🛠️ Tech Stack

### Application
- **Django 4.2.16** - Python web framework
- **MySQL** - Database (via Amazon RDS)
- **Gunicorn** - WSGI HTTP Server
- **Docker** - Containerization

### AWS Services
- **ECS Fargate** - Serverless container orchestration
- **RDS MySQL 8.0** - Managed relational database
- **API Gateway** - HTTP API for public access
- **Application Load Balancer** - Traffic distribution
- **ECR** - Docker container registry
- **CodePipeline** - CI/CD automation
- **CodeBuild** - Build and test automation
- **VPC** - Network isolation
- **CloudWatch** - Logging and monitoring
- **Secrets Manager** - Secure credential storage
- **Systems Manager** - Remote server access

### Infrastructure
- **AWS CDK** - Infrastructure as Code (TypeScript)
- **Node.js** - CDK runtime
- **TypeScript** - Type-safe infrastructure code

## ✅ Prerequisites

Before you begin, ensure you have:

- **AWS Account** with appropriate permissions
- **AWS CLI** configured with credentials
- **Node.js** (v14 or later) and npm
- **AWS CDK** installed globally: `npm install -g aws-cdk`
- **Docker** installed and running
- **Git** for version control
- **GitHub Account** with a repository
- **GitHub Personal Access Token** (for CI/CD)

## 📁 Project Structure

```
.
├── Class_Based_Views/              # Django project settings
│   ├── settings.py
│   ├── urls.py
│   └── wsgi.py
├── Class_Based_Viewsapp/           # Django application
│   ├── models.py                   # Database models
│   ├── views.py                    # View logic
│   ├── urls.py                     # URL routing
│   └── templates/                  # HTML templates
├── my-app-infrastructure/          # AWS CDK Infrastructure
│   ├── bin/
│   │   └── app.ts                  # CDK app entry point
│   ├── lib/
│   │   ├── VpcStack.ts            # VPC and networking
│   │   ├── EcrStack.ts            # Container registry
│   │   ├── RdsStack.ts            # MySQL database
│   │   ├── BastionStack.ts        # Bastion host for DB access
│   │   ├── EcsStack.ts            # ECS Fargate service
│   │   ├── ApiGatewayStack.ts     # API Gateway
│   │   ├── CiCdPipelineStack.ts   # CI/CD pipeline
│   │   └── CloudWatchStack.ts     # Monitoring
│   ├── package.json
│   └── cdk.json
├── Dockerfile                      # Container definition
├── requirements.txt                # Python dependencies
├── bulletproof_settings.py         # Production Django settings
└── README.md                       # This file
```

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd <project-directory>
```

### 2. Install Dependencies

**Python dependencies:**
```bash
pip install -r requirements.txt
```

**CDK dependencies:**
```bash
cd my-app-infrastructure
npm install
cd ..
```

### 3. Configure AWS Credentials

```bash
aws configure
# Enter your AWS Access Key ID
# Enter your AWS Secret Access Key
# Enter your default region (e.g., ap-south-1)
```

### 4. Bootstrap CDK (First time only)

```bash
cd my-app-infrastructure
cdk bootstrap
```

## 📦 Deployment

### Deploy All Infrastructure

```bash
cd my-app-infrastructure
cdk deploy --all --require-approval never
```

This will deploy:
1. **VPC Stack** - Network infrastructure (~2 min)
2. **ECR Stack** - Container registry (~1 min)
3. **RDS Stack** - MySQL database (~10 min)
4. **Bastion Stack** - Database access host (~2 min)
5. **ECS Stack** - Application containers (~5 min)
6. **API Gateway Stack** - Public endpoint (~1 min)
7. **CI/CD Pipeline Stack** - Automation (~2 min)
8. **CloudWatch Stack** - Monitoring (~1 min)

**Total deployment time: ~20-25 minutes**

### Get Deployment Outputs

After deployment, note these important outputs:

```bash
# API Gateway URL (your public endpoint)
dev-ApiGatewayStack.ApiGatewayUrl

# ALB DNS Name
dev-EcsStack.LoadBalancerURL

# RDS Endpoint
dev-RdsStack.DBEndpoint

# Bastion Host ID
dev-BastionStack.BastionHostId
```

## 🗄️ Database Setup

### Connect to Bastion Host and Setup Database

The bastion host is deployed in a public subnet and can be accessed via EC2 Instance Connect or SSH.

#### 1. Get Required Information

```bash
# Get RDS endpoint
RDS_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name dev-RdsStack \
  --query 'Stacks[0].Outputs[?OutputKey==`DBEndpoint`].OutputValue' \
  --output text)

# Get database password
DB_PASSWORD=$(aws secretsmanager get-secret-value \
  --secret-id dev/classic-app/db-credentials \
  --query SecretString \
  --output text | jq -r '.password')

# Get bastion instance ID
BASTION_ID=$(aws cloudformation describe-stacks \
  --stack-name dev-BastionStack \
  --query 'Stacks[0].Outputs[?OutputKey==`BastionHostId`].OutputValue' \
  --output text)

# Get bastion public IP
BASTION_IP=$(aws cloudformation describe-stacks \
  --stack-name dev-BastionStack \
  --query 'Stacks[0].Outputs[?OutputKey==`BastionHostPublicIP`].OutputValue' \
  --output text)

echo "RDS Endpoint: $RDS_ENDPOINT"
echo "Bastion IP: $BASTION_IP"
echo "Bastion Instance ID: $BASTION_ID"
echo "Database Password: $DB_PASSWORD"
```

#### 2. Connect to Bastion Host

**Option A: Using EC2 Instance Connect (Recommended)**

```bash
# Connect via AWS Console
# 1. Go to EC2 Console
# 2. Select the bastion instance
# 3. Click "Connect" → "EC2 Instance Connect"
# 4. Click "Connect"
```

**Option B: Using SSH (if you have a key pair)**

```bash
ssh -i your-key.pem ec2-user@$BASTION_IP
```

**Option C: Using AWS Systems Manager Session Manager**

```bash
aws ssm start-session --target $BASTION_ID
```

#### 3. Install MySQL Client on Bastion Host

Once connected to the bastion host, run:

```bash
# Update system packages
sudo yum update -y

# Install MySQL client
sudo yum install mysql -y

# Verify installation
mysql --version
```

#### 4. Connect to RDS and Create Tables

```bash
# Connect to RDS (replace with your actual values)
mysql -h <RDS-ENDPOINT> -u classicadmin -p classicappdb
# Enter password when prompted

# You should now be in MySQL prompt
# Run the following SQL commands:
```

```sql
-- Create Company table
CREATE TABLE IF NOT EXISTS Class_Based_Viewsapp_comapny (
    id INT AUTO_INCREMENT PRIMARY KEY,
    Name VARCHAR(100) NOT NULL,
    ceo VARCHAR(100) NOT NULL,
    origin VARCHAR(100) NOT NULL,
    est_year INT NOT NULL
);

-- Create Product table
CREATE TABLE IF NOT EXISTS Class_Based_Viewsapp_product (
    id INT AUTO_INCREMENT PRIMARY KEY,
    Prouct_Name VARCHAR(100) NOT NULL,
    color VARCHAR(100) NOT NULL,
    price INT NOT NULL,
    seat_capacitiy INT NOT NULL,
    fuel_type VARCHAR(100) NOT NULL,
    milage INT NOT NULL,
    Comapny_id INT NOT NULL,
    FOREIGN KEY (Comapny_id) REFERENCES Class_Based_Viewsapp_comapny(id) ON DELETE CASCADE
);

-- Insert sample company data
INSERT INTO Class_Based_Viewsapp_comapny (Name, ceo, origin, est_year) VALUES
('Tesla', 'Elon Musk', 'USA', 2003),
('Apple', 'Tim Cook', 'USA', 1976),
('Samsung', 'Lee Jae-yong', 'South Korea', 1938);

-- Insert sample product data
INSERT INTO Class_Based_Viewsapp_product (Prouct_Name, color, price, seat_capacitiy, fuel_type, milage, Comapny_id) VALUES
('Model S', 'Red', 79999, 5, 'Electric', 400, 1),
('iPhone 15', 'Black', 999, 1, 'Battery', 20, 2),
('Galaxy S24', 'Blue', 899, 1, 'Battery', 18, 3);

-- Verify data
SHOW TABLES;
SELECT * FROM Class_Based_Viewsapp_comapny;
SELECT * FROM Class_Based_Viewsapp_product;

-- Exit MySQL
exit;
```

#### 5. Exit Bastion Host

```bash
exit
```

### Quick Setup Script (All-in-One)

Save this as `setup-database.sh` and run it from your local machine:

```bash
#!/bin/bash

# Get values
RDS_ENDPOINT=$(aws cloudformation describe-stacks --stack-name dev-RdsStack --query 'Stacks[0].Outputs[?OutputKey==`DBEndpoint`].OutputValue' --output text)
DB_PASSWORD=$(aws secretsmanager get-secret-value --secret-id dev/classic-app/db-credentials --query SecretString --output text | jq -r '.password')
BASTION_ID=$(aws cloudformation describe-stacks --stack-name dev-BastionStack --query 'Stacks[0].Outputs[?OutputKey==`BastionHostId`].OutputValue' --output text)

echo "==================================="
echo "Database Setup Information"
echo "==================================="
echo "RDS Endpoint: $RDS_ENDPOINT"
echo "Database: classicappdb"
echo "Username: classicadmin"
echo "Password: $DB_PASSWORD"
echo "Bastion Instance: $BASTION_ID"
echo ""
echo "Steps to setup database:"
echo "1. Connect to bastion: aws ssm start-session --target $BASTION_ID"
echo "2. Install MySQL: sudo yum install mysql -y"
echo "3. Connect to RDS: mysql -h $RDS_ENDPOINT -u classicadmin -p classicappdb"
echo "4. Run the SQL commands from the README"
echo "==================================="
```

Make it executable and run:

```bash
chmod +x setup-database.sh
./setup-database.sh
```

### Method 2: Using Session Manager (Requires Plugin Installation)

If you prefer interactive access, install the Session Manager plugin first.

#### Install Session Manager Plugin

**Windows:**
```powershell
# Download installer
Invoke-WebRequest -Uri "https://s3.amazonaws.com/session-manager-downloads/plugin/latest/windows/SessionManagerPluginSetup.exe" -OutFile "$env:TEMP\SessionManagerPluginSetup.exe"

# Run installer
Start-Process -FilePath "$env:TEMP\SessionManagerPluginSetup.exe" -ArgumentList "/quiet" -Wait

# Restart PowerShell
```

**macOS:**
```bash
brew install --cask session-manager-plugin
```

**Linux:**
```bash
curl "https://s3.amazonaws.com/session-manager-downloads/plugin/latest/ubuntu_64bit/session-manager-plugin.deb" -o "session-manager-plugin.deb"
sudo dpkg -i session-manager-plugin.deb
```

#### Connect and Create Tables

```bash
# Connect to bastion
aws ssm start-session --target <bastion-instance-id>

# Once connected, run MySQL commands
mysql -h <rds-endpoint> -u classicadmin -p classicappdb

# Inside MySQL prompt
CREATE TABLE Class_Based_Viewsapp_comapny (
    id INT AUTO_INCREMENT PRIMARY KEY,
    Name VARCHAR(100) NOT NULL,
    ceo VARCHAR(100) NOT NULL,
    origin VARCHAR(100) NOT NULL,
    est_year INT NOT NULL
);

CREATE TABLE Class_Based_Viewsapp_product (
    id INT AUTO_INCREMENT PRIMARY KEY,
    Prouct_Name VARCHAR(100) NOT NULL,
    color VARCHAR(100) NOT NULL,
    price INT NOT NULL,
    seat_capacitiy INT NOT NULL,
    fuel_type VARCHAR(100) NOT NULL,
    milage INT NOT NULL,
    Comapny_id INT NOT NULL,
    FOREIGN KEY (Comapny_id) REFERENCES Class_Based_Viewsapp_comapny(id) ON DELETE CASCADE
);

INSERT INTO Class_Based_Viewsapp_comapny (Name, ceo, origin, est_year) VALUES
('Tesla', 'Elon Musk', 'USA', 2003),
('Apple', 'Tim Cook', 'USA', 1976),
('Samsung', 'Lee Jae-yong', 'South Korea', 1938);

INSERT INTO Class_Based_Viewsapp_product (Prouct_Name, color, price, seat_capacitiy, fuel_type, milage, Comapny_id) VALUES
('Model S', 'Red', 79999, 5, 'Electric', 400, 1),
('iPhone 15', 'Black', 999, 1, 'Battery', 20, 2),
('Galaxy S24', 'Blue', 899, 1, 'Battery', 18, 3);

# Verify
SELECT * FROM Class_Based_Viewsapp_comapny;
SELECT * FROM Class_Based_Viewsapp_product;

# Exit MySQL
exit;

# Exit bastion
exit
```

### 4. Update CSRF Settings

Update `bulletproof_settings.py` with your new endpoints:

```python
CSRF_TRUSTED_ORIGINS = [
    'https://<your-api-gateway-id>.execute-api.ap-south-1.amazonaws.com',
    'http://<your-alb-dns-name>.ap-south-1.elb.amazonaws.com',
]
```

Commit and push to trigger CI/CD:

```bash
git add bulletproof_settings.py
git commit -m "Update CSRF origins"
git push
```

## 🔄 CI/CD Pipeline

The automated pipeline triggers on every push to the `master` branch:

### Pipeline Stages

1. **Source** - Pulls code from GitHub
2. **Build** - Builds Docker image and pushes to ECR
3. **Deploy** - Updates ECS service with new image

### Setup GitHub Integration

1. Create a GitHub Personal Access Token:
   - Go to GitHub Settings → Developer settings → Personal access tokens
   - Generate new token with `repo` and `admin:repo_hook` permissions

2. Store token in AWS Secrets Manager:
```bash
aws secretsmanager create-secret \
  --name github-token \
  --secret-string '{"token":"<your-github-token>"}'
```

3. Update `CiCdPipelineStack.ts` with your repository details

### Monitor Pipeline

```bash
# Check pipeline status
aws codepipeline get-pipeline-state --name dev-django-pipeline

# View build logs
aws codebuild batch-get-builds --ids <build-id>
```

## 📊 Monitoring & Logs

### View Application Logs

```bash
# View ECS logs
aws logs tail /ecs/dev/django-app --follow

# View API Gateway logs
aws logs tail /aws/apigateway/dev-django-api --follow
```

### CloudWatch Metrics

Access CloudWatch dashboard:
- ECS service metrics (CPU, Memory, Task count)
- ALB metrics (Request count, Latency, HTTP errors)
- RDS metrics (Connections, CPU, Storage)

### Health Check

```bash
curl https://<api-gateway-url>/health/
# Expected: {"status": "healthy"}
```

## 🧹 Cleanup

To avoid AWS charges, destroy all resources:

```bash
cd my-app-infrastructure

# Destroy in correct order
cdk destroy dev-RdsStack --force
cdk destroy dev-BastionStack --force
cdk destroy dev-EcsStack --force
cdk destroy dev-ApiGatewayStack --force
cdk destroy dev-CiCdPipelineStack --force
cdk destroy dev-CloudWatchStack --force
cdk destroy dev-EcrStack --force
cdk destroy dev-VpcStack --force
```

Or destroy all at once:
```bash
cdk destroy --all --force
```

**Note:** ECR repository with images needs manual deletion or force flag.

## 🔧 Troubleshooting

### Common Issues

#### 1. Internal Server Error (500)

**Symptom:** API Gateway returns `{"message":"Internal Server Error"}`

**Solution:**
- Check if ALB is public (not internal)
- Verify CSRF_TRUSTED_ORIGINS includes your endpoints
- Check ECS task logs for errors

```bash
aws logs tail /ecs/dev/django-app --since 10m
```

#### 2. Database Connection Errors

**Symptom:** `OperationalError: Can't connect to MySQL server`

**Solution:**
- Verify RDS security group allows traffic from ECS
- Check database credentials in Secrets Manager
- Ensure RDS is in available state

```bash
aws rds describe-db-instances --db-instance-identifier dev-classic-app-db
```

#### 3. Table Doesn't Exist

**Symptom:** `ProgrammingError: Table 'classicappdb.Class_Based_Viewsapp_comapny' doesn't exist`

**Solution:**
- Run database migrations via bastion host
- Verify table names match Django model names exactly

#### 4. CI/CD Pipeline Fails

**Symptom:** Pipeline stuck or failing at build stage

**Solution:**
- Check CodeBuild logs for errors
- Verify GitHub token is valid
- Ensure Docker image builds locally first

```bash
docker build -t test-image .
docker run -p 8000:8000 test-image
```

#### 5. ECS Tasks Not Starting

**Symptom:** Tasks continuously fail health checks

**Solution:**
- Check task definition has correct environment variables
- Verify container has enough memory/CPU
- Check application logs for startup errors

### Useful Commands

```bash
# Check stack status
aws cloudformation describe-stacks --stack-name dev-EcsStack

# List running ECS tasks
aws ecs list-tasks --cluster dev-django-cluster

# Describe ECS service
aws ecs describe-services --cluster dev-django-cluster --services dev-django-service

# Get RDS endpoint
aws rds describe-db-instances --query 'DBInstances[0].Endpoint.Address'

# Test database connection from bastion
mysql -h <rds-endpoint> -u classicadmin -p -e "SHOW DATABASES;"
```

## 📚 Additional Resources

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [Django Documentation](https://docs.djangoproject.com/)
- [ECS Best Practices](https://docs.aws.amazon.com/AmazonECS/latest/bestpracticesguide/)
- [RDS MySQL Documentation](https://docs.aws.amazon.com/rds/mysql/)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License.

## 👤 Author

**Your Name**
- GitHub: [@yourusername](https://github.com/yourusername)

## 🙏 Acknowledgments

- AWS CDK Team for excellent infrastructure tooling
- Django Community for the robust web framework
- Open source contributors

---

**Built with ❤️ using AWS CDK and Django**
