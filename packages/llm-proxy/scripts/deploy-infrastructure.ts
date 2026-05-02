#!/usr/bin/env npx ts-node
/**
 * Manual Infrastructure Deployment Script
 * 
 * This script deploys LLM Proxy infrastructure to AWS using Pulumi
 * One-time job to provision all resources in the CIG account
 * 
 * Usage:
 *   AWS_PROFILE=cig npx ts-node scripts/deploy-infrastructure.ts
 */

import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';

const config = new pulumi.Config();
const appName = process.env.INFRA_APP_NAME || 'llm-proxy';
const stage = 'production';
const namePrefix = `${appName}-${stage}`;
const region = process.env.AWS_REGION || 'us-east-2';

const tags = {
  project: 'llm-proxy',
  service: 'llm-proxy',
  stage: stage,
  managedBy: 'pulumi',
};

console.log(`\n🚀 Deploying LLM Proxy Infrastructure`);
console.log(`   App: ${appName}`);
console.log(`   Stage: ${stage}`);
console.log(`   Region: ${region}`);
console.log(`   Prefix: ${namePrefix}\n`);

// Create SQS Queues
console.log('📦 Creating SQS Queues...');
const requestQueue = new aws.sqs.Queue(`${namePrefix}-request-queue`, {
  name: `${namePrefix}-request-queue`,
  visibilityTimeoutSeconds: 120,
  messageRetentionSeconds: 300,
  receiveWaitTimeSeconds: 20,
  tags,
});

const responseQueue = new aws.sqs.Queue(`${namePrefix}-response-queue`, {
  name: `${namePrefix}-response-queue`,
  visibilityTimeoutSeconds: 30,
  messageRetentionSeconds: 300,
  receiveWaitTimeSeconds: 20,
  tags,
});

const dlq = new aws.sqs.Queue(`${namePrefix}-dlq`, {
  name: `${namePrefix}-dlq`,
  messageRetentionSeconds: 1209600, // 14 days
  tags,
});

// Add redrive policy
new aws.sqs.QueueRedrivePolicy(`${namePrefix}-request-queue-redrive`, {
  queueUrl: requestQueue.url,
  deadLetterTargetArn: dlq.arn,
  maxReceiveCount: 3,
});

console.log('✅ SQS Queues created');

// Create DynamoDB Table
console.log('📦 Creating DynamoDB Table...');
const stateTable = new aws.dynamodb.Table(`${namePrefix}-state`, {
  name: `${namePrefix}-state`,
  billingMode: 'PAY_PER_REQUEST',
  hashKey: 'PK',
  rangeKey: 'SK',
  attributes: [
    { name: 'PK', type: 'S' },
    { name: 'SK', type: 'S' },
  ],
  ttl: {
    attributeName: 'ttl',
    enabled: true,
  },
  tags,
});

console.log('✅ DynamoDB Table created');

// Create SNS Topic
console.log('📦 Creating SNS Topic...');
const alertsTopic = new aws.sns.Topic(`${namePrefix}-alerts`, {
  name: `${namePrefix}-alerts`,
  tags,
});

console.log('✅ SNS Topic created');

// Create CloudWatch Log Group
console.log('📦 Creating CloudWatch Log Group...');
const logGroup = new aws.cloudwatch.LogGroup(`${namePrefix}-logs`, {
  name: `/aws/lambda/${namePrefix}`,
  retentionInDays: 30,
  tags,
});

console.log('✅ CloudWatch Log Group created');

// Create IAM Role for Lambda
console.log('📦 Creating IAM Role for Lambda...');
const lambdaRole = new aws.iam.Role(`${namePrefix}-lambda-role`, {
  name: `${namePrefix}-lambda-role`,
  assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
    Service: 'lambda.amazonaws.com',
  }),
  tags,
});

// Attach basic Lambda execution policy
new aws.iam.RolePolicyAttachment(`${namePrefix}-lambda-basic-execution`, {
  role: lambdaRole.name,
  policyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
});

// Create inline policy for SQS and DynamoDB
new aws.iam.RolePolicy(`${namePrefix}-lambda-policy`, {
  role: lambdaRole.id,
  policy: pulumi.jsonStringify({
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Action: [
          'sqs:SendMessage',
          'sqs:ReceiveMessage',
          'sqs:DeleteMessage',
          'sqs:GetQueueAttributes',
        ],
        Resource: [requestQueue.arn, responseQueue.arn, dlq.arn],
      },
      {
        Effect: 'Allow',
        Action: [
          'dynamodb:GetItem',
          'dynamodb:PutItem',
          'dynamodb:UpdateItem',
          'dynamodb:Query',
          'dynamodb:Scan',
        ],
        Resource: stateTable.arn,
      },
      {
        Effect: 'Allow',
        Action: ['sns:Publish'],
        Resource: alertsTopic.arn,
      },
    ],
  }),
});

console.log('✅ IAM Role created');

// Create IAM User for Colab Worker
console.log('📦 Creating IAM User for Colab Worker...');
const workerUser = new aws.iam.User(`${namePrefix}-worker-user`, {
  name: `${namePrefix}-worker-user`,
  tags,
});

