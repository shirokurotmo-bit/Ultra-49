import { useEffect, useRef, useState, useCallback } from 'react';

export function useAutosave<T>(
  data: T,
  onSave: (data: T) => Promise<void> | void,
  delay: number = 1000
) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const dataRef = useRef(data);
  dataRef.current = data;

  const saveNow = useCallback(async () => {
    setIsSaving(true);
    try {
      await onSaveRef.current(dataRef.current);
      setLastSaved(new Date());
    } finally {
      setIsSaving(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      saveNow();
    }, delay);

    return () => clearTimeout(timer);
  }, [data, delay, saveNow]);

  return { isSaving, lastSaved, saveNow };
}
