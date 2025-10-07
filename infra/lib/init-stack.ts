import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as lambda from 'aws-cdk-lib/aws-lambda';

import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

import { Construct } from 'constructs';
import { CDKContext } from '../types';
import { CreateKBStack } from './create-kb-stack';
import { LambdaStack } from './lambda-stack';
import { ApiGwStack } from './apigw-stack';
import { TableStack } from './table-stack';
import { BucketStack } from './bucket-stack';
import { CloudFrontStack } from './cloudfront-stack';
import { tenants } from './tenants-config';



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

        
        


        const tableStack = new TableStack(
            this,
            `${appName}-TableStack`,
            context
        ) 
          

        const bucketStack = new BucketStack(
            this,
            `${appName}-BucketStack`,
            context
        )


        const cloudFrontStack = new CloudFrontStack(
            this,
            `${appName}-CloudFrontStack`,
            {
                websiteBucket: bucketStack.websiteBucket,
                accessLogsBucket: bucketStack.accessLogsBucket,
            },
            context
        )


        // Add CORS configuration if needed
        bucketStack.userFilesBucket.addCorsRule({
            allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET],
            allowedOrigins: enableLocalhost
                ? [`https://${cloudFrontStack.distribution.distributionDomainName}`, 'http://localhost:3000']
                : [`https://${cloudFrontStack.distribution.distributionDomainName}`],
            allowedHeaders: ['*'],
            maxAge: 3000
        });
        

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
                                `arn:aws:bedrock:${this.region}:${this.account}:knowledge-base/*`
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
                                `arn:aws:bedrock:${this.region}::foundation-model/*`
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
                                `arn:aws:aoss:${this.region}:${this.account}:collection/*`
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
        bucketStack.userFilesBucket.grantRead(knowledgeBaseRole);

        

        // Create the OpenSearch and Knowledge Base resources
        const knowledgeBaseStack = new CreateKBStack(
            this, 
            `${appName}-OpenSearchKBStack`, 
            {
                knowledgeBaseRole: knowledgeBaseRole
            },
            context
        );
        


        const allowHeaders = enableLocalhost
            ? 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,Origin'
            : 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token';

        const allowOrigins = enableLocalhost
            ? `https://${cloudFrontStack.distribution.distributionDomainName},http://localhost:3000`
            : `https://${cloudFrontStack.distribution.distributionDomainName}`;


        
        const lambdaStack = new LambdaStack(
            this, 
            `${appName}-LambdaStack`, 
            {
                projectsTable: tableStack.projectsTable, 
                projectFilesTable: tableStack.projectFilesTable, 
                chatHistoryTable: tableStack.chatHistoryTable,
                queryRateLimitTable: tableStack.queryRateLimitTable,
                knowledgeBaseFilesTable: tableStack.knowledgeBaseFilesTable,
                userFilesBucket: bucketStack.userFilesBucket, 
                knowledgeBase: knowledgeBaseStack.knowledgeBase, 
                dataSource: knowledgeBaseStack.dataSource, 
                allowHeaders, 
                allowOrigins,
            },
            context
        )


        const apigwStack = new ApiGwStack(
            this, 
            `${appName}-ApiGwStack`, 
            {
                enableLocalhost,
                projectFilesFunction: lambdaStack.projectFilesFunction,
                projectsFunction: lambdaStack.projectsFunction,
                queryKnowledgeBaseFunction: lambdaStack.queryKnowledgeBaseFunction,
                checkKnowledgeBaseStatusFunction: lambdaStack.checkKnowledgeBaseStatusFunction,
                distribution: cloudFrontStack.distribution
            },
            context
        )
        



        const configContent = JSON.stringify({
            // UserPoolId: userPool.userPoolId,
            // IdentityPoolId: identityPool.ref,
            // ClientId: userPoolClient.userPoolClientId,
            Region: this.region,
            // CognitoDomain: domain.baseUrl(),
            API: apigwStack.api.url,
            Tenants: tenants
        });

        // Deploy static website files to S3
        new s3deploy.BucketDeployment(this, 'WebsiteDeploymentBucket', {
            sources: [
                s3deploy.Source.asset('../ui/.next'),
                s3deploy.Source.data('config.js', `window.config = ${configContent};`)
            ],
            destinationBucket: bucketStack.websiteBucket,
            memoryLimit: 2048
        }); 


        
        // Output values
        // new cdk.CfnOutput(this, `${this.stackName}_UserPoolId`, { value: userPool.userPoolId });
        // new cdk.CfnOutput(this, `${this.stackName}_UserPoolClientId`, { value: userPoolClient.userPoolClientId });
        // new cdk.CfnOutput(this, `${this.stackName}_IdentityPoolId`, { value: identityPool.ref });
        new cdk.CfnOutput(this, `${this.stackName}_DistributionDomainName`, { value: cloudFrontStack.distribution.distributionDomainName });
        new cdk.CfnOutput(this, `${this.stackName}_DistributionId`, { value: cloudFrontStack.distribution.distributionId });
        // new cdk.CfnOutput(this, `${this.stackName}_CognitoDomain`, { value: domain.baseUrl() });
        new cdk.CfnOutput(this, `${this.stackName}_EnableLocalhost`, { value: enableLocalhost.toString() });
        new cdk.CfnOutput(this, `${this.stackName}_WebsiteBucket`, { value: bucketStack.websiteBucket.bucketName });
        new cdk.CfnOutput(this, `${this.stackName}_UserFilesBucket`, { value: bucketStack.userFilesBucket.bucketName });
        new cdk.CfnOutput(this, `${this.stackName}_ProjectsTableName`, { value: tableStack.projectsTable.tableName });
        new cdk.CfnOutput(this, `${this.stackName}_ProjectFilesTableName`, { value: tableStack.projectFilesTable.tableName });
        new cdk.CfnOutput(this, `${this.stackName}_KnowledgeBaseFilesTableName`, { value: tableStack.knowledgeBaseFilesTable.tableName });
        new cdk.CfnOutput(this, `${this.stackName}_ChatHistoryTableName`, { value: tableStack.chatHistoryTable.tableName });
        new cdk.CfnOutput(this, `${this.stackName}_QueryRateLimitTableName`, { value: tableStack.queryRateLimitTable.tableName });
        new cdk.CfnOutput(this, `${this.stackName}_ApiUrl`, { value: apigwStack.api.url });
        new cdk.CfnOutput(this, `${this.stackName}_KnowledgeBaseId`, { value: knowledgeBaseStack.knowledgeBase.attrKnowledgeBaseId });
        new cdk.CfnOutput(this, `${this.stackName}_KnowledgeBaseDataSourceId`, { value: knowledgeBaseStack.dataSource.attrDataSourceId });
        new cdk.CfnOutput(this, `${this.stackName}_ConfigDownloadCommand`, { 
        value: `aws s3 cp s3://${bucketStack.websiteBucket.bucketName}/config.js ./ui/config.js --region ${this.region}` 
        });


    }



}