import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { Construct } from 'constructs';
import { CDKContext } from '../types';
import * as path from 'path';


export interface ApiGwStackProps extends cdk.StackProps {
    enableLocalhost: boolean
    projectsFunction: lambda.Function;
    distribution: cloudfront.Distribution
}


export class ApiGwStack extends cdk.Stack {

    // public readonly projectsFunction: lambda.Function;

    constructor(scope: Construct, id: string, props: ApiGwStackProps, context: CDKContext){

        super(scope, id, props);
        const appName = `${context.appName}-${context.stage}`;
        // console.log(appName)

        const {
            enableLocalhost,
            projectsFunction,
            distribution
        } = props


        const api = new apigw.RestApi(this, `${appName}-Api`, {
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

        const projectsAPI = api.root.addResource('projects');

        // GET /projects (list all)
        projectsAPI.addMethod('GET', new apigw.LambdaIntegration(projectsFunction));

        // POST /projects (create new)
        projectsAPI.addMethod('POST', new apigw.LambdaIntegration(projectsFunction));

        // GET /projects/{id} (get single)
        const singleProjectAPI = projectsAPI.addResource('{id}');
        singleProjectAPI.addMethod('GET', new apigw.LambdaIntegration(projectsFunction));
        singleProjectAPI.addMethod('DELETE', new apigw.LambdaIntegration(projectsFunction)); 

    }



}