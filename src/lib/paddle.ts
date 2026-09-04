// Paddle.js (Paddle Billing v2) loader + checkout overlay.
//
// Paddle issues two very different kinds of credential: a secret API
// key (server-side only, used by supabase/functions/paddle-initiate to
// look up plans and record a pending payment) and a "client-side
// token" -- explicitly designed by Paddle to be embedded in frontend
// code, the same way a Stripe publishable key is. This file only ever
// uses the client-side token, read from VITE_PADDLE_CLIENT_TOKEN so it
// stays out of source control like every other env-driven value in
// this app, even though Paddle's own docs say it's safe to expose.
//
// Real access is granted ONLY by supabase/functions/paddle-webhook
// after Paddle confirms the transaction server-side -- this overlay is
// just the checkout UI, exactly like every other gateway's hosted page
// here doesn't grant anything by itself either.

declare global {
  interface Window {
    Paddle?: {
      Environment: { set: (env: 'sandbox' | 'production') => void };
      Initialize: (opts: { token: string }) => void;
      Checkout: { open: (opts: PaddleCheckoutOptions) => void };
    };
  }
}

type PaddleCheckoutOptions = {
  items: { priceId: string; quantity: number }[];
  customData?: Record<string, string>;
  settings?: { successUrl?: string };
};

let loadPromise: Promise<void> | null = null;

function loadPaddleJs(): Promise<void> {
  if (window.Paddle) return Promise.resolve();
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('paddle_js_failed_to_load'));
    document.head.appendChild(script);
  });
  return loadPromise;
}

export function isPaddleConfigured(): boolean {
  return !!import.meta.env.VITE_PADDLE_CLIENT_TOKEN;
}

export async function openPaddleCheckout(priceId: string, customData: Record<string, string>): Promise<void> {
  const token = import.meta.env.VITE_PADDLE_CLIENT_TOKEN as string | undefined;
  if (!token) throw new Error('VITE_PADDLE_CLIENT_TOKEN is not configured');

  await loadPaddleJs();
  if (!window.Paddle) throw new Error('paddle_js_unavailable');

  const env = (import.meta.env.VITE_PADDLE_ENV as string | undefined) ?? 'production';
  if (env === 'sandbox') window.Paddle.Environment.set('sandbox');

  window.Paddle.Initialize({ token });
  window.Paddle.Checkout.open({
    items: [{ priceId, quantity: 1 }],
    customData,
    settings: { successUrl: `${window.location.origin}/app/settings?billing=complete` },
  });
}
