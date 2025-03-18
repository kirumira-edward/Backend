const { sendVerificationEmail } = require('../utils/emailService');

// Properly mock the Resend module
jest.mock('resend', () => {
  const mockSendFn = jest.fn().mockImplementation(() => {
    return Promise.resolve({ data: { id: 'test-email-id' }, error: null });
  });
  
  return {
    Resend: jest.fn().mockImplementation(() => ({
      emails: {
        send: mockSendFn
      }
    }))
  };
});

describe('Email Service', () => {
  test('sendVerificationEmail returns data on success', async () => {
    const result = await sendVerificationEmail('test@example.com', 'Test', '123456');
    expect(result).toHaveProperty('id');
  });
});