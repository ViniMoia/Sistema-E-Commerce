import { afterEach, describe, expect, it, vi } from 'vitest';
import { getEmailService, setEmailService, DevEmailService } from '@/lib/email';

afterEach(() => {
  setEmailService(null);
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('email environment boundary', () => {
  it('production without credentials refuses delivery and never logs the reset link', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('RESEND_API_KEY', '');
    const request = vi.fn();
    vi.stubGlobal('fetch', request);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await getEmailService().sendPasswordResetEmail({
      to: 'fixture@example.invalid', name: 'Fixture',
      resetUrl: 'https://fixture.invalid/reset?token=private-fixture-token',
    });
    expect(result.success).toBe(false);
    expect(result.messageId).toBeUndefined();
    expect(request).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
    expect(JSON.stringify(warn.mock.calls)).not.toMatch(/private-fixture-token|fixture@example/);
  });

  it('an explicitly injected development provider cannot simulate success in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const provider = new DevEmailService();
    setEmailService(provider);
    expect(await getEmailService().sendEmail({
      to: 'fixture@example.invalid', subject: 'Private', html: '<p>Private token</p>',
    })).toEqual({ success: false, error: 'DEV_EMAIL_DISABLED_IN_PRODUCTION' });
    expect(provider.sentEmails).toEqual([]);
  });

  it('local simulation remains inspectable in memory without leaking message content to logs', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('RESEND_API_KEY', '');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const provider = getEmailService() as DevEmailService;
    const result = await provider.sendEmail({
      to: 'fixture@example.invalid', subject: 'Private subject', html: 'Private body', text: 'Private token',
    });
    expect(result.success).toBe(true);
    expect(provider.getLastEmail()?.options.text).toBe('Private token');
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/fixture@example|Private/);
  });
});
