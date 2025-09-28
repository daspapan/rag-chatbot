import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'

import { createResponse } from './utils/common'

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {

    console.log('[Received event]', JSON.stringify(event, null, 2))

    try {

        return createResponse(event, 200, {message: "Successful response."})
        
    } catch (error) {
        console.error('Error:', error)
        return createResponse(event, 500, { message: 'Internal Server Error', error })
    }
    
}





