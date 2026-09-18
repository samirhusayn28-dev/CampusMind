export interface ThemeColors {
  // Backgrounds & Surfaces
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceSubtle: string;
  surfaceHover: string;

  // Primary Pastel Tones (Muted Sage)
  primary: string;
  primaryLight: string;
  primaryContainer: string;
  onPrimary: string;
  onPrimaryContainer: string;

  // Secondary Accents (Warm Peach / Terracotta)
  peach: string;
  peachLight: string;
  peachContainer: string;
  onPeach: string;

  // Accent Tones (Soft Lavender)
  lavender: string;
  lavenderLight: string;
  lavenderContainer: string;
  onLavender: string;

  // Accent Tones (Gentle Sky Blue)
  sky: string;
  skyLight: string;
  skyContainer: string;
  onSky: string;

  // Accent Tones (Muted Amber / Warning)
  amber: string;
  amberContainer: string;
  onAmber: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;

  // Borders & Dividers
  border: string;
  borderSubtle: string;
  divider: string;

  // Tab Bar & Navigation
  tabBarBackground: string;
  tabBarBorder: string;
  tabBarActive: string;
  tabBarInactive: string;
  tabBarIndicator: string;

  // Status & Shadows
  cardShadow: string;
  floatingShadow: string;
  isDark: boolean;
  statusBarStyle: 'dark-content' | 'light-content';
}

export const lightColors: ThemeColors = {
  // Cozy warm cream / off-white background
  background: '#FBF9F5',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceSubtle: '#F4EFE8',
  surfaceHover: '#ECE6DD',

  // Muted Sage Green (Primary focus color)
  primary: '#47634F',
  primaryLight: '#65846E',
  primaryContainer: '#E2EDE4',
  onPrimary: '#FFFFFF',
  onPrimaryContainer: '#23392A',

  // Warm Peach / Terracotta
  peach: '#D66D46',
  peachLight: '#E88B67',
  peachContainer: '#FCE7DD',
  onPeach: '#FFFFFF',

  // Soft Lavender
  lavender: '#6B6293',
  lavenderLight: '#8A81B3',
  lavenderContainer: '#EAE7F8',
  onLavender: '#FFFFFF',

  // Soft Sky Blue
  sky: '#47789D',
  skyLight: '#6B9ABF',
  skyContainer: '#E1EFF9',
  onSky: '#FFFFFF',

  // Muted Amber
  amber: '#B5781E',
  amberContainer: '#FDF1DC',
  onAmber: '#543605',

  // Text with soft charcoal warmth
  textPrimary: '#222623',
  textSecondary: '#5C635E',
  textTertiary: '#8D968F',
  textInverse: '#FBF9F5',

  // Borders
  border: '#E6E1D7',
  borderSubtle: '#EFECE5',
  divider: '#EDE8E0',

  // Tab Bar (Floating soft pill feel)
  tabBarBackground: '#FFFFFF',
  tabBarBorder: '#ECE7DE',
  tabBarActive: '#334D3A',
  tabBarInactive: '#969F98',
  tabBarIndicator: '#E2EDE4',

  // Shadows
  cardShadow: 'rgba(50, 45, 35, 0.05)',
  floatingShadow: 'rgba(50, 45, 35, 0.10)',
  isDark: false,
  statusBarStyle: 'dark-content',
};

export const darkColors: ThemeColors = {
  // Warm Deep Charcoal (not pitch black)
  background: '#161816',
  surface: '#202421',
  surfaceElevated: '#282C29',
  surfaceSubtle: '#1C1F1D',
  surfaceHover: '#313632',

  // Muted Sage in Dark Mode
  primary: '#9EC2A6',
  primaryLight: '#B8D8BF',
  primaryContainer: '#28392C',
  onPrimary: '#162419',
  onPrimaryContainer: '#CBE5D1',

  // Warm Peach
  peach: '#F5A88B',
  peachLight: '#FFC4AF',
  peachContainer: '#40271E',
  onPeach: '#30130A',

  // Soft Lavender
  lavender: '#BFB8E8',
  lavenderLight: '#DAD4F8',
  lavenderContainer: '#2F2A42',
  onLavender: '#1B1729',

  // Soft Sky
  sky: '#9CC6E6',
  skyLight: '#BCDCF5',
  skyContainer: '#1E2F3D',
  onSky: '#0F1E28',

  // Muted Amber
  amber: '#F5C678',
  amberContainer: '#382B14',
  onAmber: '#261C08',

  // Text
  textPrimary: '#EEEBE5',
  textSecondary: '#A9B0A9',
  textTertiary: '#767E77',
  textInverse: '#161816',

  // Borders
  border: '#323733',
  borderSubtle: '#262A27',
  divider: '#2B302C',

  // Tab Bar
  tabBarBackground: '#202421',
  tabBarBorder: '#2E332F',
  tabBarActive: '#CBE5D1',
  tabBarInactive: '#767E77',
  tabBarIndicator: '#2D3D31',

  // Shadows
  cardShadow: 'rgba(0, 0, 0, 0.35)',
  floatingShadow: 'rgba(0, 0, 0, 0.50)',
  isDark: true,
  statusBarStyle: 'light-content',
};
