import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam'
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import { Construct } from 'constructs';
import { CDKContext } from '../types';
import { OpenSearchStack } from './open-search-stack';


export interface CreateKBStackProps {
    knowledgeBaseRole: iam.Role;
} 


export class CreateKBStack extends Construct {
    
    public readonly knowledgeBaseRole: iam.Role;
    public readonly knowledgeBase: bedrock.CfnKnowledgeBase;
    public readonly dataSource: bedrock.CfnDataSource;

    constructor(scope: Construct, id: string, props: CreateKBStackProps, context: CDKContext){

        super(scope, id);
        const appName = `${context.appName}-${context.stage}`;
        
        const {knowledgeBaseRole} = props

        /* const knowledgeBaseRole = new iam.Role(this, `KnowledgeBaseRole`, {
            assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
            roleName: cdk.PhysicalName.GENERATE_IF_NEEDED,
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
        }); */

        // Create the OpenSearch resources using the OpenSearchDirect construct
        const openSearchResources = new OpenSearchStack(
            this, 
            `${appName}-OpenSearchResources`, 
            {
                knowledgeBaseRole: knowledgeBaseRole,
            },
            context
        );


        // Create a knowledge base with the OpenSearch Serverless collection
        this.knowledgeBase = new bedrock.CfnKnowledgeBase(this, `${appName}-KnowledgeBase`, {
            name: `${appName.toLowerCase()}-knowledge-base`,
            description: 'Vector store knowledge base using Titan Text Embeddings V2',
            roleArn: knowledgeBaseRole.roleArn,
            knowledgeBaseConfiguration: {
                type: 'VECTOR',
                vectorKnowledgeBaseConfiguration: {
                    embeddingModelArn: `arn:aws:bedrock:${context.env.region}::foundation-model/amazon.titan-embed-text-v2:0`,
                    embeddingModelConfiguration: {
                        bedrockEmbeddingModelConfiguration: {
                        dimensions: 1024,
                        embeddingDataType: 'FLOAT32'
                        }
                    }
                }
            },
            storageConfiguration: {
                type: 'OPENSEARCH_SERVERLESS',
                opensearchServerlessConfiguration: {
                    collectionArn: openSearchResources.vectorCollection.attrArn,
                    fieldMapping: {
                        vectorField: 'vector_field',
                        textField: 'text_field',
                        metadataField: 'metadata_field'
                    },
                    vectorIndexName: openSearchResources.indexName
                }
            }
            });
            
            // Add dependency to ensure the vector index is created and ready before the knowledge base
            this.knowledgeBase.node.addDependency(openSearchResources.vectorIndex);
            this.knowledgeBase.node.addDependency(openSearchResources.vectorCollection);
            
            // Add explicit dependency on the waitForIndexResource to ensure the index is ready
            this.knowledgeBase.node.addDependency(openSearchResources.waitForIndexResource);

            // Create a data source for the knowledge base
            this.dataSource = new bedrock.CfnDataSource(this, `${appName}-KnowledgeBaseDataSource`, {
                name: `${appName.toLowerCase()}-data-source`,
                description: 'S3 data source for just in time knowledge base',
                knowledgeBaseId: this.knowledgeBase.ref,
                dataSourceConfiguration: {
                    type: 'CUSTOM'
                },
                vectorIngestionConfiguration: {
                    chunkingConfiguration: {
                        chunkingStrategy: 'FIXED_SIZE',
                        fixedSizeChunkingConfiguration: {
                            maxTokens: 300,
                            overlapPercentage: 10
                        }
                    }
                }
            });

            // Add dependency to ensure the knowledge base is created before the data source
            this.dataSource.addDependency(this.knowledgeBase);


    }



}