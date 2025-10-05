import cdkOutput from '../../cdk-outputs.json'; 

const propsName = `RAG-Prod-KB-Stack`
// const propsNameApiGW = `AICB-Prod-File-Upload-Stack`

interface CDKOutput {
    RAGProdKBStackApiUrl: string;
}

const output: CDKOutput = cdkOutput.hasOwnProperty(propsName) ? cdkOutput[propsName] : { RAGProdKBStackApiUrl: ''}

// const apigwOutput: {ApiGatewayEndpoint: string} = cdkOutput.hasOwnProperty(propsNameApiGW) ? cdkOutput[propsNameApiGW] : { ApiGatewayEndpoint: '' }

export const HTTP_ENDPOINT = process.env.HTTP_ENDPOINT || output.RAGProdKBStackApiUrl
export const SOCKET_URL = process.env.SOCKET_URL
export const LS_KEY_CHAT_HISTORY = 'document-rag-chat-history' 
export const LS_KEY_SESSION_ID = 'document-rag-session-id'
export const LS_KEY_CHAT_OPTIONS = 'document-rag-chat-options'
export const LS_KEY_CHAT_PRESET = 'document-rag-chat-options-preset'