import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam'
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import { Construct } from 'constructs';
import { CDKContext } from '../types';
import { OpenSearchStack } from './open-search-stack';


export interface CreateKBStackProps extends cdk.StackProps {
    knowledgeBaseRole: iam.Role;
}


export class CreateKBStack extends cdk.Stack {

    public readonly knowledgeBase: bedrock.CfnKnowledgeBase;
    public readonly dataSource: bedrock.CfnDataSource;

    constructor(scope: Construct, id: string, props: CreateKBStackProps, context: CDKContext){

        super(scope, id, props);
        const appName = `${context.appName}-${context.stage}`;
        
        const {knowledgeBaseRole} = props

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
                    embeddingModelArn: `arn:aws:bedrock:${cdk.Stack.of(this).region}::foundation-model/amazon.titan-embed-text-v2:0`,
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