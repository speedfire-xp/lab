import { 
  collection, 
  getDocs, 
  getDoc, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc 
} from 'firebase/firestore';
import type { MyStorage } from './config';
import { STORAGE_MODE, db } from './config';

class LocalStorage implements MyStorage {
  async list<T>(collectionName: string): Promise<T[]> {
    const data = localStorage.getItem(collectionName);
    return data ? JSON.parse(data) : [];
  }

  async get<T>(collectionName: string, id: string): Promise<T | undefined> {
    const items = await this.list<any>(collectionName);
    return items.find(item => item.id === id);
  }

  async create<T>(collectionName: string, data: T): Promise<T> {
    const items = await this.list<any>(collectionName);
    items.push(data);
    localStorage.setItem(collectionName, JSON.stringify(items));
    return data;
  }

  async update<T>(collectionName: string, id: string, data: Partial<T>): Promise<void> {
    const items = await this.list<any>(collectionName);
    const index = items.findIndex(item => item.id === id);
    if (index !== -1) {
      items[index] = { ...items[index], ...data };
      localStorage.setItem(collectionName, JSON.stringify(items));
    }
  }

  async delete(collectionName: string, id: string): Promise<void> {
    const items = await this.list<any>(collectionName);
    const filtered = items.filter(item => item.id !== id);
    localStorage.setItem(collectionName, JSON.stringify(filtered));
  }
}

class FirestoreStorage implements MyStorage {
  async list<T>(collectionName: string): Promise<T[]> {
    const querySnapshot = await getDocs(collection(db, collectionName));
    return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as T));
  }

  async get<T>(collectionName: string, id: string): Promise<T | undefined> {
    const docRef = doc(db, collectionName, id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data() as T) : undefined;
  }

  async create<T>(collectionName: string, data: any): Promise<T> {
    const { id, ...rest } = data;
    const finalId = id || crypto.randomUUID();
    await setDoc(doc(db, collectionName, finalId), { ...rest, id: finalId });
    return { ...rest, id: finalId } as T;
  }

  async update<T>(collectionName: string, id: string, data: Partial<T>): Promise<void> {
    const docRef = doc(db, collectionName, id);
    await updateDoc(docRef, data as any);
  }

  async delete(collectionName: string, id: string): Promise<void> {
    await deleteDoc(doc(db, collectionName, id));
  }
}

export const dbInstance: MyStorage = STORAGE_MODE === 'firebase' ? new FirestoreStorage() : new LocalStorage();
