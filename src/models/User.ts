import mongoose from 'mongoose';

export type Gender = 'male' | 'female' | 'nonbinary' | 'prefer_not_to_say';

export interface IUserProfile {
  name?: string;
  gender?: Gender;
  location?: string;
  learningLanguage?: string;
  photoUrl?: string;
}

export interface IUser extends mongoose.Document {
  email: string;
  passwordHash: string;
  profile: IUserProfile;
  createdAt: Date;
  updatedAt: Date;
}

const UserProfileSchema = new mongoose.Schema<IUserProfile>(
  {
    name: { type: String, trim: true },
    gender: {
      type: String,
      enum: ['male', 'female', 'nonbinary', 'prefer_not_to_say'],
      default: 'prefer_not_to_say',
    },
    location: { type: String, trim: true },
    learningLanguage: { type: String, trim: true },
    photoUrl: { type: String, trim: true },
  },
  { _id: false }
);

const UserSchema = new mongoose.Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    profile: { type: UserProfileSchema, default: {} },
  },
  { timestamps: true }
);

UserSchema.index({ email: 1 }, { unique: true });

export const User = mongoose.model<IUser>('User', UserSchema);
