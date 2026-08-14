import { useUIStore } from '../store/useUIStore'

export const useChatUI = () => {
  const open = useUIStore((state) => state.chatOpen)
  const minimized = useUIStore((state) => state.chatPanelMinimized)
  const openChat = useUIStore((state) => state.openChat)
  const closeChat = useUIStore((state) => state.closeChat)
  const toggleMinimized = useUIStore((state) => state.toggleChatMinimized)

  return { open, openChat, closeChat, minimized, toggleMinimized }
}

export default useChatUI