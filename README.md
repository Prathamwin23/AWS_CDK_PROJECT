🚀 Django on AWS CDK – Fully Automated DevOps Infrastructure

A production-grade Django web application deployed on AWS using CDK, ECS (Fargate), RDS, ECR, and CodePipeline for full CI/CD automation.

🏗️ Project Overview

This project demonstrates a complete DevOps pipeline — from infrastructure provisioning to CI/CD and monitoring — built entirely with AWS CDK.

🧰 Tech Stack

AWS Services: VPC, ECS Fargate, RDS MySQL, ECR, ALB, CloudWatch, Secrets Manager

CI/CD: AWS CodePipeline, CodeBuild

Infrastructure as Code: AWS CDK (TypeScript)

Application: Django (Python)

Containerization: Docker

📦 Infrastructure Stacks
Stack Name	Description
VpcStack	Creates custom VPC with public & private subnets
RdsStack	Deploys RDS MySQL database in private subnet
EcsStack	Defines ECS cluster, Fargate service, and ALB
CiCdPipelineStack	Automates builds & deployments from GitHub
⚙️ AWS CDK Commands
🚀 Deploy Infrastructure
cd my-app-infrastructure
npm install
cdk bootstrap
cdk deploy --all

🔄 Update Specific Stacks
cdk diff
cdk deploy VpcStack
cdk deploy RdsStack
cdk deploy EcsStack
cdk deploy CiCdPipelineStack

🧹 Destroy Everything
cdk destroy --all

🐳 Docker Commands
🧱 Build and Test Locally
docker build -t django-app .
docker run -p 8000:8000 django-app

☁️ Push to ECR
aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin 516268691462.dkr.ecr.ap-south-1.amazonaws.com
docker tag django-app:latest 516268691462.dkr.ecr.ap-south-1.amazonaws.com/dev/django-app:latest
docker push 516268691462.dkr.ecr.ap-south-1.amazonaws.com/dev/django-app:latest

📊 ECS Monitoring Commands
🔍 Check Service Status
aws ecs describe-services --cluster dev-django-cluster --services dev-django-service --region ap-south-1

🧾 List Running Tasks
aws ecs list-tasks --cluster dev-django-cluster --service dev-django-service --region ap-south-1

❤️ Check Task Health
aws ecs describe-tasks --cluster dev-django-cluster --tasks TASK_ID --region ap-south-1 --query 'tasks[0].containers[0].healthStatus'

🔁 Force New Deployment
aws ecs update-service --cluster dev-django-cluster --service dev-django-service --force-new-deployment --region ap-south-1

🪵 Logs & Debugging
📜 Get Application Logs
aws logs describe-log-streams --log-group-name "/ecs/dev/django-app" --region ap-south-1 --order-by LastEventTime --descending --max-items 1
aws logs get-log-events --log-group-name "/ecs/dev/django-app" --log-stream-name "STREAM_NAME" --region ap-south-1

🔍 Test ALB Health
curl -I http://dev-django-alb-1402722688.ap-south-1.elb.amazonaws.com/

🔄 CI/CD Pipeline Commands
📈 Check Pipeline Status
aws codepipeline get-pipeline-state --name dev-my-app-pipeline --region ap-south-1

🚀 Trigger Manual Build
aws codepipeline start-pipeline-execution --name dev-my-app-pipeline --region ap-south-1

🗄️ Database Commands
💾 Connect to RDS
mysql -h dev-classic-app-db.cfqe002kq5rb.ap-south-1.rds.amazonaws.com -u classicadmin -p classicappdb

🔐 Retrieve DB Credentials
aws secretsmanager get-secret-value --secret-id "dev/classic-app/db-credentials" --region ap-south-1

🧑‍💻 Django Local Development
⚙️ Run Locally
python manage.py runserver
python manage.py makemigrations
python manage.py migrate
python manage.py populate_data

📝 Git Commands
🪄 Deploy Changes (Triggers CI/CD)
git add .
git commit -m "Your message"
git push origin master

🚨 Emergency Commands
⛔ Stop All ECS Tasks
aws ecs update-service --cluster dev-django-cluster --service dev-django-service --desired-count 0 --region ap-south-1

🔁 Restart ECS Service
aws ecs update-service --cluster dev-django-cluster --service dev-django-service --desired-count 1 --region ap-south-1

🔎 Check Latest Task Definitions
aws ecs list-task-definitions --family-prefix dev-django-app --region ap-south-1 --sort DESC --max-items 3

💡 Pro Tips

🧠 Always check logs first when debugging

📊 Use --query and --output text for clean outputs

🚀 Every git push auto-triggers CI/CD

⏳ ALB health checks take 2–3 minutes to stabilize

🌐 Keep your ALB URL handy for quick testing

👨‍💻 Author

Pratham Patel
AWS | DevOps | Python | Cloud Automation
📍 LinkedIn
 • ✉️ pratham@example.com

⭐ If you found this project useful, please give it a star!
