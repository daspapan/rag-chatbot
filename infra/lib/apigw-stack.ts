import * as cdk from 'aws-cdk-lib';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { Construct } from 'constructs';
import { CDKContext } from '../types';


export interface ApiGwStackProps {
    enableLocalhost: boolean;
    projectFilesFunction: lambda.Function;
    projectsFunction: lambda.Function;
    queryKnowledgeBaseFunction: lambda.Function;
    checkKnowledgeBaseStatusFunction: lambda.Function;
    distribution: cloudfront.Distribution;
}


export class ApiGwStack extends Construct {

    public readonly api: apigw.RestApi;

    constructor(scope: Construct, id: string, props: ApiGwStackProps, context: CDKContext){

        super(scope, id);
        const appName = `${context.appName}-${context.stage}`;
        // console.log(appName)

        const {
            enableLocalhost,
            projectFilesFunction,
            projectsFunction,
            queryKnowledgeBaseFunction,
            checkKnowledgeBaseStatusFunction,
            distribution
        } = props


        this.api = new apigw.RestApi(this, `${appName}-Api`, {
            defaultCorsPreflightOptions: {
                allowOrigins: enableLocalhost
                ? [
                    `https://${distribution.distributionDomainName}`,
                    'http://localhost:3000'
                ]
                : [`https://${distribution.distributionDomainName}`],
                allowMethods: ['GET', 'OPTIONS', 'POST', 'PUT', 'DELETE'],
                allowHeaders: [
                    'Content-Type',
                    'X-Amz-Date',
                    'Authorization',
                    'X-Api-Key',
                    'X-Amz-Security-Token'
                ],
                allowCredentials: true
            }
        });



        // Add the API Gateway resources and methods
        const projectFilesAPI = this.api.root.addResource('project-files');

        // Add a resource for uploading files
        // POST /project-files
        projectFilesAPI.addMethod('POST', new apigw.LambdaIntegration(projectFilesFunction));

        // Add a resource for getting files by project ID
        // GET /project-files/{projectId}
        const projectIdFiles = projectFilesAPI.addResource('{projectId}');
        projectIdFiles.addMethod('GET', new apigw.LambdaIntegration(projectFilesFunction));
        projectIdFiles.addMethod('POST', new apigw.LambdaIntegration(projectFilesFunction));

        // Add a resource for operations on single files
        // GET/DELETE /project-files/{projectId}/{id}
        const singleProjectFile = projectIdFiles.addResource('{id}');
        singleProjectFile.addMethod('GET', new apigw.LambdaIntegration(projectFilesFunction));
        singleProjectFile.addMethod('DELETE', new apigw.LambdaIntegration(projectFilesFunction));

        // GET presigned url /project-files/{projectId}/download/{id}
        const projectDownloadFile = projectIdFiles.addResource('download').addResource('{id}');
        projectDownloadFile.addMethod('GET', new apigw.LambdaIntegration(projectFilesFunction));




        const projectsAPI = this.api.root.addResource('projects');

        // GET /projects (list all)
        projectsAPI.addMethod('GET', new apigw.LambdaIntegration(projectsFunction));

        // POST /projects (create new)
        projectsAPI.addMethod('POST', new apigw.LambdaIntegration(projectsFunction));

        // GET /projects/{id} (get single)
        const singleProjectAPI = projectsAPI.addResource('{id}');
        singleProjectAPI.addMethod('GET', new apigw.LambdaIntegration(projectsFunction));
        singleProjectAPI.addMethod('DELETE', new apigw.LambdaIntegration(projectsFunction)); 






        // Add the API Gateway resource and method for knowledge base queries
        const knowledgeBaseAPI = this.api.root.addResource('knowledge-base');
        const queryResource = knowledgeBaseAPI.addResource('query');
        queryResource.addMethod('POST', new apigw.LambdaIntegration(queryKnowledgeBaseFunction));

        // Add a new endpoint for checking knowledge base status
        const statusResource = knowledgeBaseAPI.addResource('status');
        statusResource.addMethod('POST', new apigw.LambdaIntegration(checkKnowledgeBaseStatusFunction));

        // GET/DELETE /history
        const knowledgeBaseChatHistoryResource = knowledgeBaseAPI.addResource('history');
        const reportResultKnowledgeBaseChatHistoryResource = knowledgeBaseChatHistoryResource.addResource('{id}');
        reportResultKnowledgeBaseChatHistoryResource.addMethod('GET', new apigw.LambdaIntegration(queryKnowledgeBaseFunction));
        reportResultKnowledgeBaseChatHistoryResource.addMethod('DELETE', new apigw.LambdaIntegration(queryKnowledgeBaseFunction));


        /* 
        
        const api = new apigw.RestApi(this, `${this.stackName}Api`, {
      defaultCorsPreflightOptions: {
        allowOrigins: enableLocalhost
          ? [
            `https://${distribution.distributionDomainName}`,
            'http://localhost:8000'
          ]
          : [`https://${distribution.distributionDomainName}`],
        allowMethods: ['GET', 'OPTIONS', 'POST', 'PUT', 'DELETE'],
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token'
        ],
        allowCredentials: true
      }
    });
    
    // Add request validation to address AwsSolutions-APIG2
    const basicValidator = api.addRequestValidator('basicValidator', {
      validateRequestBody: true,
      validateRequestParameters: true
    });

    const auth = new apigateway.CognitoUserPoolsAuthorizer(this, 'APIAuthorizer', {
      cognitoUserPools: [userPool]
    });

    





    

        */

    }



}