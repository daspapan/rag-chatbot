import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { CDKContext } from '../types';
import * as path from 'path';


export interface LambdaStackProps {
    projectsTable: dynamodb.Table
    projectFilesTable: dynamodb.Table
    userFilesBucket: s3.Bucket
    knowledgeBase: bedrock.CfnKnowledgeBase
    dataSource: bedrock.CfnDataSource
    allowHeaders: string
    allowOrigins: string
}


export class LambdaStack extends Construct {

    public readonly projectsFunction: lambda.Function;

    constructor(scope: Construct, id: string, props: LambdaStackProps, context: CDKContext){

        super(scope, id);
        const appName = `${context.appName}-${context.stage}`;
        // console.log(appName)

        const {
            projectsTable, 
            projectFilesTable, 
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

    }



}