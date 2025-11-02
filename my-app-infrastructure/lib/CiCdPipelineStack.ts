import * as cdk from 'aws-cdk-lib';
import * as codecommit from 'aws-cdk-lib/aws-codecommit';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface CiCdPipelineStackProps extends cdk.StackProps {
  environment: string;
  ecrRepository: ecr.Repository;
  ecsCluster: ecs.Cluster;
  ecsService: ecs.FargateService;
}

export class CiCdPipelineStack extends cdk.Stack {
  public readonly pipeline: codepipeline.Pipeline;
  public readonly codeRepository: codecommit.Repository;

  constructor(scope: Construct, id: string, props: CiCdPipelineStackProps) {
    super(scope, id, props);

    const { environment, ecrRepository, ecsCluster, ecsService } = props;

    // ========================================================================
    // STEP 1: Create CodeCommit Repository
    // ========================================================================
    this.codeRepository = new codecommit.Repository(this, 'AppRepository', {
      repositoryName: `${environment}-my-app-repo`,
      description: 'Application source code repository',
    });

    // ========================================================================
    // STEP 2: Create CodeBuild Project (Build Docker Image)
    // ========================================================================
    const buildProject = new codebuild.PipelineProject(this, 'BuildProject', {
      projectName: `${environment}-my-app-build`,
      description: 'Build Docker image and push to ECR',
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        privileged: true, // Required for Docker builds
        computeType: codebuild.ComputeType.SMALL,
      },
      environmentVariables: {
        ECR_REPOSITORY_URI: {
          value: ecrRepository.repositoryUri,
        },
        AWS_DEFAULT_REGION: {
          value: this.region,
        },
        AWS_ACCOUNT_ID: {
          value: this.account,
        },
        IMAGE_TAG: {
          value: 'latest',
        },
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          pre_build: {
            commands: [
              'echo Logging in to Amazon ECR...',
              'aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com',
              'COMMIT_HASH=$(echo $CODEBUILD_RESOLVED_SOURCE_VERSION | cut -c 1-7)',
              'IMAGE_TAG=${COMMIT_HASH:=latest}',
            ],
          },
          build: {
            commands: [
              'echo Build started on `date`',
              'echo Building the Docker image...',
              'docker build -t $ECR_REPOSITORY_URI:latest .',
              'docker tag $ECR_REPOSITORY_URI:latest $ECR_REPOSITORY_URI:$IMAGE_TAG',
            ],
          },
          post_build: {
            commands: [
              'echo Build completed on `date`',
              'echo Pushing the Docker images...',
              'docker push $ECR_REPOSITORY_URI:latest',
              'docker push $ECR_REPOSITORY_URI:$IMAGE_TAG',
              'echo Writing image definitions file...',
              'printf \'[{"name":"my-app","imageUri":"%s"}]\' $ECR_REPOSITORY_URI:latest > imagedefinitions.json',
              'cat imagedefinitions.json',
            ],
          },
        },
        artifacts: {
          files: ['imagedefinitions.json'],
        },
      }),
    });

    // Grant permissions to CodeBuild
    ecrRepository.grantPullPush(buildProject);

    // ========================================================================
    // STEP 3: Create CodePipeline
    // ========================================================================
    
    // Artifacts
    const sourceOutput = new codepipeline.Artifact('SourceOutput');
    const buildOutput = new codepipeline.Artifact('BuildOutput');

    // Create Pipeline
    this.pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
      pipelineName: `${environment}-my-app-pipeline`,
      restartExecutionOnUpdate: true,
    });

    // ========================================================================
    // STAGE 1: Source Stage (CodeCommit)
    // ========================================================================
    this.pipeline.addStage({
      stageName: 'Source',
      actions: [
        new codepipeline_actions.CodeCommitSourceAction({
          actionName: 'CodeCommit_Source',
          repository: this.codeRepository,
          branch: 'main',
          output: sourceOutput,
          trigger: codepipeline_actions.CodeCommitTrigger.EVENTS, // Trigger on push
        }),
      ],
    });

    // ========================================================================
    // STAGE 2: Build Stage (CodeBuild)
    // ========================================================================
    this.pipeline.addStage({
      stageName: 'Build',
      actions: [
        new codepipeline_actions.CodeBuildAction({
          actionName: 'Docker_Build',
          project: buildProject,
          input: sourceOutput,
          outputs: [buildOutput],
        }),
      ],
    });

    // ========================================================================
    // STAGE 3: Deploy Stage (ECS)
    // ========================================================================
    this.pipeline.addStage({
      stageName: 'Deploy',
      actions: [
        new codepipeline_actions.EcsDeployAction({
          actionName: 'ECS_Deploy',
          service: ecsService,
          input: buildOutput,
          deploymentTimeout: cdk.Duration.minutes(10),
        }),
      ],
    });

    // ========================================================================
    // Outputs
    // ========================================================================
    new cdk.CfnOutput(this, 'CodeCommitRepositoryUrl', {
      value: this.codeRepository.repositoryCloneUrlHttp,
      description: 'CodeCommit Repository Clone URL (HTTPS)',
      exportName: `${environment}-codecommit-clone-url`,
    });

    new cdk.CfnOutput(this, 'CodeCommitRepositoryName', {
      value: this.codeRepository.repositoryName,
      description: 'CodeCommit Repository Name',
      exportName: `${environment}-codecommit-repo-name`,
    });

    new cdk.CfnOutput(this, 'PipelineName', {
      value: this.pipeline.pipelineName,
      description: 'CodePipeline Name',
      exportName: `${environment}-pipeline-name`,
    });

    new cdk.CfnOutput(this, 'PipelineConsoleUrl', {
      value: `https://${this.region}.console.aws.amazon.com/codesuite/codepipeline/pipelines/${this.pipeline.pipelineName}/view`,
      description: 'CodePipeline Console URL',
    });
  }
}