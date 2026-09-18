import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from './firebase';
import { StudyMaterial } from '../types/content';

const LOCAL_STORAGE_KEY = '@campusmind_cached_materials_v1';

// Get local cache
async function getCachedMaterials(): Promise<StudyMaterial[]> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Update local cache
async function setCachedMaterials(materials: StudyMaterial[]): Promise<void> {
  try {
    await AsyncStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(materials));
  } catch (e) {
    console.warn('Could not save materials to AsyncStorage cache:', e);
  }
}

// Save material to Firestore & update local cache
export async function saveMaterial(material: StudyMaterial): Promise<void> {
  // Update local cache first
  const cached = await getCachedMaterials();
  const updated = [material, ...cached.filter((m) => m.id !== material.id)];
  await setCachedMaterials(updated);

  // Sync to Firestore if online
  try {
    const materialRef = doc(db, 'users', material.userId, 'materials', material.id);
    await setDoc(
      materialRef,
      {
        ...material,
        updatedAtServer: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('[Firestore] Error saving material (cached locally):', err);
  }
}

// Fetch user materials from Firestore with local cache fallback
export async function fetchUserMaterials(userId: string): Promise<StudyMaterial[]> {
  const cached = await getCachedMaterials();
  const userCached = cached.filter((m) => m.userId === userId);

  try {
    const materialsCol = collection(db, 'users', userId, 'materials');
    const q = query(materialsCol, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const materials: StudyMaterial[] = [];
      snapshot.forEach((docSnap) => {
        materials.push(docSnap.data() as StudyMaterial);
      });
      await setCachedMaterials(materials);
      return materials;
    }
  } catch (err) {
    console.warn('[Firestore] Fetch error, returning cached materials:', err);
  }

  return userCached;
}

// Delete material
export async function deleteMaterial(userId: string, materialId: string): Promise<void> {
  const cached = await getCachedMaterials();
  const filtered = cached.filter((m) => m.id !== materialId);
  await setCachedMaterials(filtered);

  try {
    const materialRef = doc(db, 'users', userId, 'materials', materialId);
    await deleteDoc(materialRef);
  } catch (err) {
    console.warn('[Firestore] Delete error:', err);
  }
}
