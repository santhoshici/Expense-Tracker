import React, { useState } from 'react'
import EmojiPicker from "emoji-picker-react";
import { LuImage, LuX } from "react-icons/lu"

const EmojiPickerPopup = ({ icon, onSelect }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className='flex flex-col md:flex-row items-start gap-5 mb-6'>
            <div
                className='flex items-center gap-4 cursor-pointer group'
                onClick={() => setIsOpen(true)}
            >
                <div className='w-12 h-12 flex items-center justify-center text-2xl bg-muted text-primary rounded-lg group-hover:bg-primary/20 transition-colors'>
                    {icon ? (
                        <img src={icon} alt="Icon" className='w-12 h-12' />
                    ) : (
                        <LuImage />
                    )}
                </div>
                <p className='text-foreground font-medium'>{icon ? "Change Icon" : "Pick Icon"}</p>
            </div>
            {isOpen && (
                <div className='relative'>
                    <button
                        className='w-7 h-7 flex items-center justify-center bg-card border border-border text-foreground rounded-full absolute -top-2 -right-2 z-10 cursor-pointer hover:bg-muted transition-colors'
                        onClick={() => setIsOpen(false)}
                    >
                        <LuX />
                    </button>

                    <EmojiPicker
                        open={isOpen}
                        onEmojiClick={(emoji) => onSelect(emoji?.imageUrl || "")}
                    />
                </div>
            )}
        </div>
    )
}

export default EmojiPickerPopup