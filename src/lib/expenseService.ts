import { supabase } from './supabase';
import { isToday, isSameMonth, isSameYear, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';

export const expenseService = {
  async getExpenses({ page = 1, limit = 50, search = '', category = '', status = '', month = '' }) {
    let query = supabase
      .from('expenses')
      .select('*', { count: 'exact' })
      .eq('is_deleted', false)
      .order('date', { ascending: false });

    if (search) {
      query = query.ilike('title', `%${search}%`);
    }
    if (category) {
      query = query.eq('category', category);
    }
    if (month) {
      // month is in YYYY-MM format
      const startDate = new Date(`${month}-01`);
      const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
      query = query.gte('date', startDate.toISOString()).lte('date', endDate.toISOString());
    }

    const start = (page - 1) * limit;
    const end = start + limit - 1;
    query = query.range(start, end);

    const { data, count, error } = await query;
    if (error) throw error;

    return { data: data || [], count: count || 0 };
  },

  async getExpenseStats() {
    // For stats, we need today, this month, this year, and pending payments.
    // Instead of doing multiple queries, we can just fetch all amounts and dates if it's not huge.
    // Or do 4 separate aggregated queries. Let's do 4 separate queries with `.select('amount')`
    const now = new Date();

    const [todayRes, monthRes, yearRes] = await Promise.all([
      supabase.from('expenses')
        .select('amount')
        .eq('is_deleted', false)
        .gte('date', startOfDay(now).toISOString())
        .lte('date', endOfDay(now).toISOString()),
      supabase.from('expenses')
        .select('amount, category')
        .eq('is_deleted', false)
        .gte('date', startOfMonth(now).toISOString())
        .lte('date', endOfMonth(now).toISOString()),
      supabase.from('expenses')
        .select('amount')
        .eq('is_deleted', false)
        .gte('date', startOfYear(now).toISOString())
        .lte('date', endOfYear(now).toISOString())
    ]);

    const todayExpenses = (todayRes.data || []).reduce((sum, e) => sum + Number(e.amount), 0);
    const monthExpenses = (monthRes.data || []).reduce((sum, e) => sum + Number(e.amount), 0);
    const yearExpenses = (yearRes.data || []).reduce((sum, e) => sum + Number(e.amount), 0);
    const pendingPayments = 0;

    // Monthly category breakdown
    const categoryBreakdown: Record<string, number> = {};
    (monthRes.data || []).forEach(e => {
      if (!categoryBreakdown[e.category]) categoryBreakdown[e.category] = 0;
      categoryBreakdown[e.category] += Number(e.amount);
    });

    return {
      todayExpenses,
      monthExpenses,
      yearExpenses,
      pendingPayments,
      categoryAnalytics: Object.entries(categoryBreakdown).sort((a, b) => b[1] - a[1])
    };
  }
};