// Create inline policy for worker user
new aws.iam.UserPolicy(`${namePrefix}-worker-policy`, {
  user: workerUser.name,
  policy: pulumi.jsonStringify({
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Action: ['sqs:ReceiveMessage', 'sqs:DeleteMessage', 'sqs:GetQueueAttributes'],
        Resource: requestQueue.arn,
      },
      {
        Effect: 'Allow',
        Action: ['sqs:SendMessage'],
        Resource: responseQueue.arn,
      },
      {
        Effect: 'Allow',
        Action: [
          'dynamodb:GetItem',
          'dynamodb:PutItem',
          'dynamodb:UpdateItem',
          'dynamodb:Query',
        ],
        Resource: stateTable.arn,
      },
    ],
  }),
});

console.log('✅ IAM User created');

// Create ECR Repository
console.log('📦 Creating ECR Repository...');
const repository = new aws.ecr.Repository(`${namePrefix}-repository`, {
  name: `${namePrefix}`,
  imageScanningConfiguration: {
    scanOnPush: true,
  },
  imageTagMutability: 'MUTABLE',
  tags,
});

// Set ECR lifecycle policy
new aws.ecr.LifecyclePolicy(`${namePrefix}-repository-lifecycle`, {
  repository: repository.name,
  policy: JSON.stringify({
    rules: [
      {
        rulePriority: 1,
        description: 'Keep the most recent 10 images',
        selection: {
          tagStatus: 'any',
          countType: 'imageCountMoreThan',
          countNumber: 10,
        },
        action: { type: 'expire' },
      },
    ],
  }),
});

console.log('✅ ECR Repository created');

// Create CloudWatch Alarms
console.log('📦 Creating CloudWatch Alarms...');

new aws.cloudwatch.MetricAlarm(`${namePrefix}-queue-depth-alarm`, {
  name: `${namePrefix}-queue-depth`,
  comparisonOperator: 'GreaterThanThreshold',
  evaluationPeriods: 1,
  metricName: 'ApproximateNumberOfMessagesVisible',
  namespace: 'AWS/SQS',
  period: 300,
  statistic: 'Average',
  threshold: 10,
  alarmActions: [alertsTopic.arn],
  dimensions: {
    QueueName: requestQueue.name,
  },
  tags,
});

new aws.cloudwatch.MetricAlarm(`${namePrefix}-dlq-alarm`, {
  name: `${namePrefix}-dlq-messages`,
  comparisonOperator: 'GreaterThanOrEqualToThreshold',
  evaluationPeriods: 1,
  metricName: 'ApproximateNumberOfMessagesVisible',
  namespace: 'AWS/SQS',
  period: 300,
  statistic: 'Average',
  threshold: 1,
  alarmActions: [alertsTopic.arn],
  dimensions: {
    QueueName: dlq.name,
  },
  tags,
});

new aws.cloudwatch.MetricAlarm(`${namePrefix}-lambda-errors-alarm`, {
  name: `${namePrefix}-lambda-errors`,
  comparisonOperator: 'GreaterThanOrEqualToThreshold',
  evaluationPeriods: 1,
  metricName: 'Errors',
  namespace: 'AWS/Lambda',
  period: 300,
  statistic: 'Sum',
  threshold: 5,
  alarmActions: [alertsTopic.arn],
  dimensions: {
    FunctionName: `${namePrefix}`,
  },
  tags,
});

console.log('✅ CloudWatch Alarms created');

// Export outputs
console.log('\n📊 Infrastructure Deployment Complete!\n');

export const outputs = {
  requestQueueUrl: requestQueue.url,
  responseQueueUrl: responseQueue.url,
  dlqUrl: dlq.url,
  stateTableName: stateTable.name,
  lambdaRoleArn: lambdaRole.arn,
  workerUserName: workerUser.name,
  repositoryName: repository.name,
  repositoryUrl: repository.repositoryUrl,
  alertsTopicArn: alertsTopic.arn,
  logGroupName: logGroup.name,
};

// Print outputs
pulumi.all([
  requestQueue.url,
  responseQueue.url,
  dlq.url,
  stateTable.name,
  lambdaRole.arn,
  workerUser.name,
  repository.name,
  repository.repositoryUrl,
  alertsTopic.arn,
  logGroup.name,
]).apply(([reqUrl, respUrl, dlqUrl, tableName, roleArn, workerName, repoName, repoUrl, topicArn, logName]) => {
  console.log('=== Deployment Outputs ===\n');
  console.log(`Request Queue URL: ${reqUrl}`);
  console.log(`Response Queue URL: ${respUrl}`);
  console.log(`DLQ URL: ${dlqUrl}`);
  console.log(`State Table: ${tableName}`);
  console.log(`Lambda Role ARN: ${roleArn}`);
  console.log(`Worker User: ${workerName}`);
  console.log(`ECR Repository: ${repoName}`);
  console.log(`ECR URL: ${repoUrl}`);
  console.log(`Alerts Topic: ${topicArn}`);
  console.log(`Log Group: ${logName}`);
  console.log('\n✅ All resources deployed successfully!\n');
});
