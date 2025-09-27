import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { v4 as uuidv4 } from 'uuid'

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {

    console.log('[Received event]', JSON.stringify(event, null, 2))

    try {

        const id = uuidv4()

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Header': '*',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': '*'
            },
            body: JSON.stringify({ message: 'Message Successful', id }),
        }
        
        
    } catch (error) {
        console.error('Users Crud Ops Handler Lambda Error:', error)
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Header': '*',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': '*'
            },
            body: JSON.stringify({ message: 'Internal Server Error', error }),
        }
    }
    
}





