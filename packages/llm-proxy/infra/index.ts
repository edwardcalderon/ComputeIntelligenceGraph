import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Create the complete LLM Proxy infrastructure using SST/Pulumi
 * Defines SQS queues, DynamoDB table, Lambda, API Gateway, IAM roles, SNS topic, and CloudWatch alarms
 * All resources are prefixed with 'llm-proxy-' to avoid naming conflicts
 */
export async function createInfrastructure() {
  const config = new pulumi.Config();
  const stage = pulumi.getStack();
  const region = aws.getRegionOutput().name;

  // ============================================================================
  // SNS Topic for Alerts
  // ============================================================================
  const alertsTopic = new aws.sns.Topic('llm-proxy-alerts', {
    displayName: 'LLM Proxy Alerts',
    tags: {
      Name: 'llm-proxy-alerts',
      Stage: stage,
    },
  });

  // ============================================================================
  // SQS Queues
  // ============================================================================

  // Dead Letter Queue (DLQ)
  const dlq = new aws.sqs.Queue('llm-proxy-dlq', {
    name: 'llm-proxy-dlq',
    messageRetentionSeconds: 1209600, // 14 days
    kmsMasterKeyId: 'alias/aws/sqs', // AWS-managed KMS key for encryption at rest
    tags: {
      Name: 'llm-proxy-dlq',
      Stage: stage,
    },
  });

  // Request Queue (with DLQ redrive policy)
  const requestQueue = new aws.sqs.Queue('llm-proxy-request-queue', {
    name: 'llm-proxy-request-queue',
    visibilityTimeoutSeconds: 120, // 120 seconds for long-running inference
    messageRetentionSeconds: 300, // 5 minutes
    kmsMasterKeyId: 'alias/aws/sqs', // AWS-managed KMS key for encryption at rest
    redrivePolicy: pulumi.interpolate`{
      "deadLetterTargetArn": "${dlq.arn}",
      "maxReceiveCount": 3
    }`,
    tags: {
      Name: 'llm-proxy-request-queue',
      Stage: stage,
    },
  });

  // Response Queue
  const responseQueue = new aws.sqs.Queue('llm-proxy-response-queue', {
    name: 'llm-proxy-response-queue',
    visibilityTimeoutSeconds: 30, // 30 seconds for response retrieval
    messageRetentionSeconds: 300, // 5 minutes
    kmsMasterKeyId: 'alias/aws/sqs', // AWS-managed KMS key for encryption at rest
    tags: {
      Name: 'llm-proxy-response-queue',
      Stage: stage,
    },
  });

  // ============================================================================
  // DynamoDB Table for State Store
  // ============================================================================
  const stateTable = new aws.dynamodb.Table('llm-proxy-state', {
    name: 'llm-proxy-state',
    billingMode: 'PAY_PER_REQUEST', // On-demand billing (within free tier)
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
    tags: {
      Name: 'llm-proxy-state',
      Stage: stage,
    },
  });

  // ============================================================================
  // IAM Role for Proxy Lambda
  // ============================================================================
  const proxyLambdaRole = new aws.iam.Role('llm-proxy-lambda-role', {
    name: 'llm-proxy-lambda-role',
    assumeRolePolicy: JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'sts:AssumeRole',
          Effect: 'Allow',
          Principal: {
            Service: 'lambda.amazonaws.com',
          },
        },
      ],
    }),
    tags: {
      Name: 'llm-proxy-lambda-role',
      Stage: stage,
    },
  });

  // Attach basic Lambda execution policy
  new aws.iam.RolePolicyAttachment('llm-proxy-lambda-basic-execution', {
    role: proxyLambdaRole,
    policyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
  });

  // Policy for SQS access (send to request queue, receive/delete from response queue)
  new aws.iam.RolePolicy('llm-proxy-lambda-sqs-policy', {
    role: proxyLambdaRole,
    policy: pulumi.interpolate`{
      "Version": "2012-10-17",
      "Statement": [
        {
          "Effect": "Allow",
          "Action": [
            "sqs:SendMessage"
          ],
          "Resource": "${requestQueue.arn}"
        },
        {
          "Effect": "Allow",
          "Action": [
            "sqs:ReceiveMessage",
            "sqs:DeleteMessage",
            "sqs:GetQueueAttributes"
          ],
          "Resource": "${responseQueue.arn}"
        }
      ]
    }`,
  });

  // Policy for DynamoDB access (read state table)
  new aws.iam.RolePolicy('llm-proxy-lambda-dynamodb-policy', {
    role: proxyLambdaRole,
    policy: pulumi.interpolate`{
      "Version": "2012-10-17",
      "Statement": [
        {
          "Effect": "Allow",
          "Action": [
            "dynamodb:GetItem",
            "dynamodb:Query"
          ],
          "Resource": "${stateTable.arn}"
        }
      ]
    }`,
  });

  // ============================================================================
  // Lambda Function
  // ============================================================================
  const lambdaFunction = new aws.lambda.Function('llm-proxy-lambda', {
    name: 'llm-proxy-lambda',
    role: proxyLambdaRole.arn,
    handler: 'index.handler',
    runtime: 'nodejs20.x',
    timeout: 90, // 90 seconds timeout for inference
    memorySize: 256, // 256 MB
    code: new pulumi.asset.AssetArchive({
      '.': new pulumi.asset.FileArchive(path.join(__dirname, '../dist')),
    }),
    environment: {
      variables: {
        REQUEST_QUEUE_URL: requestQueue.url,
        RESPONSE_QUEUE_URL: responseQueue.url,
        STATE_TABLE_NAME: stateTable.name,
        AWS_REGION: region,
      },
    },
    tags: {
      Name: 'llm-proxy-lambda',
      Stage: stage,
    },
  });

  // ============================================================================
  // API Gateway HTTP API
  // ============================================================================
  const api = new aws.apigatewayv2.Api('llm-proxy-api', {
    name: 'llm-proxy-api',
    protocolType: 'HTTP',
    tags: {
      Name: 'llm-proxy-api',
      Stage: stage,
    },
  });

  // Lambda integration
  const lambdaIntegration = new aws.apigatewayv2.Integration('llm-proxy-lambda-integration', {
    apiId: api.id,
    integrationType: 'AWS_PROXY',
    integrationMethod: 'POST',
    integrationUri: lambdaFunction.arn,
    payloadFormatVersion: '2.0',
  });

  // Routes: /v1/*, /health, /admin/*, /mcp/*
  const routes = [
    'POST /v1/completions',
    'POST /v1/chat/completions',
    'GET /v1/models',
    'GET /health',
    'GET /admin/sessions',
    'POST /admin/sessions/{sessionId}/terminate',
    'POST /mcp/tools',
    'GET /mcp/tools',
  ];

  for (const routeKey of routes) {
    new aws.apigatewayv2.Route('llm-proxy-route-' + routeKey.replace(/[^a-zA-Z0-9]/g, '-'), {
      apiId: api.id,
      routeKey,
      target: pulumi.interpolate`integrations/${lambdaIntegration.id}`,
    });
  }

  // Default route for catch-all
  new aws.apigatewayv2.Route('llm-proxy-route-default', {
    apiId: api.id,
    routeKey: '$default',
    target: pulumi.interpolate`integrations/${lambdaIntegration.id}`,
  });

  // API Stage
  const apiStage = new aws.apigatewayv2.Stage('llm-proxy-api-stage', {
    apiId: api.id,
    name: stage,
    autoDeploy: true,
    accessLogSettings: {
      destinationArn: pulumi.interpolate`arn:aws:logs:${region}:${aws.getCallerIdentityOutput().accountId}:log-group:/aws/apigateway/llm-proxy-api`,
      format: '$context.requestId $context.error.message $context.error.messageString',
    },
  });

  // Lambda permission for API Gateway
  new aws.lambda.Permission('llm-proxy-lambda-api-permission', {
    action: 'lambda:InvokeFunction',
    function: lambdaFunction,
    principal: 'apigateway.amazonaws.com',
    sourceArn: pulumi.interpolate`${api.executionArn}/*/*`,
  });

  // ============================================================================
  // IAM User for Colab Worker (Least Privilege)
  // ============================================================================
  const workerUser = new aws.iam.User('llm-proxy-worker-user', {
    name: 'llm-proxy-worker-user',
    tags: {
      Name: 'llm-proxy-worker-user',
      Stage: stage,
    },
  });

  // Policy for worker: receive/delete from request queue, send to response queue, read/write state table
  new aws.iam.UserPolicy('llm-proxy-worker-policy', {
    user: workerUser,
    policy: pulumi.interpolate`{
      "Version": "2012-10-17",
      "Statement": [
        {
          "Effect": "Allow",
          "Action": [
            "sqs:ReceiveMessage",
            "sqs:DeleteMessage",
            "sqs:GetQueueAttributes"
          ],
          "Resource": "${requestQueue.arn}"
        },
        {
          "Effect": "Allow",
          "Action": [
            "sqs:SendMessage"
          ],
          "Resource": "${responseQueue.arn}"
        },
        {
          "Effect": "Allow",
          "Action": [
            "dynamodb:GetItem",
            "dynamodb:PutItem",
            "dynamodb:UpdateItem",
            "dynamodb:Query"
          ],
          "Resource": "${stateTable.arn}"
        }
      ]
    }`,
  });

  // ============================================================================
  // CloudWatch Alarms
  // ============================================================================

  // Alarm 1: Request Queue depth > 10 for 5 minutes
  new aws.cloudwatch.MetricAlarm('llm-proxy-alarm-queue-depth', {
    name: 'llm-proxy-alarm-queue-depth',
    comparisonOperator: 'GreaterThanThreshold',
    evaluationPeriods: 1,
    metricName: 'ApproximateNumberOfMessagesVisible',
    namespace: 'AWS/SQS',
    period: 300, // 5 minutes
    statistic: 'Average',
    threshold: 10,
    alarmActions: [alertsTopic.arn],
    dimensions: {
      QueueName: requestQueue.name,
    },
    treatMissingData: 'notBreaching',
    tags: {
      Name: 'llm-proxy-alarm-queue-depth',
      Stage: stage,
    },
  });

  // Alarm 2: DLQ has messages
  new aws.cloudwatch.MetricAlarm('llm-proxy-alarm-dlq', {
    name: 'llm-proxy-alarm-dlq',
    comparisonOperator: 'GreaterThanOrEqualToThreshold',
    evaluationPeriods: 1,
    metricName: 'ApproximateNumberOfMessagesVisible',
    namespace: 'AWS/SQS',
    period: 60,
    statistic: 'Average',
    threshold: 1,
    alarmActions: [alertsTopic.arn],
    dimensions: {
      QueueName: dlq.name,
    },
    treatMissingData: 'notBreaching',
    tags: {
      Name: 'llm-proxy-alarm-dlq',
      Stage: stage,
    },
  });

  // Alarm 3: Lambda errors
  new aws.cloudwatch.MetricAlarm('llm-proxy-alarm-lambda-errors', {
    name: 'llm-proxy-alarm-lambda-errors',
    comparisonOperator: 'GreaterThanOrEqualToThreshold',
    evaluationPeriods: 1,
    metricName: 'Errors',
    namespace: 'AWS/Lambda',
    period: 300,
    statistic: 'Sum',
    threshold: 5,
    alarmActions: [alertsTopic.arn],
    dimensions: {
      FunctionName: lambdaFunction.name,
    },
    treatMissingData: 'notBreaching',
    tags: {
      Name: 'llm-proxy-alarm-lambda-errors',
      Stage: stage,
    },
  });

  // ============================================================================
  // Outputs
  // ============================================================================
  return {
    // Queue URLs
    requestQueueUrl: requestQueue.url,
    responseQueueUrl: responseQueue.url,
    dlqUrl: dlq.url,

    // Queue ARNs
    requestQueueArn: requestQueue.arn,
    responseQueueArn: responseQueue.arn,
    dlqArn: dlq.arn,

    // DynamoDB
    stateTableName: stateTable.name,
    stateTableArn: stateTable.arn,

    // Lambda
    lambdaFunctionName: lambdaFunction.name,
    lambdaFunctionArn: lambdaFunction.arn,

    // API Gateway
    apiEndpoint: pulumi.interpolate`https://${api.id}.execute-api.${region}.amazonaws.com/${stage}`,
    apiId: api.id,

    // IAM
    proxyLambdaRoleArn: proxyLambdaRole.arn,
    workerUserArn: workerUser.arn,

    // SNS
    alertsTopicArn: alertsTopic.arn,
  };
}
