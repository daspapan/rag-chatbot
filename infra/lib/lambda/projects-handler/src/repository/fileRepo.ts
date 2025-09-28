import { PROJECT_FILES_TABLE } from '../constants'
import { ddb, projectItem } from '../database/dynamoClient'
import { QueryCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb'

export class FileRepo {
    private tableName = PROJECT_FILES_TABLE!

    async listFiles(tenantId: string, projectId: string) {
        const result = await ddb.send(new QueryCommand({
            TableName: this.tableName,
            IndexName: 'tenantId-projectId-index',
            KeyConditionExpression: 'tenantId = :tenantId AND projectId = :projectId',
            ExpressionAttributeValues: {
                ':tenantId': tenantId,
                ':projectId': projectId,
            },
        }))
        return result.Items ?? []
    }

    async deleteFiles(files: projectItem[]) {
        if (!files.length) return
        const requests = files.map(item => ({
            DeleteRequest: {
                Key: { tenantId: item.tenantId, id: item.id },
            },
        }))
        await ddb.send(new BatchWriteCommand({
            RequestItems: { [this.tableName]: requests },
        }))
    }
}
