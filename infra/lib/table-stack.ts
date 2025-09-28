import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { Construct } from 'constructs';
import { CDKContext } from '../types';
import { CreateKBStack } from './create-kb-stack';
import { LambdaStack } from './lambda-stack';
import { ApiGwStack } from './apigw-stack';



export class TableStack extends Construct {

    public readonly projectsTable: dynamodb.Table;
    public readonly projectFilesTable: dynamodb.Table;
    public readonly knowledgeBaseFilesTable: dynamodb.Table;
    public readonly queryRateLimitTable: dynamodb.Table;
    public readonly chatHistoryTable: dynamodb.Table;

    constructor(scope: Construct, id: string, context: CDKContext){

        super(scope, id);
        const appName = `${context.appName}-${context.stage}`;
        // console.log(appName)


        this.projectsTable = new dynamodb.Table(this, `${appName}-ProjectsTable`, {
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

        this.projectFilesTable = new dynamodb.Table(this, `${appName}-ProjectFilesTable`, {
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
        this.projectFilesTable.addGlobalSecondaryIndex({
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
        this.knowledgeBaseFilesTable = new dynamodb.Table(this, `${appName}-KnowledgeBaseFilesTable`, {
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
        this.queryRateLimitTable = new dynamodb.Table(this, `${appName}-QueryRateLimitTable`, {
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
        this.knowledgeBaseFilesTable.addGlobalSecondaryIndex({
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
        this.chatHistoryTable = new dynamodb.Table(this, `${appName}-ChatHistoryTable`, {
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
        this.chatHistoryTable.addGlobalSecondaryIndex({
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

    }



}