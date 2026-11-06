import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  User,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<User>;
  signInWithEmail: (email: string, pass: string) => Promise<User>;
  signUpWithEmail: (email: string, pass: string, name?: string) => Promise<User>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Sync user profile record into Firestore
  const syncUserProfile = async (u: User, customName?: string) => {
    try {
      const userRef = doc(db, 'users', u.uid);
      const userSnap = await getDoc(userRef);

      const name = customName || u.displayName || u.email?.split('@')[0] || 'Runner';

      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid: u.uid,
          email: u.email,
          displayName: name,
          photoURL: u.photoURL || null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } else {
        await setDoc(
          userRef,
          {
            email: u.email,
            displayName: name,
            photoURL: u.photoURL || null,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      }
    } catch (error) {
      console.warn('Could not sync user profile to Firestore:', error);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async currentUser => {
      setUser(currentUser);
      if (currentUser) {
        await syncUserProfile(currentUser);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleGoogleSignIn = async (): Promise<User> => {
    const cred = await signInWithPopup(auth, googleProvider);
    await syncUserProfile(cred.user);
    return cred.user;
  };

  const handleEmailSignIn = async (email: string, pass: string): Promise<User> => {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    await syncUserProfile(cred.user);
    return cred.user;
  };

  const handleEmailSignUp = async (email: string, pass: string, name?: string): Promise<User> => {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    if (name) {
      await updateProfile(cred.user, { displayName: name });
    }
    await syncUserProfile(cred.user, name);
    return cred.user;
  };

  const handleSignOut = async (): Promise<void> => {
    await signOut(auth);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signInWithGoogle: handleGoogleSignIn,
        signInWithEmail: handleEmailSignIn,
        signUpWithEmail: handleEmailSignUp,
        signOutUser: handleSignOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
