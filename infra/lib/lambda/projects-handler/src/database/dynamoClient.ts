import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'

export interface projectItem {
    id: string
    userId: string
    tenantId: string
    createdAt: number
    projectId?: string
}

const client = new DynamoDBClient({})
export const ddb = DynamoDBDocumentClient.from(client)
