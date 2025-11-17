import mongoose from 'mongoose';

let isConnected = false;

export async function connectDatabase(uri = process.env.DATABASE_URL): Promise<void> {
  if (!uri) {
    throw new Error('DATABASE_URL is not set. Please configure your .env file.');
  }

  if (isConnected) {
    return;
  }

  await mongoose.connect(uri);
  isConnected = true;
}

