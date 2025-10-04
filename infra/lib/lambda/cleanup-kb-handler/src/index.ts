import type { DynamoDBStreamEvent } from 'aws-lambda'
import { bedrockAgent, logger } from './utils/common'
import { DATA_SOURCE_ID, KNOWLEDGE_BASE_FILES_TABLE, KNOWLEDGE_BASE_ID } from './constants'
import { LambdaResponse } from './models/LambdaResponseModel'
import { DeleteKnowledgeBaseDocumentsCommand } from '@aws-sdk/client-bedrock-agent'
import { BedrockDocumentIdentifier } from './models/BedrockDocumentIdentifierModel'


// Utility to check and return environment variable errors
function checkEnvironmentVariables(): LambdaResponse | null {
    if (!KNOWLEDGE_BASE_ID) {
        logger.error('Knowledge base ID not configured')
        return { statusCode: 500, error: 'Knowledge base ID not configured' }
    }
    if (!DATA_SOURCE_ID) {
        logger.error('Data source ID not configured')
        return { statusCode: 500, error: 'Data source ID not configured' }
    }
    if (!KNOWLEDGE_BASE_FILES_TABLE) {
        logger.error('Knowledge base files table name not configured')
        return { statusCode: 500, error: 'Knowledge base files table name not configured' }
    }
    return null
}

export async function handler(event: DynamoDBStreamEvent): Promise<LambdaResponse | undefined> {

    console.log('[Received event]', JSON.stringify(event, null, 2))

    try {

        // Check environment variables first
        const envError = checkEnvironmentVariables()
        if (envError) {
            return envError
        }

        if (event.Records.length === 0) {
            logger.info('No records to process')
            return { statusCode: 200, message: 'No records to process' }
        }

        let processedCount = 0
        let errorCount = 0

        for (const record of event.Records) {
            // 1. Check for TTL Expiration (REMOVE event from DynamoDB Stream)
            if (record.eventName === 'REMOVE') {
                const userIdentity = record.userIdentity
                const isTTL = userIdentity?.type === 'Service' && userIdentity.principalId === 'dynamodb.amazonaws.com'

                if (isTTL) {
                    const keys = record.dynamodb?.Keys
                    const oldImage = record.dynamodb?.OldImage

                    // DynamoDB Stream payload uses S, N, B for attribute types
                    const fileId = keys?.id?.S
                    const tenantId = keys?.tenantId?.S
                    
                    // Optional metadata for logging
                    const projectId = oldImage?.projectId?.S

                    if (!fileId) {
                        logger.warn('File ID not found in record keys')
                        continue
                    }
                    if (!tenantId) {
                        logger.warn(`Tenant ID not found for file ${fileId}`)
                        continue
                    }
                    
                    logger.info(`Processing expired file: ${fileId}, tenant id: ${tenantId}, project id: ${projectId}`)
                    
                    // 2. Delete the document from the knowledge base
                    try {
                        
                        
                        const documentIdentifiers: BedrockDocumentIdentifier[] = [
                            {
                                custom: { id: fileId },
                                dataSourceType: 'CUSTOM'
                            }
                        ]

                        const deleteCommand = new DeleteKnowledgeBaseDocumentsCommand({
                            clientToken: crypto.randomUUID(),
                            knowledgeBaseId: KNOWLEDGE_BASE_ID!,
                            dataSourceId: DATA_SOURCE_ID!,
                            documentIdentifiers: documentIdentifiers
                        })

                        await bedrockAgent.send(deleteCommand)
                        
                        logger.info(`Deleted document ${fileId} from knowledge base`)
                        processedCount++
                    
                    } catch (e) {
                        errorCount++
                        
                        logger.exception(`Error deleting document ${fileId} from knowledge base: ${e instanceof Error ? e.message : String(e)}`, e as Error)
                        
                    }
                } else {
                    logger.info(`Skipping non-TTL REMOVE event for record: ${JSON.stringify(record)}`)
                }
            } else {
                logger.info(`Skipping non-REMOVE event: ${record.eventName}`)
            }
        }
        
        return {
            statusCode: 200,
            message: `Processed ${processedCount} TTL expiration events with ${errorCount} errors`
        }

        // return createResponse(event, 200, {message: 'Successful response.'})
        
    } catch (error) {
        console.error('Error:', error)
        // return createResponse(event, 500, { message: 'Internal Server Error', error })
    }
    
}





