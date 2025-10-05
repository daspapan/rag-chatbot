import { useState, useEffect } from 'react'
import { LS_KEY_CHAT_OPTIONS, LS_KEY_CHAT_PRESET } from '../constants'

export interface ChatOptions {
    temperature?: number
    topK?: number
    topP?: number
}

export type Presets = 'balanced' | 'creative' | 'minimal'
export const PRESETS = ['balanced', 'creative', 'minimal'] as const

export const DEFAULT_CHAT_OPTIONS: Record<Presets, ChatOptions> = {
    balanced: {
        temperature: 0.5,
        topK: 5,
        topP: 0.7,
    },
    creative: {
        temperature: 0.7,
        topK: 10,
        topP: 0.9,
    },
    minimal: {
        temperature: 0.1,
        topK: 3,
        topP: 0.1,
    },
}

export const useChatOptions = () => {
    const [preset, setPreset] = useState<Presets>(
        () => {
            const storedPreset = window.localStorage.getItem(LS_KEY_CHAT_PRESET)
            return storedPreset ? (storedPreset as Presets) : 'balanced'
        }
    )

    const [chatOptions, setChatOptions] = useState<ChatOptions>(
        () => {
            const storedOptions = window.localStorage.getItem(LS_KEY_CHAT_OPTIONS)
            return storedOptions ? JSON.parse(storedOptions) : DEFAULT_CHAT_OPTIONS['balanced']
        }
    )

    useEffect(() => {
        localStorage.setItem(LS_KEY_CHAT_OPTIONS, JSON.stringify(chatOptions))
    }, [chatOptions])

    useEffect(() => {
        localStorage.setItem(LS_KEY_CHAT_PRESET, preset)
        setChatOptions(DEFAULT_CHAT_OPTIONS[preset])
    }, [preset])

    return {chatOptions, setChatOptions, preset, setPreset} as const
}
