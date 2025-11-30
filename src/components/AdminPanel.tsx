import React, { useEffect, useState } from 'react';
import { Package, Users, ShoppingBag, Plus, Edit2, Trash2, X, Save, Search, Filter, Tag, LogOut } from 'lucide-react';
import { Product, Category } from '../types';
import { Order } from '../services/orders';
import { User } from '../types';
import { fetchProductsFromFirestore, createProduct, updateProduct, deleteProduct } from '../services/products';
import { fetchCategoriesFromFirestore, createCategory, updateCategory, deleteCategory } from '../services/categories';
import { fetchAllOrders, updateOrderStatus, fetchAllUsers, updateUser, deleteUser, setUserRole } from '../services/admin';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import * as Icons from 'lucide-react';

type Tab = 'products' | 'orders' | 'users' | 'categories';

export const AdminPanel: React.FC = () => {
  const { user, isAdmin, logout } = useAuth();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>('products');
  
  // Products state
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productForm, setProductForm] = useState<Omit<Product, 'id'>>({
    name: '', price: 0, image: '', images: [], category: '', description: '',
    rating: 0, reviews: 0, inStock: true, features: [], brand: '', originalPrice: undefined, discount: undefined
  });
  const [editingProductId, setEditingProductId] = useState<string>('');
  const [showProductForm, setShowProductForm] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  // Orders state
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [orderFilter, setOrderFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Users state
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [userSearch, setUserSearch] = useState('');
  const [editingUserId, setEditingUserId] = useState<string>('');
  const [userForm, setUserForm] = useState<Omit<User, 'id'>>({ name: '', email: '', avatar: undefined, role: 'user' });

  // Categories state
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoryForm, setCategoryForm] = useState<Omit<Category, 'id'>>({ name: '', icon: 'Package', count: 0 });
  const [editingCategoryId, setEditingCategoryId] = useState<string>('');
  const [showCategoryForm, setShowCategoryForm] = useState(false);

  // Load data
  useEffect(() => {
    if (activeTab === 'products') {
      loadProducts().then(async () => {
        // Load categories after products are loaded to calculate counts
        const productsData = await fetchProductsFromFirestore();
        await loadCategoriesWithCounts(productsData);
      });
    }
    if (activeTab === 'orders') loadOrders();
    if (activeTab === 'users') loadUsers();
    if (activeTab === 'categories') {
      // Load products first to calculate category counts
      fetchProductsFromFirestore().then(productsData => {
        loadCategoriesWithCounts(productsData);
      });
    }
  }, [activeTab]);

  const loadProducts = async () => {
    setProductsLoading(true);
    try {
      const items = await fetchProductsFromFirestore();
      setProducts(items);
    } catch (error) {
      showToast('Failed to load products', 'error');
    } finally {
      setProductsLoading(false);
    }
  };

  const loadOrders = async () => {
    setOrdersLoading(true);
    try {
      const items = await fetchAllOrders();
      setOrders(items);
    } catch (error) {
      showToast('Failed to load orders', 'error');
    } finally {
      setOrdersLoading(false);
    }
  };

  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const items = await fetchAllUsers();
      setUsers(items);
    } catch (error) {
      showToast('Failed to load users', 'error');
    } finally {
      setUsersLoading(false);
    }
  };

  const loadCategoriesWithCounts = async (productsList: Product[]) => {
    setCategoriesLoading(true);
    try {
      const categoriesData = await fetchCategoriesFromFirestore();
      // Update category counts based on products
      const updatedCategories = categoriesData.map(cat => {
        const count = productsList.filter(p => p.category === cat.id).length;
        return { ...cat, count };
      });
      setCategories(updatedCategories);
    } catch (error) {
      console.error('Error loading categories:', error);
      showToast('Failed to load categories', 'error');
    } finally {
      setCategoriesLoading(false);
    }
  };

  const loadCategories = async () => {
    // Load categories with current products for counts
    await loadCategoriesWithCounts(products);
  };

  // Product handlers

  const handleProductEdit = (product: Product) => {
    setEditingProductId(product.id);
    const { id, ...rest } = product;
    setProductForm(rest);
    setShowProductForm(true);
  };

  const handleProductDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      await deleteProduct(id);
      showToast('Product deleted successfully', 'success');
      const productsData = await fetchProductsFromFirestore();
      setProducts(productsData);
      await loadCategoriesWithCounts(productsData); // Update category counts
    } catch (error) {
      showToast('Failed to delete product', 'error');
    }
  };

  const resetProductForm = () => {
    setProductForm({
      name: '', price: 0, image: '', images: [], category: '', description: '',
      rating: 0, reviews: 0, inStock: true, features: [], brand: '', originalPrice: undefined, discount: undefined
    });
    setEditingProductId('');
    setShowProductForm(false);
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!productForm.name || !productForm.name.trim()) {
      showToast('Product name is required', 'error');
      return;
    }

    if (!productForm.image || !productForm.image.trim()) {
      showToast('Please provide a main image URL', 'error');
      return;
    }

    if (!productForm.price || productForm.price <= 0) {
      showToast('Product price must be greater than 0', 'error');
      return;
    }

    if (!productForm.category || !productForm.category.trim()) {
      showToast('Please select a category', 'error');
      return;
    }

    try {
      // Prepare product data with proper types
      const productData: Omit<Product, 'id'> = {
        name: productForm.name.trim(),
        price: Number(productForm.price),
        image: productForm.image.trim(),
        images: Array.isArray(productForm.images) ? productForm.images.filter(img => img && img.trim()) : [],
        category: productForm.category.trim(),
        description: productForm.description?.trim() || '',
        rating: Number(productForm.rating) || 0,
        reviews: Number(productForm.reviews) || 0,
        inStock: Boolean(productForm.inStock),
        features: Array.isArray(productForm.features) ? productForm.features.filter(f => f && f.trim()) : [],
        brand: productForm.brand?.trim() || '',
        originalPrice: productForm.originalPrice ? Number(productForm.originalPrice) : undefined,
        discount: productForm.discount && typeof productForm.discount === 'object' ? productForm.discount : undefined
      };

      if (editingProductId) {
        await updateProduct(editingProductId, productData);
        showToast('Product updated successfully', 'success');
      } else {
        await createProduct(productData);
        showToast('Product created successfully', 'success');
      }
      resetProductForm();
      const productsData = await fetchProductsFromFirestore();
      setProducts(productsData);
      await loadCategoriesWithCounts(productsData);
    } catch (error: any) {
      console.error('Error saving product:', error);
      const errorMessage = error?.message || error?.code || 'Unknown error';
      showToast(`Failed to save product: ${errorMessage}`, 'error');
    }
  };

  // Order handlers
  const handleOrderStatusUpdate = async (orderId: string, status: Order['orderStatus']) => {
    try {
      await updateOrderStatus(orderId, status);
      showToast('Order status updated successfully', 'success');
      await loadOrders();
      setSelectedOrder(null);
    } catch (error) {
      showToast('Failed to update order status', 'error');
    }
  };

  // User handlers
  const handleUserEdit = (user: User) => {
    setEditingUserId(user.id);
    const { id, ...rest } = user;
    setUserForm({ ...rest, role: rest.role || 'user' });
  };

  const handleUserSave = async () => {
    try {
      await updateUser(editingUserId, userForm);
      showToast('User updated successfully', 'success');
      setEditingUserId('');
      setUserForm({ name: '', email: '', avatar: undefined, role: 'user' });
      await loadUsers();
      // If current user's role was changed, reload page to update permissions
      if (editingUserId === user?.id && userForm.role !== user.role) {
        window.location.reload();
      }
    } catch (error) {
      showToast('Failed to update user', 'error');
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'user' | 'admin') => {
    try {
      await setUserRole(userId, newRole);
      showToast(`User role updated to ${newRole}`, 'success');
      await loadUsers();
      // If current user's role was changed, reload page to update permissions
      if (userId === user?.id) {
        window.location.reload();
      }
    } catch (error) {
      showToast('Failed to update user role', 'error');
    }
  };

  // Category handlers
  const handleCategoryCreate = async () => {
    try {
      await createCategory(categoryForm);
      showToast('Category created successfully', 'success');
      resetCategoryForm();
      const productsData = await fetchProductsFromFirestore();
      await loadCategoriesWithCounts(productsData);
    } catch (error) {
      showToast('Failed to create category', 'error');
    }
  };

  const handleCategoryUpdate = async () => {
    try {
      await updateCategory(editingCategoryId, categoryForm);
      showToast('Category updated successfully', 'success');
      resetCategoryForm();
      const productsData = await fetchProductsFromFirestore();
      await loadCategoriesWithCounts(productsData);
    } catch (error) {
      showToast('Failed to update category', 'error');
    }
  };

  const handleCategoryDelete = async (categoryId: string) => {
    if (!confirm('Are you sure you want to delete this category? Products in this category will not be deleted.')) {
      return;
    }
    try {
      await deleteCategory(categoryId);
      showToast('Category deleted successfully', 'success');
      const productsData = await fetchProductsFromFirestore();
      await loadCategoriesWithCounts(productsData);
    } catch (error) {
      showToast('Failed to delete category', 'error');
    }
  };

  const handleCategoryEdit = (category: Category) => {
    setEditingCategoryId(category.id);
    const { id, ...rest } = category;
    setCategoryForm(rest);
    setShowCategoryForm(true);
  };

  const resetCategoryForm = () => {
    setCategoryForm({ name: '', icon: 'Package', count: 0 });
    setEditingCategoryId('');
    setShowCategoryForm(false);
  };

  const handleLogout = async () => {
    try {
      await logout();
      showToast('Logged out successfully', 'success');
      // Redirect to home page
      window.location.href = '/';
    } catch (error) {
      console.error('Logout error:', error);
      showToast('Failed to logout', 'error');
    }
  };

  const handleUserDelete = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
    try {
      await deleteUser(userId);
      showToast('User deleted successfully', 'success');
      await loadUsers();
    } catch (error) {
      showToast('Failed to delete user', 'error');
    }
  };

  // Filtered data
  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.brand.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.category.toLowerCase().includes(productSearch.toLowerCase())
  );

  const filteredOrders = orders.filter(order => {
    if (orderFilter === 'all') return true;
    return order.orderStatus === orderFilter;
  });

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  const formatTZS = (amount: number) => `TZS ${amount.toLocaleString('en-US')}`;
  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Access Denied</h2>
          <p className="text-gray-600 mb-6">Please login to access the admin panel</p>
          <button
            onClick={() => window.location.href = '/'}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Access Denied</h2>
          <p className="text-gray-600 mb-6">You need admin privileges to access this panel</p>
          <p className="text-sm text-gray-500 mb-6">
            Contact an administrator to assign you the admin role.
          </p>
          <button
            onClick={() => window.location.href = '/'}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
            <div className="flex items-center space-x-4">
              {user && (
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <span>{user.name}</span>
                  {user.avatar && (
                    <img src={user.avatar} alt={user.name} className="h-8 w-8 rounded-full" />
                  )}
                </div>
              )}
              <button
                onClick={() => window.location.href = '/'}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                ← Back to Shop
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border mb-6">
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('products')}
              className={`flex-1 px-6 py-4 text-center font-medium transition-colors ${
                activeTab === 'products'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Package className="h-5 w-5 inline mr-2" />
              Products
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`flex-1 px-6 py-4 text-center font-medium transition-colors ${
                activeTab === 'orders'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <ShoppingBag className="h-5 w-5 inline mr-2" />
              Orders ({orders.length})
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`flex-1 px-6 py-4 text-center font-medium transition-colors ${
                activeTab === 'users'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Users className="h-5 w-5 inline mr-2" />
              Users ({users.length})
            </button>
            <button
              onClick={() => setActiveTab('categories')}
              className={`flex-1 px-6 py-4 text-center font-medium transition-colors ${
                activeTab === 'categories'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Tag className="h-5 w-5 inline mr-2" />
              Categories ({categories.length})
            </button>
          </div>
        </div>

        {/* Products Tab */}
        {activeTab === 'products' && (
          <div className="space-y-6">
            {/* Products Header */}
            <div className="flex items-center justify-between">
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <button
                onClick={() => {
                  resetProductForm();
                  setShowProductForm(true);
                }}
                className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-5 w-5" />
                <span>Add Product</span>
              </button>
            </div>

            {/* Product Form Modal */}
            {showProductForm && (
              <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                  <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
                    <h2 className="text-xl font-semibold">{editingProductId ? 'Edit Product' : 'Add New Product'}</h2>
                    <button onClick={resetProductForm} className="p-2 hover:bg-gray-100 rounded-lg">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <form onSubmit={handleProductSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
                        <input
                          type="text"
                          required
                          value={productForm.name}
                          onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Brand *</label>
                        <input
                          type="text"
                          required
                          value={productForm.brand}
                          onChange={(e) => setProductForm({ ...productForm, brand: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Price (TZS) *</label>
                        <input
                          type="number"
                          required
                          min="0"
                          value={productForm.price}
                          onChange={(e) => setProductForm({ ...productForm, price: Number(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Original Price (TZS)</label>
                        <input
                          type="number"
                          min="0"
                          value={productForm.originalPrice || ''}
                          onChange={(e) => setProductForm({ ...productForm, originalPrice: e.target.value ? Number(e.target.value) : undefined })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                        <select
                          required
                          value={productForm.category}
                          onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select a category</option>
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                            </option>
                          ))}
                        </select>
                        {categories.length === 0 && (
                          <p className="text-xs text-gray-500 mt-1">No categories available. Create one in the Categories tab.</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Rating</label>
                        <input
                          type="number"
                          min="0"
                          max="5"
                          step="0.1"
                          value={productForm.rating}
                          onChange={(e) => setProductForm({ ...productForm, rating: Number(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Reviews Count</label>
                        <input
                          type="number"
                          min="0"
                          value={productForm.reviews}
                          onChange={(e) => setProductForm({ ...productForm, reviews: Number(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="inStock"
                          checked={productForm.inStock}
                          onChange={(e) => setProductForm({ ...productForm, inStock: e.target.checked })}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="inStock" className="ml-2 text-sm font-medium text-gray-700">In Stock</label>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Main Image URL *</label>
                        <input
                          type="url"
                          required
                          value={productForm.image}
                          onChange={(e) => setProductForm({ ...productForm, image: e.target.value })}
                          placeholder="https://example.com/image.jpg"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {productForm.image && (
                          <div className="mt-2">
                            <img
                              src={productForm.image}
                              alt="Preview"
                              className="w-full h-48 object-cover rounded-lg border border-gray-200"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Additional Images (comma separated URLs)</label>
                      <input
                        type="text"
                        value={productForm.images.join(', ')}
                        onChange={(e) => setProductForm({ ...productForm, images: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                        placeholder="https://example.com/image1.jpg, https://example.com/image2.jpg"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {productForm.images.length > 0 && (
                        <div className="grid grid-cols-4 gap-2 mt-2">
                          {productForm.images.map((url, index) => (
                            <div key={index} className="relative">
                              <img
                                src={url}
                                alt={`Additional ${index + 1}`}
                                className="w-full h-24 object-cover rounded-lg border border-gray-200"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setProductForm(prev => ({
                                    ...prev,
                                    images: prev.images.filter((_, i) => i !== index)
                                  }));
                                }}
                                className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Features (comma separated)</label>
                      <input
                        type="text"
                        value={productForm.features.join(', ')}
                        onChange={(e) => setProductForm({ ...productForm, features: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                      <textarea
                        required
                        rows={4}
                        value={productForm.description}
                        onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex space-x-3 pt-4">
                      <button
                        type="submit"
                        className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        {editingProductId ? 'Update Product' : 'Create Product'}
                      </button>
                      <button
                        type="button"
                        onClick={resetProductForm}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Products List */}
            <div className="bg-white rounded-lg shadow-sm border">
              {productsLoading ? (
                <div className="p-8 text-center">Loading products...</div>
              ) : filteredProducts.length === 0 ? (
                <div className="p-8 text-center text-gray-500">No products found</div>
              ) : (
                <div className="divide-y">
                  {filteredProducts.map((product) => (
                    <div key={product.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                      <div className="flex items-center space-x-4 flex-1">
                        <img src={product.image} alt={product.name} className="w-16 h-16 object-cover rounded-lg" />
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{product.name}</h3>
                          <p className="text-sm text-gray-600">{product.brand} • {product.category}</p>
                          <p className="text-sm font-medium text-gray-900 mt-1">{formatTZS(product.price)}</p>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-semibold ${product.inStock ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {product.inStock ? 'In Stock' : 'Out of Stock'}
                        </div>
                      </div>
                      <div className="flex space-x-2 ml-4">
                        <button
                          onClick={() => handleProductEdit(product)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleProductDelete(product.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <div className="space-y-6">
            {/* Orders Filter */}
            <div className="flex items-center space-x-4">
              <Filter className="h-5 w-5 text-gray-400" />
              <select
                value={orderFilter}
                onChange={(e) => setOrderFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Orders</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {/* Orders List */}
            <div className="bg-white rounded-lg shadow-sm border">
              {ordersLoading ? (
                <div className="p-8 text-center">Loading orders...</div>
              ) : filteredOrders.length === 0 ? (
                <div className="p-8 text-center text-gray-500">No orders found</div>
              ) : (
                <div className="divide-y">
                  {filteredOrders.map((order) => (
                    <div key={order.id} className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="font-semibold text-gray-900">Order #{order.id?.substring(0, 8).toUpperCase()}</h3>
                          <p className="text-sm text-gray-600">{formatDate(order.createdAt)}</p>
                          <p className="text-sm font-medium text-gray-900 mt-1">{formatTZS(order.totalAmount)}</p>
                        </div>
                        <div className="flex items-center space-x-3">
                          <select
                            value={order.orderStatus}
                            onChange={(e) => handleOrderStatusUpdate(order.id!, e.target.value as Order['orderStatus'])}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="pending">Pending</option>
                            <option value="processing">Processing</option>
                            <option value="shipped">Shipped</option>
                            <option value="delivered">Delivered</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                          <button
                            onClick={() => setSelectedOrder(selectedOrder?.id === order.id ? null : order)}
                            className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                          >
                            {selectedOrder?.id === order.id ? 'Hide' : 'View'} Details
                          </button>
                        </div>
                      </div>
                      
                      {selectedOrder?.id === order.id && (
                        <div className="mt-4 pt-4 border-t space-y-4 bg-gray-50 p-4 rounded-lg">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <h4 className="font-semibold text-sm text-gray-700 mb-2">Customer</h4>
                              <p className="text-sm text-gray-600">{order.deliveryInfo.fullName}</p>
                              <p className="text-sm text-gray-600">{order.deliveryInfo.email}</p>
                              <p className="text-sm text-gray-600">{order.deliveryInfo.phone}</p>
                            </div>
                            <div>
                              <h4 className="font-semibold text-sm text-gray-700 mb-2">Delivery Address</h4>
                              <p className="text-sm text-gray-600">{order.deliveryInfo.address}</p>
                              <p className="text-sm text-gray-600">{order.deliveryInfo.city}</p>
                            </div>
                          </div>
                          <div>
                            <h4 className="font-semibold text-sm text-gray-700 mb-2">Items ({order.items.length})</h4>
                            <div className="space-y-2">
                              {order.items.map((item, idx) => (
                                <div key={idx} className="flex items-center space-x-3 text-sm">
                                  <img src={item.product.image} alt={item.product.name} className="w-12 h-12 object-cover rounded" />
                                  <div className="flex-1">
                                    <p className="font-medium">{item.product.name}</p>
                                    <p className="text-gray-600">Qty: {item.quantity} × {formatTZS(item.product.price)}</p>
                                  </div>
                                  <p className="font-semibold">{formatTZS(item.product.price * item.quantity)}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t">
                            <span className="font-semibold">Payment:</span>
                            <span className="text-sm capitalize">{order.paymentMethod.replace('-', ' ')} • {order.paymentStatus}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            {/* Users Search */}
            <div className="max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Users List */}
            <div className="bg-white rounded-lg shadow-sm border">
              {usersLoading ? (
                <div className="p-8 text-center">Loading users...</div>
              ) : filteredUsers.length === 0 ? (
                <div className="p-8 text-center text-gray-500">No users found</div>
              ) : (
                <div className="divide-y">
                  {filteredUsers.map((userItem) => (
                    <div key={userItem.id} className="p-4">
                      {editingUserId === userItem.id ? (
                        <div className="flex items-center space-x-4">
                          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                              <input
                                type="text"
                                value={userForm.name}
                                onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                              <input
                                type="email"
                                value={userForm.email}
                                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                              <select
                                value={userForm.role || 'user'}
                                onChange={(e) => setUserForm({ ...userForm, role: e.target.value as 'user' | 'admin' })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="user">User</option>
                                <option value="admin">Admin</option>
                              </select>
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={handleUserSave}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                              title="Save"
                            >
                              <Save className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => {
                                setEditingUserId('');
                                setUserForm({ name: '', email: '', avatar: undefined, role: 'user' });
                              }}
                              className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg"
                              title="Cancel"
                            >
                              <X className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            {userItem.avatar ? (
                              <img src={userItem.avatar} alt={userItem.name} className="w-12 h-12 rounded-full" />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                                <Users className="h-6 w-6 text-gray-400" />
                              </div>
                            )}
                            <div>
                              <div className="flex items-center space-x-2">
                                <h3 className="font-semibold text-gray-900">{userItem.name}</h3>
                                {userItem.role === 'admin' && (
                                  <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-xs font-semibold rounded-full">
                                    Admin
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-600">{userItem.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <select
                              value={userItem.role || 'user'}
                              onChange={(e) => handleRoleChange(userItem.id, e.target.value as 'user' | 'admin')}
                              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="user">User</option>
                              <option value="admin">Admin</option>
                            </select>
                            <button
                              onClick={() => handleUserEdit(userItem)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => handleUserDelete(userItem.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Categories Tab */}
        {activeTab === 'categories' && (
          <div className="space-y-6">
            {/* Categories Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Manage Categories</h2>
              <button
                onClick={() => {
                  resetCategoryForm();
                  setShowCategoryForm(true);
                }}
                className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-5 w-5" />
                <span>Add Category</span>
              </button>
            </div>

            {/* Category Form Modal */}
            {showCategoryForm && (
              <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
                  <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
                    <h2 className="text-xl font-semibold">{editingCategoryId ? 'Edit Category' : 'Add New Category'}</h2>
                    <button onClick={resetCategoryForm} className="p-2 hover:bg-gray-100 rounded-lg">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (editingCategoryId) {
                        handleCategoryUpdate();
                      } else {
                        handleCategoryCreate();
                      }
                    }}
                    className="p-6 space-y-4"
                  >
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Category Name *</label>
                      <input
                        type="text"
                        required
                        value={categoryForm.name}
                        onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., Electronics, Fashion"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Icon *</label>
                      <select
                        required
                        value={categoryForm.icon}
                        onChange={(e) => setCategoryForm({ ...categoryForm, icon: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="Package">Package</option>
                        <option value="Smartphone">Smartphone</option>
                        <option value="Shirt">Shirt</option>
                        <option value="Home">Home</option>
                        <option value="Book">Book</option>
                        <option value="Dumbbell">Dumbbell</option>
                        <option value="Sparkles">Sparkles</option>
                        <option value="Laptop">Laptop</option>
                        <option value="Headphones">Headphones</option>
                        <option value="Camera">Camera</option>
                        <option value="Gamepad2">Gamepad2</option>
                        <option value="Car">Car</option>
                        <option value="Heart">Heart</option>
                        <option value="ShoppingBag">ShoppingBag</option>
                        <option value="Tag">Tag</option>
                      </select>
                      <p className="text-xs text-gray-500 mt-1">Select an icon from Lucide React icons</p>
                    </div>
                    <div className="flex space-x-3 pt-4">
                      <button
                        type="submit"
                        className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        {editingCategoryId ? 'Update' : 'Create'} Category
                      </button>
                      <button
                        type="button"
                        onClick={resetCategoryForm}
                        className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Categories List */}
            <div className="bg-white rounded-lg shadow-sm border">
              {categoriesLoading ? (
                <div className="p-8 text-center">Loading categories...</div>
              ) : categories.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Tag className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p>No categories found. Create your first category to get started.</p>
                </div>
              ) : (
                <div className="divide-y">
                  {categories.map((category) => {
                    const IconComponent = (Icons as any)[category.icon] || Icons.Package;
                    return (
                      <div key={category.id} className="p-4 flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center">
                            <IconComponent className="h-6 w-6 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">{category.name}</h3>
                            <p className="text-sm text-gray-600">
                              {category.count} product{category.count !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleCategoryEdit(category)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleCategoryDelete(category.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
