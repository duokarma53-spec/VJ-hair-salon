export interface User {
  id: string;
  username: string;
  name: string;
  role: 'Owner' | 'Manager' | 'Receptionist' | 'Staff';
}

export interface Customer {
  id: number;
  name: string;
  phone: string;
  dob?: string;
  services_taken?: string[];
  products_bought?: string[];
  staff_served?: string[];
  amountPaid?: number;
  payment_due?: number;
  notes?: string;
  createdAt: string;
}

export interface Staff {
  id: string;
  name: string;
  gender: 'Male' | 'Female';
  phone: string;
  joiningDate: string;
  salary: number;
  status: 'Active' | 'Inactive';
}

export interface Service {
  id: string;
  name: string;
  description?: string;
  category: string;
  price: number;
  duration?: number; // in minutes
}

export interface Product {
  id: number;
  name: string;
  purchase_price: number;
  selling_price: number;
  purchased_quantity: number;
  sold_quantity: number;
  salon_consumption: number;
  current_stock: number;
  created_at: string;
}

export interface InventoryLog {
  id: string;
  productId: string;
  productName: string;
  type: 'PURCHASE' | 'SALE' | 'CONSUMPTION';
  quantity: number;
  date: string;
  // For PURCHASE
  costPrice?: number;
  supplierName?: string;
  // For SALE & CONSUMPTION
  sellingPrice?: number; // Only for SALE
  customerId?: number;
  customerName?: string;
  visitId?: string;
}

export interface VisitService {
  id: string;
  visit_id: string;
  service_id: string;
  service_name: string;
  price: number;
}

export interface VisitProduct {
  id: string;
  visit_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
}

export interface CustomerVisit {
  id: string;
  customer_id: number;
  visit_date: string;
  service_total: number;
  product_total: number;
  grand_total: number;
  staff_id: string;
  created_at: string;
  
  // Joins (optional based on API response)
  customer?: Customer;
  staff?: Staff;
  visit_services?: VisitService[];
  visit_products?: VisitProduct[];
}

export interface StaffCommission {
  id: string;
  staff_id: string;
  visit_id: string;
  service_amount: number;
  commission_amount: number;
  created_at: string;
}
export interface Expense {
  id: string;
  title: string;
  amount: number;
  category: string;
  date: string;
  notes?: string;
  paymentMethod: 'Cash' | 'UPI' | 'Bank Transfer' | 'Card';
  status: 'Paid' | 'Pending' | 'Partially Paid';
}
