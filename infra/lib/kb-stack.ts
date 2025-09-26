import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { Construct } from 'constructs';
import { CDKContext } from '../types';
import { CreateKBStack } from './create-kb-stack';


interface KnowledgeBaseStackProps extends cdk.StackProps {
    enableLocalhost:boolean
}


export class KnowledgeBaseStack extends cdk.Stack {

    constructor(scope: Construct, id: string, props: KnowledgeBaseStackProps, context: CDKContext){

        super(scope, id, props);
        const appName = `${context.appName}-${context.stage}`;
        // console.log(appName)

        const enableLocalhost = props?.enableLocalhost ?? false;

        // const enableLocalhost: = ;


        const projectsTable = new dynamodb.Table(this, `${appName}-ProjectsTable`, {
            partitionKey: {
                name: 'tenantId',
                type: dynamodb.AttributeType.STRING
            },
            sortKey: {
                name: 'id',
                type: dynamodb.AttributeType.STRING
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY, // Only for development
        });

        const projectFilesTable = new dynamodb.Table(this, `${appName}-ProjectFilesTable`, {
            partitionKey: {
                name: 'tenantId',
                type: dynamodb.AttributeType.STRING
            },
            sortKey: {
                name: 'id',
                type: dynamodb.AttributeType.STRING
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY, // Only for development
        });

        // Add the Global Secondary Index
        projectFilesTable.addGlobalSecondaryIndex({
            indexName: 'tenantId-projectId-index',
            partitionKey: {
                name: 'tenantId',
                type: dynamodb.AttributeType.STRING
            },
            sortKey: {
                name: 'projectId',
                type: dynamodb.AttributeType.STRING
            }
        });

        // Create a new table for tracking knowledge base ingested files with TTL
        const knowledgeBaseFilesTable = new dynamodb.Table(this, `${appName}-KnowledgeBaseFilesTable`, {
            partitionKey: {
                name: 'tenantId',
                type: dynamodb.AttributeType.STRING
            },
            sortKey: {
                name: 'id',
                type: dynamodb.AttributeType.STRING
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            timeToLiveAttribute: 'ttl', // Enable TTL for automatic document expiration
            stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES, // Enable DynamoDB Streams
        });
            
        // Create a new table for tracking query rate limits with TTL
        const queryRateLimitTable = new dynamodb.Table(this, `${appName}-QueryRateLimitTable`, {
            partitionKey: {
                name: 'tenantId',
                type: dynamodb.AttributeType.STRING
            },
            sortKey: {
                name: 'timestamp',
                type: dynamodb.AttributeType.NUMBER
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            timeToLiveAttribute: 'ttl', // Enable TTL for automatic cleanup of old records
        });

        // Add the Global Secondary Index
        knowledgeBaseFilesTable.addGlobalSecondaryIndex({
            indexName: 'tenantId-projectId-index',
            partitionKey: {
                name: 'tenantId',
                type: dynamodb.AttributeType.STRING
            },
            sortKey: {
                name: 'projectId',
                type: dynamodb.AttributeType.STRING
            }
        });

        // Create a new table for storing chat history
        const chatHistoryTable = new dynamodb.Table(this, `${appName}-ChatHistoryTable`, {
            partitionKey: {
                name: 'tenantId',
                type: dynamodb.AttributeType.STRING
            },
            sortKey: {
                name: 'id',
                type: dynamodb.AttributeType.STRING
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });

        // Add the Global Secondary Index
        chatHistoryTable.addGlobalSecondaryIndex({
            indexName: 'tenantId-userId-index',
            partitionKey: {
                name: 'tenantId',
                type: dynamodb.AttributeType.STRING
            },
            sortKey: {
                name: 'userId',
                type: dynamodb.AttributeType.STRING
            }
        });




        // Create S3 bucket for CloudFront access logs
        const accessLogsBucket = new s3.Bucket(this, `${appName}-AccessLogsBucket`, {
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            autoDeleteObjects: true, // Only for development
            enforceSSL: true,
            encryption: s3.BucketEncryption.S3_MANAGED,
            // CloudFront logging requires ACLs to be enabled
            objectOwnership: s3.ObjectOwnership.OBJECT_WRITER, // Allow the CloudFront logging service to write logs
            removalPolicy: cdk.RemovalPolicy.DESTROY, // Only for development
        });


        const userFilesBucket = new s3.Bucket(this, `${appName}-UserFilesBucket`, {
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            encryption: s3.BucketEncryption.S3_MANAGED,
            enforceSSL: true,
            removalPolicy: cdk.RemovalPolicy.DESTROY, // Only for development
            autoDeleteObjects: true // Only for development
        });


        // Create CloudFront distribution
        const distribution = new cloudfront.Distribution(this, `${appName}-Distribution`, {
            defaultBehavior: {
                origin: origins.S3BucketOrigin.withOriginAccessControl(userFilesBucket),
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
                cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
            },
            // Enable access logging for CloudFront distribution (AwsSolutions-CFR3)
            enableLogging: true,
            logBucket: accessLogsBucket,
            logFilePrefix: 'cloudfront-logs/',
            // Set minimum TLS version to 1.2 (AwsSolutions-CFR4)
            minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
            // Explicitly configure certificate to ensure TLS compliance
            sslSupportMethod: cloudfront.SSLMethod.SNI,
        });

        // Add CORS configuration if needed
        userFilesBucket.addCorsRule({
            allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET],
            allowedOrigins: enableLocalhost
                ? [`https://${distribution.distributionDomainName}`, 'http://localhost:3000']
                : [`https://${distribution.distributionDomainName}`],
            allowedHeaders: ['*'],
            maxAge: 3000
        });



        // Create the knowledge base role with least privilege permissions
        const knowledgeBaseRole = new iam.Role(this, `${appName}-KnowledgeBaseRole`, {
            assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
            inlinePolicies: {
                knowledgeBasePolicy: new iam.PolicyDocument({
                    statements: [
                        // Bedrock permissions for knowledge base operations
                        new iam.PolicyStatement({
                            effect: iam.Effect.ALLOW,
                            actions: [
                                'bedrock:GetKnowledgeBase',
                                'bedrock:StartIngestionJob',
                                'bedrock:GetIngestionJob',
                                'bedrock:ListIngestionJobs',
                                'bedrock:IngestKnowledgeBaseDocuments',
                                'bedrock:DeleteKnowledgeBaseDocuments',
                                'bedrock:Retrieve',
                                'bedrock:RetrieveAndGenerate'
                            ],
                            resources: [
                                // Specific to the knowledge base being created
                                `arn:aws:bedrock:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:knowledge-base/*`
                            ]
                        }),

                        // Bedrock model invocation permissions
                        new iam.PolicyStatement({
                            effect: iam.Effect.ALLOW,
                            actions: [
                                'bedrock:InvokeModel'
                            ],
                            resources: [
                                // Claude models used for embeddings and retrieval
                                `arn:aws:bedrock:${cdk.Stack.of(this).region}::foundation-model/*`
                            ]
                        }),

                        // OpenSearch Serverless permissions
                        new iam.PolicyStatement({
                            effect: iam.Effect.ALLOW,
                            actions: [
                                'aoss:APIAccessAll',
                                'aoss:BatchGetCollection',
                                'aoss:CreateCollection',
                                'aoss:CreateSecurityPolicy',
                                'aoss:GetAccessPolicy',
                                'aoss:UpdateAccessPolicy',
                                'aoss:CreateAccessPolicy',
                                'aoss:GetSecurityPolicy',
                                'aoss:UpdateSecurityPolicy'
                            ],
                            resources: [
                                // Specific to collections in this account
                                `arn:aws:aoss:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:collection/*`
                            ]
                        }),

                        // OpenSearch data access permissions
                        new iam.PolicyStatement({
                            effect: iam.Effect.ALLOW,
                            actions: [
                                'aoss:ReadDocument',
                                'aoss:WriteDocument',
                                'aoss:DeleteDocument',
                                'aoss:CreateIndex',
                                'aoss:DeleteIndex',
                                'aoss:UpdateIndex'
                            ],
                            resources: [
                                // Specific to collections and indexes in this account
                                `arn:aws:aoss:${this.region}:${this.account}:collection/*`
                            ]
                        })
                    ]
                })
            }
        });

        // Grant S3 read permissions to the knowledge base role
        userFilesBucket.grantRead(knowledgeBaseRole);



        // Create the OpenSearch and Knowledge Base resources
        const createKbStack = new CreateKBStack(
            this, 
            `${appName}-OpenSearchKBStack`, 
            {
                knowledgeBaseRole: knowledgeBaseRole,
            },
            context
        );


    }



}