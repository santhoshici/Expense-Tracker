import { useSyncExternalStore } from 'react'

const createStore = (config) => {
  const listeners = new Set()
  let state
  let initialSnapshot = null

  const api = {
    getState: () => state,
    setState: (partial, replace = false) => {
      const partialState = typeof partial === 'function' ? partial(state) : partial
      const nextState = replace ? partialState : { ...state, ...partialState }
      if (Object.is(nextState, state)) return
      state = nextState
      listeners.forEach((listener) => listener())
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }

  api.useStore = (selector) =>
    useSyncExternalStore(
      api.subscribe,
      () => selector(api.getState()),
      () => selector(initialSnapshot)
    )

  state = config(api)
  initialSnapshot = state

  return api
}

const uiStore = createStore((api) => ({
  chatOpen: false,
  chatPanelMinimized: false,
  anomalyBannerDismissed: {},
  lastChatError: null,

  openChat: () => api.setState({ chatOpen: true }),
  closeChat: () => api.setState({ chatOpen: false }),
  toggleChatMinimized: () =>
    api.setState((state) => ({ chatPanelMinimized: !state.chatPanelMinimized })),
  dismissAnomalyBanner: (userId) =>
    api.setState((state) => ({
      anomalyBannerDismissed: {
        ...state.anomalyBannerDismissed,
        [userId]: true,
      },
    })),
  isAnomalyBannerDismissed: (userId) =>
    Boolean(api.getState().anomalyBannerDismissed[userId]),
  setChatError: (message) => api.setState({ lastChatError: message }),
  clearChatError: () => api.setState({ lastChatError: null }),
}))

export const useUIStore = uiStore.useStore

export { createStore, uiStore }