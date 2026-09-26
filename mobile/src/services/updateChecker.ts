// CampusMind In-App Release & Update Checker
export const CURRENT_APP_VERSION = '1.2.0';

export interface AppUpdateInfo {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseTitle?: string;
  releaseNotes?: string;
  apkDownloadUrl?: string;
  releasePageUrl?: string;
}

/**
 * Compares two semantic version strings (e.g. "v1.2.0" and "1.1.0").
 * Returns 1 if v1 > v2, -1 if v1 < v2, and 0 if equal.
 */
export function compareSemver(v1: string, v2: string): number {
  const clean = (v: string) =>
    v
      .replace(/^v/i, '')
      .trim()
      .split('.')
      .map((part) => parseInt(part, 10) || 0);

  const p1 = clean(v1);
  const p2 = clean(v2);
  const maxLen = Math.max(p1.length, p2.length);

  for (let i = 0; i < maxLen; i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

/**
 * Checks GitHub Releases API for the latest published release.
 * Lightweight, non-blocking with 5s timeout, silently falls back on error.
 */
export async function checkForAppUpdate(): Promise<AppUpdateInfo> {
  const defaultResult: AppUpdateInfo = {
    updateAvailable: false,
    currentVersion: CURRENT_APP_VERSION,
    latestVersion: CURRENT_APP_VERSION,
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(
      'https://api.github.com/repos/samirhusayn28-dev/CampusMind/releases/latest',
      {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'CampusMind-Mobile-App',
        },
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!res.ok) {
      return defaultResult;
    }

    const data = await res.json();
    const tagName: string = data.tag_name || '';
    if (!tagName) {
      return defaultResult;
    }

    const cleanLatest = tagName.replace(/^v/i, '').trim();
    const isNewer = compareSemver(cleanLatest, CURRENT_APP_VERSION) > 0;

    // Look for standalone Universal APK asset
    let apkUrl: string | undefined;
    if (Array.isArray(data.assets) && data.assets.length > 0) {
      const universalApk = data.assets.find(
        (a: any) =>
          typeof a.name === 'string' &&
          a.name.toLowerCase().includes('universal') &&
          a.name.endsWith('.apk')
      );
      const anyApk = data.assets.find(
        (a: any) => typeof a.name === 'string' && a.name.endsWith('.apk')
      );
      apkUrl = (universalApk || anyApk)?.browser_download_url;
    }

    return {
      updateAvailable: isNewer,
      currentVersion: CURRENT_APP_VERSION,
      latestVersion: cleanLatest,
      releaseTitle: data.name || `CampusMind v${cleanLatest}`,
      releaseNotes: data.body || '',
      apkDownloadUrl: apkUrl || data.html_url,
      releasePageUrl: data.html_url,
    };
  } catch (err) {
    // Non-blocking: fail quietly on network issues or timeouts
    console.log('[UpdateChecker] Non-fatal check skipped:', err);
    return defaultResult;
  }
}
