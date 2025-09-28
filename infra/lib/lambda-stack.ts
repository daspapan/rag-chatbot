import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as path from 'path';
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import { Construct } from 'constructs';
import { CDKContext } from '../types';
import { tenants } from './tenants-config';


export interface LambdaStackProps {
    projectsTable: dynamodb.Table
    projectFilesTable: dynamodb.Table
    chatHistoryTable: dynamodb.Table
    queryRateLimitTable: dynamodb.Table
    knowledgeBaseFilesTable: dynamodb.Table
    userFilesBucket: s3.Bucket
    knowledgeBase: bedrock.CfnKnowledgeBase
    dataSource: bedrock.CfnDataSource
    allowHeaders: string
    allowOrigins: string
}


export class LambdaStack extends Construct {

    public readonly projectsFunction: lambda.Function;
    public readonly projectFilesFunction: lambda.Function;
    public readonly queryKnowledgeBaseFunction: lambda.Function;
    public readonly checkKnowledgeBaseStatusFunction: lambda.Function;
    public readonly cleanupKnowledgeBaseFunction: lambda.Function;

    constructor(scope: Construct, id: string, props: LambdaStackProps, context: CDKContext){

        super(scope, id);
        const appName = `${context.appName}-${context.stage}`;
        // console.log(appName)

        const {
            projectsTable, 
            projectFilesTable, 
            chatHistoryTable,
            queryRateLimitTable,
            knowledgeBaseFilesTable,
            userFilesBucket, 
            knowledgeBase, 
            dataSource, 
            allowHeaders, 
            allowOrigins,
        } = props


        // Common PowerTools environment variables
        const powertoolsEnv = {
            POWERTOOLS_SERVICE_NAME: `${appName}`,
            POWERTOOLS_METRICS_NAMESPACE: `${appName}-LambdaMetrics`,
            LOG_LEVEL: 'INFO',
            POWERTOOLS_LOGGER_LOG_EVENT: 'true',
            POWERTOOLS_LOGGER_SAMPLE_RATE: '0.1',
            POWERTOOLS_TRACER_CAPTURE_RESPONSE: 'true',
            POWERTOOLS_TRACER_CAPTURE_ERROR: 'true',
        };


        const powertoolsLayer = new lambda.LayerVersion(this, `${appName}-Lambda-Layer`, {
            code: lambda.Code.fromAsset(path.join(__dirname, './lambda/layers')),
            compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
            description: 'AI Chatbot Lambda Layer Client library.',
            removalPolicy: cdk.RemovalPolicy.DESTROY
        })

        
        
        this.projectsFunction = new lambda.Function(
            this, 
            `${appName}-ProjectsFunction`, 
            {
                runtime: lambda.Runtime.NODEJS_20_X,
                memorySize: 2048,
                timeout: cdk.Duration.minutes(2),
                handler: 'index.handler',
                code: lambda.Code.fromAsset(path.join(__dirname, './lambda/projects-handler/dist')),
                layers: [powertoolsLayer],
                environment: {
                    USER_FILES_BUCKET: userFilesBucket.bucketName,
                    PROJECTS_TABLE_NAME: projectsTable.tableName,
                    PROJECT_FILES_TABLE: projectFilesTable.tableName,
                    ALLOW_ORIGINS: allowOrigins,
                    ALLOW_HEADERS: allowHeaders,
                    KNOWLEDGE_BASE_ID: knowledgeBase.attrKnowledgeBaseId,
                    DATA_SOURCE_ID: dataSource.attrDataSourceId,
                    // Add PowerTools environment variables
                    ...powertoolsEnv
                },
                architecture: lambda.Architecture.ARM_64,
                // tracing: lambda.Tracing.ACTIVE,
                // logRetention: logs.RetentionDays.ONE_DAY
            }
        );

        projectsTable.grantReadWriteData(this.projectsFunction);
        projectFilesTable.grantReadWriteData(this.projectsFunction);
        userFilesBucket.grantReadWrite(this.projectsFunction);


        // Add permissions for Bedrock knowledge base operations to remove items from KB
        this.projectsFunction.addToRolePolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: [
                    'bedrock:DeleteKnowledgeBaseDocuments',
                    'bedrock:StartIngestionJob',
                    'bedrock:GetKnowledgeBase'
                ],
                resources: [
                    // Specific to the knowledge base being created
                    `arn:aws:bedrock:${context.env.region}:${context.env.account}:knowledge-base/${knowledgeBase.attrKnowledgeBaseId}`
                ]
            })
        );






       
        
        this.projectFilesFunction = new lambda.Function(this, `${appName}-ProjectFilesFunction`, {
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'index.handler',
            memorySize: 2048,
            timeout: cdk.Duration.minutes(2),
            code: lambda.Code.fromAsset(path.join(__dirname, './lambda/project-files-handler/dist')),
            layers: [powertoolsLayer],
            environment: {
                USER_FILES_BUCKET: userFilesBucket.bucketName,
                PROJECT_FILES_TABLE: projectFilesTable.tableName,
                ALLOW_ORIGINS: allowOrigins,
                ALLOW_HEADERS: allowHeaders,
                KNOWLEDGE_BASE_ID: knowledgeBase.attrKnowledgeBaseId,
                DATA_SOURCE_ID: dataSource.attrDataSourceId,
                TENANTS: JSON.stringify({ Tenants: tenants }),
                // Add PowerTools environment variables
                ...powertoolsEnv
            },
            architecture: lambda.Architecture.ARM_64,
            // tracing: lambda.Tracing.ACTIVE,
            // logRetention: logs.RetentionDays.ONE_DAY
        });

        projectFilesTable.grantReadWriteData(this.projectFilesFunction);
        userFilesBucket.grantReadWrite(this.projectFilesFunction);

        // Add permissions for Bedrock knowledge base operations
        this.projectFilesFunction.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'bedrock:DeleteKnowledgeBaseDocuments',
                'bedrock:StartIngestionJob',
                'bedrock:GetKnowledgeBase'
            ],
            resources: [
                // Specific to the knowledge base being created
                `arn:aws:bedrock:${context.env.region}:${context.env.account}:knowledge-base/${knowledgeBase.attrKnowledgeBaseId}`
            ]
        }));


     
        // Create a Lambda function for querying the knowledge base
        this.queryKnowledgeBaseFunction = new lambda.Function(this, `${appName}-QueryKnowledgeBaseFunction`, {
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'index.handler',
            memorySize: 2048,
            timeout: cdk.Duration.minutes(2),
            code: lambda.Code.fromAsset(path.join(__dirname, './lambda/query-kb-handler/dist')),
            layers: [powertoolsLayer],
            environment: {
                KNOWLEDGE_BASE_ID: knowledgeBase.attrKnowledgeBaseId,
                DATA_SOURCE_ID: dataSource.attrDataSourceId,
                ALLOW_ORIGINS: allowOrigins,
                ALLOW_HEADERS: allowHeaders,
                PROJECT_FILES_TABLE: projectFilesTable.tableName,
                CHAT_HISTORY_TABLE: chatHistoryTable.tableName,
                QUERY_RATE_LIMIT_TABLE: queryRateLimitTable.tableName,
                TENANTS: JSON.stringify({ Tenants: tenants }),
                // Add PowerTools environment variables
                ...powertoolsEnv
            },
            architecture: lambda.Architecture.ARM_64,
            // tracing: lambda.Tracing.ACTIVE,
            // logRetention: logs.RetentionDays.ONE_DAY
        });
        projectFilesTable.grantReadData(this.queryKnowledgeBaseFunction);
        projectsTable.grantReadData(this.queryKnowledgeBaseFunction);
        chatHistoryTable.grantReadWriteData(this.queryKnowledgeBaseFunction);
        queryRateLimitTable.grantReadWriteData(this.queryKnowledgeBaseFunction);

        // Add permissions for Bedrock knowledge base operations
        this.queryKnowledgeBaseFunction.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'bedrock:Retrieve',
                'bedrock:RetrieveAndGenerate',
                'bedrock:GetKnowledgeBase'
            ],
            resources: [
                // Specific to the knowledge base being created
                `arn:aws:bedrock:${context.env.region}:${context.env.account}:knowledge-base/${knowledgeBase.attrKnowledgeBaseId}`
            ]
        }));
            
            // Add permission for model invocation
        this.queryKnowledgeBaseFunction.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'bedrock:InvokeModel'
            ],
            resources: [
                // Claude models used for embeddings and retrieval
                `arn:aws:bedrock:${context.env.region}::foundation-model/*`
            ]
        }));






    
        // Create a Lambda function for checking knowledge base status
        this.checkKnowledgeBaseStatusFunction = new lambda.Function(this, `${appName}-CheckKnowledgeBaseStatusFunction`, {
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'index.handler',
            memorySize: 1024,
            timeout: cdk.Duration.minutes(1),
            code: lambda.Code.fromAsset(path.join(__dirname, './lambda/check-kb-status-handler/dist')),
            layers: [powertoolsLayer],
            environment: {
                KNOWLEDGE_BASE_ID: knowledgeBase.attrKnowledgeBaseId,
                DATA_SOURCE_ID: dataSource.attrDataSourceId,
                ALLOW_ORIGINS: allowOrigins,
                ALLOW_HEADERS: allowHeaders,
                PROJECT_FILES_TABLE: projectFilesTable.tableName,
                KNOWLEDGE_BASE_FILES_TABLE: knowledgeBaseFilesTable.tableName,
                TENANTS: JSON.stringify({ Tenants: tenants }),
                // Add PowerTools environment variables
                ...powertoolsEnv
            },
            architecture: lambda.Architecture.ARM_64,
            // tracing: lambda.Tracing.ACTIVE,
            // logRetention: logs.RetentionDays.ONE_DAY
        });

        // Grant permissions for the check status function
        knowledgeBaseFilesTable.grantReadWriteData(this.checkKnowledgeBaseStatusFunction);
        projectFilesTable.grantReadData(this.checkKnowledgeBaseStatusFunction);

        // Add permissions for Bedrock knowledge base operations for the check status function
        this.checkKnowledgeBaseStatusFunction.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'bedrock:GetKnowledgeBase',
                'bedrock:IngestKnowledgeBaseDocuments',
                'bedrock:StartIngestionJob'
            ],
            resources: [
                // Specific to the knowledge base being created
                `arn:aws:bedrock:${context.env.region}:${context.env.account}:knowledge-base/${knowledgeBase.attrKnowledgeBaseId}`
            ]
        }));



    
        // Create a Lambda function to handle TTL-expired documents
        this.cleanupKnowledgeBaseFunction = new lambda.Function(this, `${appName}-CleanupKnowledgeBaseFunction`, {
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'index.handler',
            memorySize: 512,
            timeout: cdk.Duration.minutes(1),
            code: lambda.Code.fromAsset(path.join(__dirname, './lambda/cleanup-kb-handler/dist')),
            layers: [powertoolsLayer],
            environment: {
                KNOWLEDGE_BASE_ID: knowledgeBase.attrKnowledgeBaseId,
                DATA_SOURCE_ID: dataSource.attrDataSourceId,
                KNOWLEDGE_BASE_FILES_TABLE: knowledgeBaseFilesTable.tableName,
                // Add PowerTools environment variables
                ...powertoolsEnv
            },
            architecture: lambda.Architecture.ARM_64,
            // tracing: lambda.Tracing.ACTIVE,
            // logRetention: logs.RetentionDays.ONE_DAY
        });

        // Grant permissions to the cleanup function
        knowledgeBaseFilesTable.grantReadWriteData(this.cleanupKnowledgeBaseFunction);
        this.cleanupKnowledgeBaseFunction.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'bedrock:DeleteKnowledgeBaseDocuments',
                'bedrock:StartIngestionJob',
                'bedrock:GetKnowledgeBase'
            ],
            resources: [
                // Specific to the knowledge base being created
                `arn:aws:bedrock:${context.env.region}:${context.env.account}:knowledge-base/${knowledgeBase.attrKnowledgeBaseId}`
            ]
        }));

            // Configure the Lambda function to be triggered by DynamoDB Streams
            // This will capture TTL expirations through the stream
        this.cleanupKnowledgeBaseFunction.addEventSource(new lambdaEventSources.DynamoEventSource(knowledgeBaseFilesTable, {
            startingPosition: lambda.StartingPosition.TRIM_HORIZON,
            batchSize: 10,
            retryAttempts: 3,
            filters: [
                lambda.FilterCriteria.filter({
                    eventName: lambda.FilterRule.isEqual('REMOVE'),
                    // Filter for TTL expirations specifically
                    userIdentity: {
                        type: lambda.FilterRule.isEqual('Service'),
                        principalId: lambda.FilterRule.isEqual('dynamodb.amazonaws.com')
                    }
                })
            ]
        }));

    

    }



}