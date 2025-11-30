import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase/client';
import { Product } from '../types';

export async function fetchProductsFromFirestore(): Promise<Product[]> {
  try {
    const snapshot = await getDocs(collection(db, 'products'));
    const products: Product[] = [];
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      try {
        // Ensure all required fields are present with defaults
        const product: Product = {
          id: doc.id,
          name: data.name || 'Unnamed Product',
          price: Number(data.price) || 0,
          image: data.image || '',
          images: Array.isArray(data.images) ? data.images : [],
          category: data.category || '',
          description: data.description || '',
          rating: Number(data.rating) || 0,
          reviews: Number(data.reviews) || 0,
          inStock: Boolean(data.inStock !== false), // Default to true
          features: Array.isArray(data.features) ? data.features : [],
          brand: data.brand || '',
          ...(data.originalPrice && { originalPrice: Number(data.originalPrice) }),
          ...(data.discount && typeof data.discount === 'object' && { discount: data.discount })
        };
        
        // Only add products with valid data
        if (product.name && product.price > 0 && product.image) {
          products.push(product);
        }
      } catch (error) {
        console.error(`Error parsing product ${doc.id}:`, error);
      }
    });
    
    return products;
  } catch (error: any) {
    console.error('Error fetching products from Firestore:', error);
    throw new Error(error.message || 'Failed to fetch products. Please check your connection and try again.');
  }
}

export async function createProduct(product: Omit<Product, 'id'>): Promise<string> {
  try {
    // Ensure all required fields are present
    const productData = {
      name: product.name,
      price: Number(product.price),
      image: product.image,
      images: Array.isArray(product.images) ? product.images : [],
      category: product.category,
      description: product.description || '',
      rating: Number(product.rating) || 0,
      reviews: Number(product.reviews) || 0,
      inStock: Boolean(product.inStock),
      features: Array.isArray(product.features) ? product.features : [],
      brand: product.brand || '',
      ...(product.originalPrice && { originalPrice: Number(product.originalPrice) }),
      ...(product.discount && typeof product.discount === 'object' && { discount: product.discount })
    };
    
    const ref = await addDoc(collection(db, 'products'), productData);
    return ref.id;
  } catch (error: any) {
    console.error('Error creating product:', error);
    throw new Error(error.message || 'Failed to create product. Please check your permissions and try again.');
  }
}

export async function updateProduct(productId: string, updates: Partial<Omit<Product, 'id'>>): Promise<void> {
  try {
    const ref = doc(db, 'products', productId);
    
    // Clean and validate update data
    const updateData: Record<string, unknown> = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.price !== undefined) updateData.price = Number(updates.price);
    if (updates.image !== undefined) updateData.image = updates.image;
    if (updates.images !== undefined) updateData.images = Array.isArray(updates.images) ? updates.images : [];
    if (updates.category !== undefined) updateData.category = updates.category;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.rating !== undefined) updateData.rating = Number(updates.rating);
    if (updates.reviews !== undefined) updateData.reviews = Number(updates.reviews);
    if (updates.inStock !== undefined) updateData.inStock = Boolean(updates.inStock);
    if (updates.features !== undefined) updateData.features = Array.isArray(updates.features) ? updates.features : [];
    if (updates.brand !== undefined) updateData.brand = updates.brand;
    if (updates.originalPrice !== undefined) updateData.originalPrice = updates.originalPrice ? Number(updates.originalPrice) : null;
    if (updates.discount !== undefined) updateData.discount = updates.discount;
    
    await updateDoc(ref, updateData);
  } catch (error: any) {
    console.error('Error updating product:', error);
    throw new Error(error.message || 'Failed to update product. Please check your permissions and try again.');
  }
}

export async function deleteProduct(productId: string): Promise<void> {
  const ref = doc(db, 'products', productId);
  await deleteDoc(ref);
}


