/// <reference path="./sst-env.d.ts" />

import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';

type PipelinePermissionsMode = 'admin' | 'least-privilege';

interface LLMProxyStackConfig {
  appName: string;
  stage: string;
  region: string;
  domain: string;
  hostedZoneDomain: string;
  imageRepository: string;
  imageUri: string;
  lambdaMemoryMb: number;
  lambdaTimeoutSeconds: number;
  bootstrapOnly: boolean;
  createPipelines: boolean;
  certificateArn?: string;
  projectTag: string;
  pipelineRepo?: string;
  pipelinePrefix: string;
  pipelinePermissionsMode: PipelinePermissionsMode;
  pipelineBranchProduction: string;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`${name} is required`);
  }
  return value;
}

function optionalEnv(name: string): string | undefined {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    return undefined;
  }
  return value;
}

function firstEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const value = optionalEnv(name);
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

function numberEnv(name: string, fallback?: number): number {
  const raw = process.env[name];
  if (!raw || raw.trim() === '') {
    if (fallback === undefined) {
      throw new Error(`${name} is required`);
    }
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be a number`);
  }
  return parsed;
}

function booleanEnv(name: string, fallback = false): boolean {
  const raw = process.env[name];
  if (raw === undefined) {
    return fallback;
  }
  return raw === 'true';
}

function inferHostedZoneDomain(domain: string): string {
  const segments = domain.split('.');
  if (segments.length <= 2) {
    return domain;
  }
  return segments.slice(-2).join('.');
}

function resolveAwsRegion(): string {
  const region = process.env.AWS_REGION ?? process.env.LLM_PROXY_REGION;
  if (!region || region.trim() === '') {
    throw new Error('AWS_REGION is required');
  }
  return region;
}

export function loadLLMProxyStackConfig(): LLMProxyStackConfig {
  const stage = $app.stage;
  const domain = requiredEnv('LLM_PROXY_DOMAIN');
  const bootstrapOnly = booleanEnv('INFRA_LLM_PROXY_BOOTSTRAP_ONLY', false);

  return {
    appName: process.env.INFRA_APP_NAME ?? 'llm-proxy',
    stage,
    region: resolveAwsRegion(),
    domain,
    hostedZoneDomain:
      optionalEnv('LLM_PROXY_HOSTED_ZONE_DOMAIN') ??
      optionalEnv('INFRA_HOSTED_ZONE_DOMAIN') ??
      inferHostedZoneDomain(domain),
    imageRepository: process.env.LLM_PROXY_IMAGE_REPOSITORY ?? 'llm-proxy-production',
    imageUri:
      optionalEnv('LLM_PROXY_IMAGE_URI') ??
      `public.ecr.aws/docker/library/node:22-alpine`,
    lambdaMemoryMb: numberEnv('LLM_PROXY_LAMBDA_MEMORY_MB', 256),
    lambdaTimeoutSeconds: numberEnv('LLM_PROXY_LAMBDA_TIMEOUT_SECONDS', 90),
    bootstrapOnly,
    createPipelines: booleanEnv('INFRA_CREATE_PIPELINES', false),
    certificateArn: optionalEnv('LLM_PROXY_CERTIFICATE_ARN'),
    projectTag: process.env.INFRA_PROJECT_TAG ?? 'llm-proxy',
    pipelineRepo: optionalEnv('INFRA_PIPELINE_REPO'),
    pipelinePrefix: process.env.INFRA_PIPELINE_PREFIX ?? 'llm-proxy',
    pipelinePermissionsMode:
      (process.env.INFRA_PIPELINE_PERMISSIONS_MODE ?? 'admin') === 'least-privilege'
        ? 'least-privilege'
        : 'admin',
    pipelineBranchProduction: process.env.INFRA_PIPELINE_BRANCH_PROD ?? 'main',
  };
}

export function createInfrastructure() {
  const config = loadLLMProxyStackConfig();
  const namePrefix = `${config.appName}-${config.stage}`;
  const tags = {
    project: config.projectTag,
    service: 'llm-proxy',
    stage: config.stage,
    managedBy: 'sst',
  };

  // Create SQS Queues
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

  // Add redrive policy to request queue
  new aws.sqs.QueueRedrivePolicy(`${namePrefix}-request-queue-redrive`, {
    queueUrl: requestQueue.url,
    deadLetterTargetArn: dlq.arn,
    maxReceiveCount: 3,
  });

  // Create DynamoDB Table
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

  // Create SNS Topic for Alerts
  const alertsTopic = new aws.sns.Topic(`${namePrefix}-alerts`, {
    name: `${namePrefix}-alerts`,
    tags,
  });

  // Create CloudWatch Log Group
  const logGroup = new aws.cloudwatch.LogGroup(`${namePrefix}-logs`, {
    name: `/aws/lambda/${namePrefix}`,
    retentionInDays: 30,
    tags,
  });

  // Create IAM Role for Lambda
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

  // Create inline policy for SQS and DynamoDB access
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

  // Create IAM User for Colab Worker
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

  // Create ECR Repository
  const repository = new aws.ecr.Repository(`${namePrefix}-repository`, {
    name: config.imageRepository,
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

  // Create CloudWatch Alarms
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

  const outputs: Record<string, unknown> = {
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
    bootstrapOnly: config.bootstrapOnly,
  };

  // Bootstrap-only deployments are a one-time initialization path
  if (config.bootstrapOnly) {
    return outputs;
  }

  // Create Route 53 DNS record
  const zone = aws.route53.getZoneOutput({
    name: `${config.hostedZoneDomain}.`,
    privateZone: false,
  });

  // Create ACM Certificate if not provided
  const certificate =
    config.certificateArn !== undefined
      ? undefined
      : new aws.acm.Certificate(`${namePrefix}-certificate`, {
          domainName: config.domain,
          validationMethod: 'DNS',
          tags,
        });

  const validationRecord =
    certificate === undefined
      ? undefined
      : new aws.route53.Record(`${namePrefix}-certificate-validation`, {
          zoneId: zone.zoneId,
          name: certificate.domainValidationOptions.apply(
            (options) => options[0]?.resourceRecordName ?? config.domain
          ),
          type: certificate.domainValidationOptions.apply(
            (options) => options[0]?.resourceRecordType ?? 'CNAME'
          ),
          records: certificate.domainValidationOptions.apply((options) => [
            options[0]?.resourceRecordValue ?? '',
          ]),
          ttl: 60,
          allowOverwrite: true,
        });

  const certificateArn =
    config.certificateArn ??
    new aws.acm.CertificateValidation(`${namePrefix}-certificate-validation-complete`, {
      certificateArn: certificate!.arn,
      validationRecordFqdns: [validationRecord!.fqdn],
    }).certificateArn;

  // Create Lambda Function
  const lambdaFunction = new aws.lambda.Function(`${namePrefix}`, {
    name: `${namePrefix}`,
    role: lambdaRole.arn,
    handler: 'index.handler',
    runtime: 'nodejs20.x',
    memorySize: config.lambdaMemoryMb,
    timeout: config.lambdaTimeoutSeconds,
    environment: {
      variables: {
        REQUEST_QUEUE_URL: requestQueue.url,
        RESPONSE_QUEUE_URL: responseQueue.url,
        STATE_TABLE_NAME: stateTable.name,
        ALERTS_TOPIC_ARN: alertsTopic.arn,
      },
    },
    code: new pulumi.asset.AssetArchive({
      '.': new pulumi.asset.FileArchive('./dist'),
    }),
    tags,
  });

  // Create API Gateway HTTP API
  const api = new aws.apigatewayv2.Api(`${namePrefix}-api`, {
    name: `${namePrefix}-api`,
    protocolType: 'HTTP',
    tags,
  });

  // Create Lambda integration
  const integration = new aws.apigatewayv2.Integration(`${namePrefix}-integration`, {
    apiId: api.id,
    integrationType: 'AWS_PROXY',
    integrationMethod: 'POST',
    integrationUri: lambdaFunction.invokeArn,
    payloadFormatVersion: '2.0',
  });

  // Create routes
  const routes = [
    'GET /health',
    'GET /v1/models',
    'POST /v1/chat/completions',
    'POST /v1/completions',
    'GET /admin/sessions',
    'GET /mcp/tools',
  ];

  for (const routeKey of routes) {
    new aws.apigatewayv2.Route(`${namePrefix}-route-${routeKey.replace(/\s+/g, '-')}`, {
      apiId: api.id,
      routeKey,
      target: pulumi.interpolate`integrations/${integration.id}`,
    });
  }

  // Create stage
  const stage = new aws.apigatewayv2.Stage(`${namePrefix}-stage`, {
    apiId: api.id,
    name: config.stage,
    autoDeploy: true,
    accessLogSettings: {
      destinationArn: logGroup.arn,
      format: JSON.stringify({
        requestId: '$context.requestId',
        ip: '$context.identity.sourceIp',
        requestTime: '$context.requestTime',
        httpMethod: '$context.httpMethod',
        resourcePath: '$context.resourcePath',
        status: '$context.status',
        protocol: '$context.protocol',
        responseLength: '$context.responseLength',
        integrationLatency: '$context.integration.latency',
      }),
    },
  });

  // Grant API Gateway permission to invoke Lambda
  new aws.lambda.Permission(`${namePrefix}-api-gateway-invoke`, {
    action: 'lambda:InvokeFunction',
    function: lambdaFunction.name,
    principal: 'apigateway.amazonaws.com',
    sourceArn: pulumi.interpolate`${api.executionArn}/*/*`,
  });

  // Create DNS record for API
  const dnsRecord = new aws.route53.Record(`${namePrefix}-dns`, {
    zoneId: zone.zoneId,
    name: config.domain,
    type: 'A',
    aliases: [
      {
        name: api.apiEndpoint,
        zoneId: 'Z2FDTNDATAQYW2', // CloudFront zone ID (global)
        evaluateTargetHealth: false,
      },
    ],
  });

  outputs.apiEndpoint = api.apiEndpoint;
  outputs.apiUrl = pulumi.interpolate`https://${config.domain}`;
  outputs.dnsRecordName = dnsRecord.fqdn;
  outputs.lambdaFunctionName = lambdaFunction.name;
  outputs.lambdaFunctionArn = lambdaFunction.arn;

  return outputs;
}
