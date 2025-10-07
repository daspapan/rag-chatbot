// src/utils/common.ts
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { BatchWriteItemCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { BatchWriteCommandInput, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { S3Client } from '@aws-sdk/client-s3'
import { BedrockAgentClient } from '@aws-sdk/client-bedrock-agent'
import { BedrockAgentRuntimeClient } from '@aws-sdk/client-bedrock-agent-runtime'
import * as AWS from 'aws-sdk'
import { ALLOW_HEADERS, PROJECT_FILES_TABLE } from '../constants'
import { ProjectFile } from '../models/ProjectFilesModel'

// Initialize AWS clients
const dynamodb = new DynamoDBClient()
const s3 = new S3Client()
const bedrockAgent = new BedrockAgentClient()
const bedrockAgentRuntime = new BedrockAgentRuntimeClient()
// const ddbClient = new DynamoDBClient({})
// const ddbDocClient = DynamoDBDocumentClient.from(ddbClient)

// ---- JSON Encoder ----
/* export function decimalEncoder(obj: unknown): unknown {
    if (typeof obj === 'object' && obj !== null) {
        const result: Record<string, unknown> = Array.isArray(obj) ? [...obj] : { ...obj }
        for (const key in obj as Record<string, unknown>) {
            const value = (obj as Record<string, unknown>)[key]
            if (value && typeof value === 'object' && (value as { constructor?: { name?: string } }).constructor?.name === 'Decimal') {
                result[key] = parseFloat((value as { toString: () => string }).toString())
            } else if (typeof value === 'object' && value !== null) {
                result[key] = decimalEncoder(value)
            } else {
                result[key] = value
            }
        }
        return result
    }
    return obj
} */

// ---- CORS Headers ----
export function getCorsHeaders(event: APIGatewayProxyEvent): Record<string, string> {
    const origin =
        event.headers?.origin || event.headers?.Origin || 'http://localhost:3000'

    return {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Headers': ALLOW_HEADERS || 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET, OPTIONS, POST, PUT, DELETE',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Origin': origin,
    }
}

// ---- Standard API Response ----
export function createResponse(
    event: APIGatewayProxyEvent,
    statusCode: number,
    body: unknown
): APIGatewayProxyResult {
    return {
        statusCode,
        headers: getCorsHeaders(event),
        body: JSON.stringify(body),
    }
}

// ---- OPTIONS Request Handler ----
export function handleOptionsRequest(
    event: APIGatewayProxyEvent 
): APIGatewayProxyResult | null {
    if (event.httpMethod === 'OPTIONS') {
        return createResponse(event, 200, {})
    }
    return null
}

// ---- Extract User Claims (Cognito) ----
export function getUserTenantFromClaims(event: APIGatewayProxyEvent): { userId: string; tenantId: string; } {
    console.log(`${event.requestContext}`)
    return {
        userId: 'user1',
        tenantId: 'tenant1'
    }
    /* 
    const claims: unknown = (event.requestContext as unknown)?.authorizer?.claims || {}
    return {
        userId: claims['sub'],
        tenantId: claims['custom:tenantId'],
    } 

    ------------------------------
        
    const userId = event.requestContext.authorizer?.claims?.['cognito:username'] || '';
    const tenantId = event.requestContext.authorizer?.claims?.['custom:tenantId'] || '';

    if (!userId || !tenantId) {
        throw new Error('User ID or Tenant ID missing from claims.');
    }

    return { userId, tenantId };

    */
}

// ---- DynamoDB Queries ----
/* export async function queryItemsByTenantProject(
    tableName: string,
    tenantId: string,
    projectId: string
): Promise<unknown[]> {
    const params = {
        TableName: tableName,
        IndexName: 'tenantId-projectId-index',
        KeyConditionExpression: 'tenantId = :tenantId AND projectId = :projectId',
        ExpressionAttributeValues: {
            ':tenantId': tenantId,
            ':projectId': projectId,
        },
    }

    const response = await dynamodb.query(params).promise()
    return response.Items || []
}*/

export async function getFileIds(
    tenantId: string,
    projectId: string
): Promise<string[]> {
    logger.info(`[getFileIds] - ${tenantId} - ${projectId}`)
    const command = new QueryCommand({
        TableName: PROJECT_FILES_TABLE || '',
        IndexName: 'tenantId-projectId-index',
        KeyConditionExpression: 'tenantId = :tenantId AND projectId = :projectId',
        ExpressionAttributeValues: {
            ':tenantId': tenantId,
            ':projectId': projectId,
        }, 
    })
    logger.info(`[getFileIds-command] ${JSON.stringify(command, null, 2)}`)
    const response = await dynamodb.send(command)
    logger.info(`[getFileIds-response] ${JSON.stringify(response, null, 2)}`)
    const items = (response.Items || []) as ProjectFile[]
    logger.info(`Found ${items.length} project files for project ID: ${projectId}`)
    return items.map((item: ProjectFile) => item.id)

}

// ---- Batch Delete ----
export async function batchDeleteItems(
    tableName: string,
    items: Array<{ tenantId: string; id: string; }>
): Promise<boolean> {
    try {
        if (items.length === 0) {
            return true
        }

        /* 
        
        // DynamoDB BatchWriteItem limit is 25 items per request
        const BATCH_SIZE = 25;
        let successful = true;

        for (let i = 0; i < items.length; i += BATCH_SIZE) {
            const batch = items.slice(i, i + BATCH_SIZE);
            
            const deleteRequests = batch.map(item => ({
                DeleteRequest: {
                    ...
                }
            }));

            const params: BatchWriteCommandInput = {
                RequestItems: {
                    [tableName]: deleteRequests,
                }
            };

            try {
                const command = new BatchWriteCommand(params);
                await ddbDocClient.send(command);
                // Handling UnprocessedItems logic is omitted for simplification but required in production
            } catch (e) {
                logger.exception(`Error in batch delete for table ${tableName}:`, e);
                successful = false;
            }
        }
        return successful;
        */
        
        const writeRequests = items.map((item) => ({
            DeleteRequest: {
                Key: {
                    tenantId: item.tenantId,
                    id: item.id,
                },
            },
        }))

        const params: BatchWriteCommandInput = { 
            RequestItems: { 
                [tableName]: writeRequests 
            } 
        }
        // await dynamodb.batchWrite(params).promise()
        const command = new BatchWriteItemCommand(params)
        const response = await dynamodb.send(command)
        console.log('Batch delete successful:', response)
        return true

        
    } catch (err) {
        console.warn('Batch delete error:', err)
        return false
    }
} 

// ---- Error Handlers ----
export function handleClientError(e: AWS.AWSError, event: APIGatewayProxyEvent) {
    console.error('AWS Client Error:', e.code, '-', e.message)
    return createResponse(event, 500, { error: 'Internal server error' })
}

export function handleGeneralException(
    e: Error,
    event: APIGatewayProxyEvent,
    metricName = 'ProcessingError'
) {
    console.error('General Error:', e.message, e.stack)
    console.error(`[Metric Name] ${metricName}`)
    return createResponse(event, 500, { error: 'Internal server error' })
}

// ---- Export AWS Clients ----
export { dynamodb, s3, bedrockAgent, bedrockAgentRuntime }



// Simple logging utility (equivalent to logger from powertools)
// In a real project, consider using a dedicated library like PINO or a Powertools equivalent for TS
export const logger = {
    info: (message: string | object) => console.log(`INFO: ${message}`),
    warn: (message: string | object) => console.warn(`WARN: ${message}`),
    error: (message: string | object) => console.error(`ERROR: ${message}`),
    exception: (message: string | object, error: AWS.AWSError | unknown) => console.error(`EXCEPTION: ${message}`, error),
    debug: (message: string | object) => console.log('DEBUG:', message),
}
