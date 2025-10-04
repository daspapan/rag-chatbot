import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { createResponse, logger } from '../utils/common'
import { deleteChatSession } from '../services/ChatService'


export const handleDeleteSession = async (event: APIGatewayProxyEvent, user_id: string, tenant_id: string, project_id: string): Promise<APIGatewayProxyResult> => {

    logger.info(`Handle Get Request: ${JSON.stringify(event, null, 2)}`)

    if (!project_id) {
        logger.warn('Project ID is missing in DELETE history request')
        return createResponse(event, 400, { error: 'Project ID is required' })
    }
    
    // The Python code deletes all messages found by get_chat_history_by_tenant_user.
    // This effectively deletes ALL chat history for the user, regardless of project_id.
    // The original code passed project_id to delete_chat_session but didn't use it for deletion.
    // For safety, I will stick to the original behavior (delete all user history).
    const success = await deleteChatSession(tenant_id, user_id)
    
    if (!success) {
        return createResponse(event, 500, { error: 'Failed to delete project chat history' })
    }
    
    return createResponse(event, 200, {
        message: `Chat history for user ${user_id} deleted successfully`
    })

}