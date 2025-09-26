import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { CDKContext } from '../types';


export interface CreateKBStackProps extends cdk.StackProps {
    knowledgeBaseRole: iam.Role;
}


export class CreateKBStack extends cdk.Stack {

    constructor(scope: Construct, id: string, props: CreateKBStackProps, context: CDKContext){

        super(scope, id, props);
        const appName = `${context.appName}-${context.stage}`;
        // console.log(appName)

        


    }



}