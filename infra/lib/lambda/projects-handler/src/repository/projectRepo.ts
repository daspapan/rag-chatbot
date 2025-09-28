import { GetCommand, PutCommand, QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, projectItem } from '../database/dynamoClient'
import { PROJECTS_TABLE_NAME } from '../constants'

export class ProjectRepo {
    private tableName = PROJECTS_TABLE_NAME!

    async getProject(tenantId: string, id: string) {
        const result = await ddb.send(new GetCommand({
            TableName: this.tableName,
            Key: { tenantId, id },
        }))
        return result.Item
    }

    async listProjects(tenantId: string): Promise<projectItem[]> {
        const result = await ddb.send(new QueryCommand({
            TableName: this.tableName,
            KeyConditionExpression: 'tenantId = :tenantId',
            ExpressionAttributeValues: { ':tenantId': tenantId },
        }))
        return result.Items as projectItem[] ?? []
    }

    async createProject(item: projectItem) {
        await ddb.send(new PutCommand({
            TableName: this.tableName,
            Item: item,
        }))
        return item
    }

    async deleteProject(tenantId: string, id: string) {
        await ddb.send(new DeleteCommand({
            TableName: this.tableName,
            Key: { tenantId, id },
        }))
    }
}
