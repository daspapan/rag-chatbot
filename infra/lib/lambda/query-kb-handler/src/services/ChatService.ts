import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { 
    DynamoDBDocumentClient, 
    PutCommand, 
    QueryCommand, 
    BatchWriteCommand 
} from '@aws-sdk/lib-dynamodb'
import { 
    BedrockAgentRuntimeClient, 
    RetrieveAndGenerateCommand, 
    RetrieveAndGenerateCommandInput, 
    RetrieveAndGenerateCommandOutput 
} from '@aws-sdk/client-bedrock-agent-runtime'
import { 
    CHAT_HISTORY_TABLE, 
    QUERY_RATE_LIMIT_TABLE 
} from '../constants'
import { batchDeleteItems, logger } from '../utils/common'
import { TenantConfig } from '../models/TenantConfigModel'
import { QueryRecord } from '../models/QueryRecordModel'
import { ChatMessage } from '../models/ChatMessageModel'



// AWS SDK v3 clients
const ddbClient = new DynamoDBClient({})
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient)
const bedrockAgentRuntimeClient = new BedrockAgentRuntimeClient({})

const TENANTS_CONFIG: TenantConfig[] = JSON.parse(process.env.TENANTS || '{"Tenants":[]}').Tenants




/**
 * Save a chat message to the chat history table
 */
export async function saveChatMessage(
    sessionId: string, 
    userId: string, 
    tenantId: string, 
    projectId: string, 
    messageType: ChatMessage['type'], 
    content: string, 
    timestamp: number, 
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sources: any[] | null = null
): Promise<boolean> {
    const item: ChatMessage = {
        id: crypto.randomUUID(),
        sessionId,
        tenantId,
        userId,
        projectId,
        type: messageType,
        content,
        timestamp
    }
    
    if (sources) {
        item.sources = sources
    }
    
    try {
        const command = new PutCommand({
            TableName: CHAT_HISTORY_TABLE,
            Item: item,
        })
        await ddbDocClient.send(command)
        logger.info(`Saved chat message for session ${sessionId}`)
        return true
    } catch (e) {
        logger.error(`Error saving chat message: ${JSON.stringify(e, null, 2)}`)
        return false
    }
}

/**
 * Retrieve chat history for a specific tenant and user
 */
export async function getChatHistoryByTenantUser(tenantId: string, userId: string): Promise<ChatMessage[]> {
    const messages: ChatMessage[] = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let ExclusiveStartKey: Record<string, any> | undefined

    try {
        do {
            const command = new QueryCommand({
                TableName: CHAT_HISTORY_TABLE,
                IndexName: 'tenantId-userId-index',
                KeyConditionExpression: 'tenantId = :t and userId = :u',
                ExpressionAttributeValues: {
                    ':t': tenantId,
                    ':u': userId,
                },
                ScanIndexForward: true, // Sort by timestamp (the sort key) in ascending order
                ExclusiveStartKey,
            })

            const response = await ddbDocClient.send(command)
            messages.push(...(response.Items as ChatMessage[] || []))
            ExclusiveStartKey = response.LastEvaluatedKey
        } while (ExclusiveStartKey)
        
        logger.info(`Retrieved ${messages.length} messages for tenant ID: ${tenantId}, and user ID ${userId}`)
        return messages
    } catch (e) {
        logger.warn(`Error retrieving chat history: ${JSON.stringify(e, null, 2)}`)
        return []
    }
}

/**
 * Delete all chat messages for a user's session (using tenantId and userId index to find all messages).
 */
export async function deleteChatSession(tenantId: string, userId: string): Promise<boolean> {
    try {
        // 1. Get all messages for this user/tenant
        const messages = await getChatHistoryByTenantUser(tenantId, userId)
        
        if (messages.length === 0) {
            logger.info(`No chat messages found for user ${userId} to delete.`)
            return true
        }
        
        // 2. Use batch delete
        const success = await batchDeleteItems(CHAT_HISTORY_TABLE || '', messages)
        
        if (success) {
            logger.info(`Successfully batch deleted ${messages.length} messages for user ${userId}`)
            return true
        } else {
            logger.warn(`Failed to batch delete messages for user ${userId}`)
            return false
        }
    } catch (e) {
        logger.warn(`Error deleting chat session: ${JSON.stringify(e, null, 2)}`)
        return false
    }
}



/**
 * Get the query rate limit for a tenant from the tenants configuration
 */
export function getTenantQueryRateLimit(tenantId: string): number {
    try {
        const tenant = TENANTS_CONFIG.find(t => t.Id === tenantId)
        if (tenant) {
            const queryRate = tenant.QueryRate || 5 // Default to 5
            logger.info(`Found query rate limit for tenant ${tenantId}: ${queryRate}`)
            return queryRate
        }
        
        logger.warn(`Tenant ${tenantId} not found in configuration, using default query rate limit`)
        return 5
    } catch (e) {
        logger.error(`Error getting tenant query rate limit: ${JSON.stringify(e, null, 2)}`)
        return 5
    }
}


/**
 * Check if the tenant has exceeded their query rate limit
 * Returns: [is_allowed, current_count]
 */
