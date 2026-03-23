import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface NewsletterSubscription {
  id: string;
  email: string;
  subscribed_at: string;
  source: string;
}

export type SubscribeResult =
  | { success: true; subscription: NewsletterSubscription }
  | { success: false; duplicate: true; message: string }
  | { success: false; duplicate: false; message: string };

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

  async subscribe(email: string, source = 'landing'): Promise<SubscribeResult> {
    const normalized = email.trim().toLowerCase();
    if (!EMAIL_RE.test(normalized)) {
      return { success: false, duplicate: false, message: 'Invalid email address.' };
    }

    const supabase = this.getClient();
    const { data, error } = await supabase
      .from('newsletter_subscriptions')
      .insert({ email: normalized, source })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return { success: false, duplicate: true, message: 'This email is already subscribed.' };
      }
      throw new Error(`Newsletter insert failed: ${error.message}`);
    }

    return { success: true, subscription: data as NewsletterSubscription };
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
