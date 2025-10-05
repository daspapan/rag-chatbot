'use client'

import React, { forwardRef } from 'react'
import { MessageHistoryItem } from '@/hooks/useChat'
import Card from '../card/Card'

export interface MessageHistoryProps {
    ref: React.Ref<HTMLDivElement>
    history: MessageHistoryItem[]
    outputBuffer?: string
    isLoading?:boolean
}

const MessageHistory = forwardRef((props: MessageHistoryProps, ref: React.Ref<HTMLDivElement>) => {
    const {history, outputBuffer, isLoading} = props
    return (
        <div className='w-full max-h-[80vh] overflow-y-auto' ref={ref}>

            <div className='list-none p-0'>
                {history.map((item, index) => (
                    <div className='bg-gray-200 rounded-lg p-20 shadow-amber-200 m-10' key={index}>
                        <div className='m-8 p-8 rounded text-right' role={item.role}>

                        </div>
                    </div>
                ))}
            </div>

        </div>
    )
})

export default MessageHistory