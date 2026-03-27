import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { sendWelcomeNewsletter } from './email-sender.js';

export interface NewsletterSubscription {
  id: string;
  email: string;
  subscribed_at: string;
  source: string;
  locale: string;
  unsubscribe_token: string;
  unsubscribed_at: string | null;
}

export type SubscribeResult =
  | { success: true; subscription: NewsletterSubscription }
  | { success: false; duplicate: true; message: string }
  | { success: false; duplicate: false; message: string };

export type UnsubscribeResult =
  | { success: true }
  | { success: false; notFound: true };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

class NewsletterManager {
  private client: SupabaseClient | null = null;

  private getClient(): SupabaseClient {
    if (this.client) return this.client;
    const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY ??
      process.env.SUPABASE_SERVICE_ROLE ??
      process.env.SUPABASE_ANON_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      throw new Error('Supabase credentials not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)');
    }
    this.client = createClient(url, key);
    return this.client;
  }

  async subscribe(email: string, source = 'landing', locale = 'en'): Promise<SubscribeResult> {
    const normalized = email.trim().toLowerCase();
    if (!EMAIL_RE.test(normalized)) {
      return { success: false, duplicate: false, message: 'Invalid email address.' };
    }

    const supabase = this.getClient();
    const { data, error } = await supabase
      .from('newsletter_subscriptions')
      .insert({ email: normalized, source, locale })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return { success: false, duplicate: true, message: 'This email is already subscribed.' };
      }
      throw new Error(`Newsletter insert failed: ${error.message}`);
    }

    const subscription = data as NewsletterSubscription;

    // Fire-and-forget welcome email — never block the subscribe response
    sendWelcomeNewsletter({
      to: subscription.email,
      locale: subscription.locale,
      unsubscribeToken: subscription.unsubscribe_token,
    }).catch((err: unknown) => {
      console.error('[newsletter] Failed to send welcome email:', err);
    });

    return { success: true, subscription };
  }

  async unsubscribe(token: string): Promise<UnsubscribeResult> {
    if (!token) return { success: false, notFound: true };

    const supabase = this.getClient();
    const { data, error } = await supabase
      .from('newsletter_subscriptions')
      .update({ unsubscribed_at: new Date().toISOString() })
      .eq('unsubscribe_token', token)
      .is('unsubscribed_at', null)
      .select('id')
      .maybeSingle();

    if (error) throw new Error(`Newsletter unsubscribe failed: ${error.message}`);
    if (!data) return { success: false, notFound: true };
    return { success: true };
  }

  async listSubscriptions(): Promise<NewsletterSubscription[]> {
    const supabase = this.getClient();
    const { data, error } = await supabase
      .from('newsletter_subscriptions')
      .select('*')
      .order('subscribed_at', { ascending: false });

    if (error) throw new Error(`Newsletter query failed: ${error.message}`);
    return (data ?? []) as NewsletterSubscription[];
  }
}

export const newsletterManager = new NewsletterManager();
