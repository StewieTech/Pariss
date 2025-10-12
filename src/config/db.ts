import mongoose from 'mongoose';

export async function connectDb() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/lola';
  await mongoose.connect(uri);
  return mongoose.connection;
}
