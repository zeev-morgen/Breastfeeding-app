import * as Network from 'expo-network';

export type NetworkListener = (online: boolean) => void;

/**
 * Returns the current network reachability. Treats both `isConnected` and
 * `isInternetReachable` (when reported) as required for "online".
 */
export async function getInitialOnline(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    return computeOnline(state.isConnected, state.isInternetReachable);
  } catch {
    // If the API itself fails we conservatively assume online — the actual
    // request will surface the failure and trigger the offline fallback.
    return true;
  }
}

/**
 * Subscribes to network state changes. Returns an unsubscribe function.
 *
 * `expo-network` exposes `addNetworkStateListener` since SDK 52; the listener
 * fires for both connection and reachability transitions.
 */
export function subscribeOnline(cb: NetworkListener): () => void {
  const sub = Network.addNetworkStateListener((state) => {
    cb(computeOnline(state.isConnected, state.isInternetReachable));
  });
  return () => sub.remove();
}

function computeOnline(
  isConnected: boolean | undefined,
  isInternetReachable: boolean | null | undefined,
): boolean {
  if (isConnected === false) return false;
  // `isInternetReachable` is `null` on platforms / states where it can't be
  // determined — fall back to `isConnected` then.
  if (isInternetReachable === false) return false;
  return true;
}
