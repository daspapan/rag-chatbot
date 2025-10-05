"use client";

import { useEffect, useState } from 'react'
import useWebSocket from 'react-use-websocket';
import { LS_KEY_CHAT_HISTORY, SOCKET_URL } from '@/constants';
import { ChatOptions } from '@/hooks/useChatOptions';


export interface MessageResponse {
    status: 'inProgress' | 'complete'
    content: string
    role: 'user' | 'system'
}

export interface MessageHistoryItem {
    content: string
    role: 'user' | 'system'
}

const useChat = (sessionId: string) => {

    const {sendMessage, lastMessage, readyState} = useWebSocket(`${SOCKET_URL}?sessionId=${sessionId}`)

    const [messageHistory, setMessageHistory] = useState<MessageHistoryItem[]>([])
    const [buffer, setBuffer] = useState<string>('')
    const [isLoading, setIsLoading] = useState(false)


    useEffect(() => {
        const storedHistory = JSON.parse(window.localStorage.getItem(LS_KEY_CHAT_HISTORY) ?? '[]')
        console.log(`${LS_KEY_CHAT_HISTORY}`, storedHistory)
        if(storedHistory){
            setMessageHistory(storedHistory);
        }
    }, [])


    useEffect(() => {

        console.log("[The Last Message]", lastMessage)
        if(lastMessage && lastMessage.data){
            const parsedMessage = JSON.parse(lastMessage.data) as MessageResponse

            if(parsedMessage.role === 'system' && parsedMessage.status === 'complete'){
                window.localStorage.setItem(LS_KEY_CHAT_HISTORY, JSON.stringify([...messageHistory, {content: parsedMessage.content, role: 'system'}]))
                setBuffer('')
                setMessageHistory(prev => [...prev, {content: parsedMessage.content, role: 'system'}])
                setIsLoading(false)
                return
            }

            setBuffer(prev => prev + parsedMessage.content)
        }

    }, [lastMessage])


    const send = (message: string, opts: ChatOptions = {}) => {
        if(readyState === WebSocket.OPEN && !isLoading){
            console.log('[Sending Message]', message, '[With options]', opts)
            setIsLoading(true)
            setBuffer('')
            setMessageHistory(prev => [...prev, {content: message, role: 'user'}])
            window.localStorage.setItem(LS_KEY_CHAT_HISTORY, JSON.stringify([...messageHistory, {content: message, role: 'user'}]))
            sendMessage(JSON.stringify({
                input: message,
                sessionId,
                ...opts
            }))
        }
    }

    return {
        send,
        readyState,
        messageHistory,
        isLoading,
        buffer,
    }
}

export default useChat