import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as iam from 'aws-cdk-lib/aws-iam';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { Construct } from 'constructs';
import { CDKContext } from '../types';

interface CloudFrontStackProps {
    websiteBucket: s3.Bucket;
    accessLogsBucket: s3.Bucket;
}

export class CloudFrontStack extends Construct {

    public readonly distribution: cloudfront.Distribution;

    constructor(scope: Construct, id: string, props: CloudFrontStackProps, context: CDKContext){

        super(scope, id);
        const appName = `${context.appName}-${context.stage}`;
        // console.log(appName)

        const {
            websiteBucket,
            accessLogsBucket,
        } = props


        // Create S3 bucket for website hosting (no public access needed)
        /* const websiteBucket = new s3.Bucket(this, `${appName}-WebsiteBucket-${context.env.account}-${context.env.region}`, {
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            removalPolicy: cdk.RemovalPolicy.DESTROY, // Only for development
            autoDeleteObjects: true, // Only for development
            enforceSSL: true, // Enforce SSL/TLS for data in transit
            encryption: s3.BucketEncryption.S3_MANAGED, // Enable server-side encryption by default
            objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED, // Enforce object ownership
        }); */


        // create an Origin Access Identity for CloudFront
        const cloudfrontOAI = new cloudfront.CfnOriginAccessControl(this, `${appName}-cloudfront-OAI`, {
            originAccessControlConfig: {
                name: `${appName}-OAI`,
                description: `${appName}-OAI-Description`,
                originAccessControlOriginType: 's3',
                signingBehavior: 'always',
                signingProtocol: 'sigv4'
            }
        });


        // Create CloudFront distribution
        this.distribution = new cloudfront.Distribution(this, `${appName}-Distribution`, {
            defaultBehavior: {
                origin: origins.S3BucketOrigin.withOriginAccessControl(websiteBucket),
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
                cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
            },
            defaultRootObject: 'index.html',
            errorResponses: [
                {
                    httpStatus: 403,
                    responseHttpStatus: 200,
                    responsePagePath: '/index.html'
                },
                {
                    httpStatus: 404,
                    responseHttpStatus: 200,
                    responsePagePath: '/index.html'
                }
            ],
            // Enable access logging for CloudFront distribution (AwsSolutions-CFR3)
            enableLogging: true,
            logBucket: accessLogsBucket,
            logFilePrefix: `${appName}-cloudfront-logs/`,
            // Set minimum TLS version to 1.2 (AwsSolutions-CFR4)
            minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
            // Explicitly configure certificate to ensure TLS compliance
            sslSupportMethod: cloudfront.SSLMethod.SNI,
        });


        // 🔗 Attach OAC to the CloudFront distribution
        const cfnDistribution = this.distribution.node.defaultChild as cloudfront.CfnDistribution;
        cfnDistribution.addPropertyOverride('DistributionConfig.Origins.0.OriginAccessControlId', cloudfrontOAI.ref);


        websiteBucket.addToResourcePolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                principals: [
                    new iam.ServicePrincipal("cloudfront.amazonaws.com")
                ],
                actions: [ "s3:GetObject"],
                resources: [`${websiteBucket.bucketArn}/*`],
                conditions: {
                    StringEquals: {
                        "AWS:SourceArn": this.distribution.distributionArn,
                    }
                }
            })
        ) 

    }



}