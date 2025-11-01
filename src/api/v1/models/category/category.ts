import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
   {
      name: {
         type: String,
         required: true,
         trim: true,
         unique: true,
      },
      image: String,
      description: {
         type: String,
         trim: true,
      },
   },
   { timestamps: true },
);

const CategoryModel = mongoose.model('Category', categorySchema);

export { CategoryModel };
