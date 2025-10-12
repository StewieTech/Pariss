import mongoose from 'mongoose';

export interface IMessage extends mongoose.Document {
  userId?: string;
  role: 'user' | 'assistant' | 'system';
  mode: 'm1' | 'm2' | 'm3';
  content: string;
  createdAt: Date;
}

const MessageSchema = new mongoose.Schema<IMessage>({
  userId: { type: String },
  role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
  mode: { type: String, enum: ['m1', 'm2', 'm3'], required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: () => new Date() }
});

export const Message = mongoose.model<IMessage>('Message', MessageSchema);
