import { CategoryModel } from './category.model';
import { ProductModel } from '../products/product.model';
import { AppError } from '../../middleware/error.middleware';
import { deleteCloudinaryAsset } from '../../services/cloudinary.service';
import type { CategoryInput } from './category.validation';

export async function listCategoriesAdmin() {
  const [categories, productCounts] = await Promise.all([
    CategoryModel.find().sort({ sortOrder: 1, name: 1 }).lean(),
    ProductModel.aggregate([{ $group: { _id: '$categoryId', count: { $sum: 1 } } }]),
  ]);
  const countMap = new Map(productCounts.map((row) => [String(row._id), Number(row.count || 0)]));
  return categories.map((c) => ({
    ...c,
    id: String(c._id),
    parentId: c.parentId ? String(c.parentId) : null,
    productCount: countMap.get(String(c._id)) || 0,
  }));
}

export async function getCategoryById(id: string) {
  const category = await CategoryModel.findById(id).lean();
  if (!category) throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Category not found.');
  const linkedProducts = await ProductModel.countDocuments({
    $or: [{ categoryId: category._id }, { subCategoryId: category._id }],
  });
  return {
    ...category,
    id: String(category._id),
    parentId: category.parentId ? String(category.parentId) : null,
    productCount: linkedProducts,
  };
}

export async function createCategory(input: CategoryInput) {
  const cat = await CategoryModel.create({
    ...input,
    parentId: input.parentId || null,
  });
  return { ...cat.toObject(), id: String(cat._id) };
}

export async function updateCategory(id: string, input: CategoryInput) {
  const updated = await CategoryModel.findByIdAndUpdate(
    id,
    { $set: { ...input, parentId: input.parentId || null } },
    { new: true },
  );
  if (!updated) throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Category not found.');
  return { ...updated.toObject(), id: String(updated._id) };
}

export async function deleteCategory(id: string) {
  const cat = await CategoryModel.findById(id);
  if (!cat) throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Category not found.');
  const linkedProducts = await ProductModel.countDocuments({
    $or: [{ categoryId: cat._id }, { subCategoryId: cat._id }],
  });
  if (linkedProducts > 0) {
    throw new AppError(
      409,
      'CATEGORY_IN_USE',
      `Cannot delete category used by ${linkedProducts} products. Archive or reassign them first.`,
    );
  }
  const childCount = await CategoryModel.countDocuments({ parentId: cat._id });
  if (childCount > 0) {
    throw new AppError(409, 'CATEGORY_HAS_CHILDREN', 'Reassign or delete child subcategories first.');
  }
  if (cat.cloudinaryPublicId) {
    await deleteCloudinaryAsset(cat.cloudinaryPublicId);
  }
  const name = cat.name;
  await cat.deleteOne();
  return { id, name };
}
