import { useSyncExternalStore } from 'react'

function subscribe(onStoreChange: () => void) {
  window.addEventListener('online', onStoreChange)
  window.addEventListener('offline', onStoreChange)
  return () => {
    window.removeEventListener('online', onStoreChange)
    window.removeEventListener('offline', onStoreChange)
  }
}

function getOnline() {
  return navigator.onLine
}

function getServerSnapshot() {
  return true
}

export function useOnline() {
  return useSyncExternalStore(subscribe, getOnline, getServerSnapshot)
}
