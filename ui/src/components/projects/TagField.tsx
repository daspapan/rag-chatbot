'use client'

import React, { ChangeEvent, KeyboardEvent, useState } from 'react'

interface TagFieldProps {
    tagStr: string | '';
    addTag: (tag: string) => void;
    removeTag: (tag: string) => void;
    maxTags?: number; // Optional prop for maximum tags allowed
}

const TagField = ({ tagStr, addTag, removeTag, maxTags }: TagFieldProps) => {
    const [inputValue, setInputValue] = useState<string>("");
    const tags = tagStr.split(', ')

    const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
    };

    const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && inputValue.trim() !== "") {
            e.preventDefault(); // Prevent form submission
            if (!maxTags || tags.length < maxTags) {
                addTag(inputValue.trim());
                setInputValue("");
            }
        }
    };

    return (
        <div>
            <div className="flex flex-wrap gap-2 mb-2">
                {tags.map((tag, index) => (
                    <span key={index} className="bg-gray-200 px-2 py-1 rounded-md flex items-center">
                        {tag}
                        <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="ml-2 text-red-500 hover:text-red-700"
                        >
                            &times;
                        </button>
                    </span>
                ))}
            </div>
            <input
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyPress}
                placeholder={maxTags && tags.length >= maxTags ? "Max tags reached" : "Add a tag and press Enter"}
                disabled={(maxTags && tags.length >= maxTags) ? true : false}
                className="border p-2 rounded-md w-full"
            />
        </div>
    )
}

export default TagField