import type { PersistedVault } from './types'

const DATABASE_NAME = 'account-vault'
const STORE_NAME = 'state'
const VAULT_KEY = 'vault'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('无法打开本地数据库'))
  })
}

export async function loadPersistedVault(): Promise<PersistedVault | null> {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly')
    const request = transaction.objectStore(STORE_NAME).get(VAULT_KEY)
    request.onsuccess = () => resolve((request.result as PersistedVault | undefined) ?? null)
    request.onerror = () => reject(request.error ?? new Error('无法读取本地数据'))
    transaction.oncomplete = () => database.close()
  })
}

export async function savePersistedVault(value: PersistedVault): Promise<void> {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).put(value, VAULT_KEY)
    transaction.oncomplete = () => {
      database.close()
      resolve()
    }
    transaction.onerror = () => {
      database.close()
      reject(transaction.error ?? new Error('无法保存本地数据'))
    }
  })
}
