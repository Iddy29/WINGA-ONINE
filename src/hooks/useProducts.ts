import { useState, useMemo, useEffect } from 'react';
import { Product, FilterOptions } from '../types';
import { fetchProductsFromFirestore } from '../services/products';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/client';

export const useProducts = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<FilterOptions>({
    category: '',
    priceRange: [0, 9999],
    brand: [],
    rating: 0,
    inStock: false
  });
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'rating'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [allProducts, setAllProducts] = useState<Product[]>([]);

  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | null = null;

    // Initial load
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const remote = await fetchProductsFromFirestore();
        if (mounted) {
          setAllProducts(remote);
          setLoading(false);
        }
      } catch (e: any) {
        console.error('Error loading products:', e);
        if (mounted) {
          setError(e.message || 'Failed to load products');
          setAllProducts([]);
          setLoading(false);
        }
      }
    };

    // Set up real-time listener for product updates
    try {
      // Use simple collection query - we sort client-side anyway
      const productsCollection = collection(db, 'products');
      
      unsubscribe = onSnapshot(
        productsCollection,
        (snapshot) => {
          if (!mounted) return;
          
          const products: Product[] = [];
          snapshot.docs.forEach(doc => {
            const data = doc.data();
            try {
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
                inStock: Boolean(data.inStock !== false),
                features: Array.isArray(data.features) ? data.features : [],
                brand: data.brand || '',
                ...(data.originalPrice && { originalPrice: Number(data.originalPrice) }),
                ...(data.discount && typeof data.discount === 'object' && { discount: data.discount })
              };
              
              if (product.name && product.price > 0 && product.image) {
                products.push(product);
              }
            } catch (error) {
              console.error(`Error parsing product ${doc.id}:`, error);
            }
          });
          
          setAllProducts(products);
          setLoading(false);
          setError(null);
        },
        (error) => {
          console.error('Error in products snapshot:', error);
          if (mounted) {
            setError(error.message || 'Failed to sync products');
            // Fallback to initial load
            load();
          }
        }
      );
    } catch (e) {
      console.error('Error setting up products listener:', e);
      // Fallback to initial load
      load();
    }

    return () => {
      mounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const filteredProducts = useMemo(() => {
    let filtered = allProducts.filter(product => {
      // Search query - handle empty/null values
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const nameMatch = product.name?.toLowerCase().includes(query) || false;
        const brandMatch = product.brand?.toLowerCase().includes(query) || false;
        const descMatch = product.description?.toLowerCase().includes(query) || false;
        
        if (!nameMatch && !brandMatch && !descMatch) {
          return false;
        }
      }

      // Category filter
      if (filters.category && product.category !== filters.category) {
        return false;
      }

      // Price range filter
      const price = Number(product.price) || 0;
      if (price < filters.priceRange[0] || price > filters.priceRange[1]) {
        return false;
      }

      // Brand filter
      if (filters.brand.length > 0 && product.brand && !filters.brand.includes(product.brand)) {
        return false;
      }

      // Rating filter
      const rating = Number(product.rating) || 0;
      if (filters.rating > 0 && rating < filters.rating) {
        return false;
      }

      // In stock filter
      if (filters.inStock && !product.inStock) {
        return false;
      }

      return true;
    });

    // Sort products
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = (a.name || '').localeCompare(b.name || '');
          break;
        case 'price':
          comparison = (Number(a.price) || 0) - (Number(b.price) || 0);
          break;
        case 'rating':
          comparison = (Number(a.rating) || 0) - (Number(b.rating) || 0);
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [allProducts, searchQuery, filters, sortBy, sortOrder]);

  return {
    products: filteredProducts,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    filters,
    setFilters,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder
  };
};
