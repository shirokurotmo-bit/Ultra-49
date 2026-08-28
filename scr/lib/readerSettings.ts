export interface ReaderSettings {
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  padding: number;
  fontFamily: string;
  theme: 'paper' | 'white' | 'sepia' | 'dark' | 'black';
  showAnimations: boolean;
}

export const DEFAULT_SETTINGS: ReaderSettings = {
  fontSize: 18,
  lineHeight: 2.0,
  letterSpacing: 0.1,
  padding: 48,
  fontFamily: 'Noto Serif JP',
  theme: 'paper',
  showAnimations: true,
};
