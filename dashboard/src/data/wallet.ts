/**
 * The in-app wallet, kept out of the initial bundle.
 *
 * This module is imported dynamically from the sign-in route and nowhere else.
 * That is deliberate: the thirdweb SDK is by far the largest dependency here,
 * and the initial-bundle budget is 200 KB gzipped on a school laptop
 * (TRD-TCH-003). A teacher opening their class list should never download the
 * wallet code — they signed in weeks ago.
 *
 * Nothing in the product's vocabulary says "wallet". A teacher enters an email
 * address and a code; the key material is plumbing they never learn about
 * (ADR-002).
 */

import { createThirdwebClient } from 'thirdweb';
import { inAppWallet, preAuthenticate } from 'thirdweb/wallets/in-app';

import { config } from './config';

const thirdwebClient = createThirdwebClient({ clientId: config.thirdwebClientId });

/** Send the six-digit code. */
export async function sendVerificationCode(email: string): Promise<void> {
  await preAuthenticate({ client: thirdwebClient, strategy: 'email', email });
}

export interface Signer {
  address: string;
  signMessage: (message: string) => Promise<string>;
}

/**
 * Complete the code step and return something that can sign.
 *
 * The returned signer proves control of the key *now*, which is the property
 * the whole auth chain rests on — a bearer token would only prove it was issued
 * at some point in the past to somebody (ADR-004).
 */
export async function connectWithCode(email: string, verificationCode: string): Promise<Signer> {
  const wallet = inAppWallet();
  const account = await wallet.connect({
    client: thirdwebClient,
    strategy: 'email',
    email,
    verificationCode,
  });

  return {
    address: account.address,
    signMessage: async (message: string) => {
      const signature = await account.signMessage({ message });
      return signature;
    },
  };
}
