import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { createResponse, logger } from '../utils/common'
import { getChatHistoryByTenantUser } from '../services/ChatService'


export const handleGetSession = async (event: APIGatewayProxyEvent, user_id: string, tenant_id: string, project_id: string): Promise<APIGatewayProxyResult> => {

    logger.info(`Handle Get Session: ${JSON.stringify(event, null, 2)}`)


    if (!project_id) {
        logger.warn('Project ID is missing in GET history request')
        return createResponse(event, 400, { error: 'Project ID is required' })
    }
    
    // Get chat history for this user/tenant
    const allMessages = await getChatHistoryByTenantUser(tenant_id, user_id)
    
    // Filter messages belonging only to the specified project ID (session ID)
    // NOTE: The Python code uses get_chat_history_by_tenant_user which queries by tenantId and userId.
    // Assuming 'id' in the path (project_id) is used as a filter in the client, we filter here.
    const messages = allMessages.filter(msg => msg.projectId === project_id)
    
    logger.info(`Found ${messages.length} messages for project ID: ${project_id}`)

    return createResponse(event, 200, { messages, count: messages.length })

}