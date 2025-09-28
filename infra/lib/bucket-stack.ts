import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3'
import { Construct } from 'constructs';
import { CDKContext } from '../types';



export class BucketStack extends Construct {

    public readonly websiteBucket: s3.Bucket;
    public readonly accessLogsBucket: s3.Bucket;
    public readonly userFilesBucket: s3.Bucket;

    constructor(scope: Construct, id: string, context: CDKContext){

        super(scope, id);
        const appName = `${context.appName}-${context.stage}`;
        // console.log(appName)


        // Create S3 bucket for website hosting (no public access needed)
        this.websiteBucket = new s3.Bucket(this, `${appName}-WebsiteBucket-${context.env.account}-${context.env.region}`, {
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            removalPolicy: cdk.RemovalPolicy.DESTROY, // Only for development
            autoDeleteObjects: true, // Only for development
            enforceSSL: true, // Enforce SSL/TLS for data in transit
            encryption: s3.BucketEncryption.S3_MANAGED, // Enable server-side encryption by default
            objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED, // Enforce object ownership
        });


        // Create S3 bucket for CloudFront access logs
        this.accessLogsBucket = new s3.Bucket(this, `${appName}-AccessLogsBucket-${context.env.account}-${context.env.region}`, {
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            autoDeleteObjects: true, // Only for development
            enforceSSL: true,
            encryption: s3.BucketEncryption.S3_MANAGED,
            // CloudFront logging requires ACLs to be enabled
            objectOwnership: s3.ObjectOwnership.OBJECT_WRITER, // Allow the CloudFront logging service to write logs
            removalPolicy: cdk.RemovalPolicy.DESTROY, // Only for development
        });


        this.userFilesBucket = new s3.Bucket(this, `${appName}-UserFilesBucket-${context.env.account}-${context.env.region}`, {
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            encryption: s3.BucketEncryption.S3_MANAGED,
            enforceSSL: true,
            removalPolicy: cdk.RemovalPolicy.DESTROY, // Only for development
            autoDeleteObjects: true // Only for development
        });

    }



}