// Mock first, then import
jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload: jest.fn().mockImplementation(() => {
        return Promise.resolve({
          secure_url: 'https://cloudinary.com/test-image.jpg',
          public_id: 'test-public-id'
        });
      })
    }
  }
}));

// Now import modules after mocking
const cloudinary = require('cloudinary');
const { uploadProfileImage } = require('../utils/cloudinaryService');

describe('Cloudinary Service', () => {
  test('uploadProfileImage formats response correctly', async () => {
    const result = await uploadProfileImage('data:image/jpeg;base64,ABC123', 'user123');
    expect(result).toHaveProperty('url');
    expect(result).toHaveProperty('publicId');
  });
});