export async function checkRateLimit(tenantId: string): Promise<[boolean, number]> {
    try {
        const current_time = Math.floor(Date.now() / 1000)
        const one_minute_ago = current_time - 60
        
        // Query the table for entries from this tenant in the last minute
        const command = new QueryCommand({
            TableName: QUERY_RATE_LIMIT_TABLE,
            KeyConditionExpression: 'tenantId = :t and #ts >= :min',
            ExpressionAttributeNames: { '#ts': 'timestamp' },
            ExpressionAttributeValues: {
                ':t': tenantId,
                ':min': one_minute_ago,
            },
        })

        const response = await ddbDocClient.send(command)
        const query_count = response.Items ? response.Items.length : 0
        
        const query_rate_limit = getTenantQueryRateLimit(tenantId)
        
        const is_allowed = query_count < query_rate_limit
        
        logger.info(`Rate limit check for tenant ${tenantId}: ${query_count}/${query_rate_limit} queries in the last minute`)
        
        return [is_allowed, query_count]
    } catch (e) {
        logger.error(`Error checking rate limit: ${JSON.stringify(e, null, 2)}`)
        return [true, 0] // Allow query in case of error
    }
}




/**
 * Record a query in the rate limit table
 */
export async function recordQuery(tenantId: string): Promise<boolean> {
    try {
        const current_time = Math.floor(Date.now() / 1000)
        
        const item: QueryRecord = {
            tenantId: tenantId,
            timestamp: current_time,
            ttl: current_time + 120, // TTL of 2 minutes
        }
        
        const command = new PutCommand({
            TableName: QUERY_RATE_LIMIT_TABLE,
            Item: item,
        })
        await ddbDocClient.send(command)
        
        logger.info(`Recorded query for tenant ${tenantId}`)
        return true
    } catch (e) {
        logger.error(`Error recording query: ${JSON.stringify(e, null, 2)}`)
        return false
    }
}






/**
 * Perform the retrieve_and_generate call with error handling for invalid session IDs
 * Returns: [response, session_changed]
 */
export async function performRetrieveAndGenerate(retrieveParams: RetrieveAndGenerateCommandInput): Promise<[RetrieveAndGenerateCommandOutput, boolean]> {
    try {
        // First attempt with the provided session ID (if any)
        logger.info('Attempting retrieve_and_generate with provided parameters')
        const command = new RetrieveAndGenerateCommand(retrieveParams)
        const response = await bedrockAgentRuntimeClient.send(command)
        return [response, false]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
        // Check for ValidationException indicating an invalid session ID
        const errorName = e.name
        const errorMessage = e.message
        
        if (errorName === 'ValidationException' && errorMessage.includes('Session with Id') && errorMessage.includes('is not valid')) {
            logger.warn(`Invalid session ID error: ${errorMessage}. Retrying without session ID.`)
            
            const oldSessionId = retrieveParams.sessionId
            
            // 1. Remove the session ID
            delete retrieveParams.sessionId
            
            // 2. Retry without the session ID
            logger.info(`Removed invalid session ID: ${oldSessionId}. Retrying...`)
            const command = new RetrieveAndGenerateCommand(retrieveParams)
            const response = await bedrockAgentRuntimeClient.send(command)
            
            // We return the new response and true to indicate session change
            return [response, true]
        } else {
            // For other errors, just re-raise
            logger.error(`Error in retrieve_and_generate: ${errorName} - ${errorMessage}`)
            throw e
        }
    }
}







/**
 * Update all chat history items for a user/tenant that used the old session ID to the new one.
 */
export async function updateChatHistorySessionId(userId: string, tenantId: string, projectId: string, oldSessionId: string, newSessionId: string): Promise<boolean> {
    try {
        // Get all messages for this user/tenant
        const allMessages = await getChatHistoryByTenantUser(tenantId, userId)
        
        // Filter messages by the old session ID AND projectId (to ensure we're updating the right thread)
        const messagesToUpdate = allMessages.filter(msg => msg.sessionId === oldSessionId && msg.projectId === projectId)
        
        if (messagesToUpdate.length === 0) {
            logger.info(`No messages found with session ID ${oldSessionId} to update`)
            return true
        }
        
        // Update each message with the new session ID
        // Note: In DynamoDB, updating the partition key (tenantId) or sort key (id) means deleting the old item and creating a new one. 
        // Since we are NOT updating the PK/SK (tenantId and id), we can use BatchWrite with a PutRequest
        // OR simply update the items one by one if that's easier. Given the original code used batch_writer(), we'll use BatchWrite with PutRequest.
        const BATCH_SIZE = 25
        for (let i = 0; i < messagesToUpdate.length; i += BATCH_SIZE) {
            const batch = messagesToUpdate.slice(i, i + BATCH_SIZE)
            
            const putRequests = batch.map(msg => {
                const updatedItem = { ...msg, sessionId: newSessionId }
                return {
                    PutRequest: {
                        Item: updatedItem
                    }
                }
            })

            const params = {
                RequestItems: {
                    [CHAT_HISTORY_TABLE || '']: putRequests,
                }
            }
            
            const command = new BatchWriteCommand(params)
            await ddbDocClient.send(command)
        }
        
        logger.info(`Updated ${messagesToUpdate.length} messages with new session ID ${newSessionId}`)
        return true
    } catch (e) {
        logger.warn(`Error updating chat history session IDs: ${JSON.stringify(e, null, 2)}`)
        return false
    }
}