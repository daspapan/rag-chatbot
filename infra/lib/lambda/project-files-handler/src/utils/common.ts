// src/utils/common.ts
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { S3Client } from '@aws-sdk/client-s3'
import { BedrockAgentClient } from '@aws-sdk/client-bedrock-agent'
import { BedrockAgentRuntimeClient } from '@aws-sdk/client-bedrock-agent-runtime'
import * as AWS from 'aws-sdk'
import { ALLOW_HEADERS } from '../constants'

// Initialize AWS clients
const dynamodb = new DynamoDBClient()
const s3 = new S3Client()
const bedrockAgent = new BedrockAgentClient()
const bedrockAgentRuntime = new BedrockAgentRuntimeClient()

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
}

export async function getFileIds(
    projectFilesTable: string,
    tenantId: string,
    projectId: string
): Promise<string[]> {
    const params = {
        TableName: projectFilesTable,
        IndexName: 'tenantId-projectId-index',
        KeyConditionExpression: 'tenantId = :tenantId AND projectId = :projectId',
        ExpressionAttributeValues: {
            ':tenantId': tenantId,
            ':projectId': projectId,
        },
    }

    const response = await dynamodb.query(params).promise()
    return (response.Items || []).map((item: any) => item.id)
}

// ---- Batch Delete ----
export async function batchDeleteItems(
    tableName: string,
    items: Array<{ tenantId: string; id: string; }>
): Promise<boolean> {
    try {
        const writeRequests = items.map((item) => ({
            DeleteRequest: {
                Key: {
                    tenantId: item.tenantId,
                    id: item.id,
                },
            },
        }))

        const params = { RequestItems: { [tableName]: writeRequests } }
        await dynamodb.batchWrite(params).promise()
        return true
    } catch (err) {
        console.warn('Batch delete error:', err)
        return false
    }
} */

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
    info: (message: string) => console.log(`INFO: ${message}`),
    warn: (message: string) => console.warn(`WARN: ${message}`),
    error: (message: string) => console.error(`ERROR: ${message}`),
    exception: (message: string, error: AWS.AWSError | unknown) => console.error(`EXCEPTION: ${message}`, error),
}
