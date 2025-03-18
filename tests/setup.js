// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-token-secret';
process.env.MONGO_URI = 'mongodb://localhost:27017/test';

// Mock database
jest.mock('mongoose', () => {
  const mockModel = {
    findOne: jest.fn(),
    findById: jest.fn(),
    deleteMany: jest.fn(),
  };
  
  return {
    connect: jest.fn().mockResolvedValue({}),
    model: jest.fn().mockReturnValue(mockModel),
    Schema: jest.fn().mockReturnValue({}),
  };
});

// Mock email service
jest.mock('../utils/emailService', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue({ id: 'mock-email-id' })
}));

// Mock cloudinary
jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload: jest.fn().mockResolvedValue({
        secure_url: 'https://mock-url.com/image.jpg',
        public_id: 'test-id'
      })
    }
  }
}));