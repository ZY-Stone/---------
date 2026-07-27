/**
 * API 客户端 — 统一请求封装
 *
 * 环境变量 VITE_USE_MOCK=true 时返回 mock 数据（开发 fallback）
 * 否则调用后端 API http://localhost:8800
 */

const BASE = '/api';
const USE_MOCK = import.meta.env?.VITE_USE_MOCK === 'true';

let token: string | null = sessionStorage.getItem('pa_token');

export function setToken(t: string | null) {
  token = t;
  if (t) sessionStorage.setItem('pa_token', t);
  else sessionStorage.removeItem('pa_token');
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string> || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(BASE + path, { ...opts, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(err.detail || `请求失败 (${res.status})`);
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return res.blob() as unknown as T;
}

// ==================== Auth ====================
export async function loginApi(username: string, password: string) {
  const data = await request<{ token: string; user: Record<string, unknown> }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  setToken(data.token);
  return data;
}

// ==================== 产品宽度 ====================
export async function fetchWidthKpi(dept = '') {
  return request<{ kpi: Record<string, unknown>; productCoverage: unknown[] }>(`/analytics/width/kpi?dept=${dept}`);
}
export async function fetchWidthDistribution(dept = '') {
  return request<{ labels: string[]; data: number[] }>(`/analytics/width/distribution?dept=${dept}`);
}
export async function fetchWidthTeam(dept = '') {
  return request<{ teamWidthRank: unknown[] }>(`/analytics/width/team?dept=${dept}`);
}
export async function fetchWidthCustomerAnalysis() {
  return request<{ custGood: unknown[]; custBad: unknown[] }>('/analytics/width/customer-analysis');
}
export async function fetchWidthUserAnalysis() {
  return request<{ userGood: unknown[]; userBad: unknown[] }>('/analytics/width/user-analysis');
}
export async function fetchWidthHeatmap(dept = '') {
  return request<{ total: number; products: unknown[] }>(`/analytics/width/heatmap?dept=${dept}`);
}

// ==================== 潜力产品 ====================
export async function fetchPotentialKpi(dept = '') {
  return request<{ kpi: Record<string, unknown> }>(`/analytics/potential/kpi?dept=${dept}`);
}
export async function fetchPotentialProductRanking(dept = '') {
  return request<{ productRanking: unknown[] }>(`/analytics/potential/product-ranking?dept=${dept}`);
}
export async function fetchPotentialDeptRanking() {
  return request<{ deptRanking: unknown[] }>('/analytics/potential/dept-ranking');
}
export async function fetchPotentialQuadrant() {
  return request<{ quadrant: unknown[] }>('/analytics/potential/quadrant');
}
export async function fetchPotentialCustSegments(limit = 30) {
  return request<{ customerSegments: unknown[] }>(`/analytics/potential/cust-segments?limit=${limit}`);
}
export async function fetchPotentialTeamMatrix() {
  return request<{ products: string[]; teams: unknown[] }>('/analytics/potential/team-matrix');
}
export async function fetchPotentialUserPromotion() {
  return request<{ userPromotion: unknown[] }>('/analytics/potential/user-promotion');
}
export async function fetchPotentialUserCustDetails() {
  return request<{ userCustDetails: unknown[] }>('/analytics/potential/user-cust-details');
}
export async function fetchPotentialTop10(dept = '') {
  return request<{ top10: unknown[] }>(`/analytics/potential/top10?dept=${dept}`);
}
export async function fetchPotentialSummary(dept = '') {
  return request<{ kpi: Record<string, unknown>; top10: unknown[]; deptRanking: unknown[]; prodComposition: unknown[]; quadrant: unknown[] }>(`/analytics/potential/summary?dept=${dept}`);
}

// ==================== 数据总览 ====================
export async function fetchDashboardOverview() {
  return request<{ width: Record<string, unknown>; potential: Record<string, unknown> }>('/analytics/dashboard/overview');
}

// ==================== 导入 ====================
export async function importWidthRecords(rows: unknown[], type: string) {
  return request<{ ok: boolean; count: number }>('/import/width-records', {
    method: 'POST',
    body: JSON.stringify({ rows, type }),
  });
}
export async function importPotentialCust(rows: unknown[]) {
  return request<{ ok: boolean; count: number }>('/import/potential-cust', {
    method: 'POST',
    body: JSON.stringify({ rows }),
  });
}
export async function importPotentialUser(rows: unknown[]) {
  return request<{ ok: boolean; count: number }>('/import/potential-user', {
    method: 'POST',
    body: JSON.stringify({ rows }),
  });
}

// ==================== 组织架构 ====================
export async function fetchDepartments() {
  return request<Array<{ id: number; name: string; leader: string }>>('/admin/departments');
}
export async function fetchGroups(deptId?: number) {
  const params = deptId ? `?dept_id=${deptId}` : '';
  return request<Array<{ id: number; name: string; dept_id: number; leader: string }>>(`/admin/groups${params}`);
}
export async function fetchUsers() {
  return request<Array<{ id: number; username: string; name: string; role: string; dept_name: string; group_name: string; status: string }>>('/admin/users');
}

// ==================== 产品字典 ====================
export async function fetchProducts(params?: { keyword?: string; category?: string; is_potential?: boolean }) {
  const sp = new URLSearchParams();
  if (params?.keyword) sp.set('keyword', params.keyword);
  if (params?.category) sp.set('category', params.category);
  if (params?.is_potential !== undefined) sp.set('is_potential', String(params.is_potential));
  sp.set('size', '200');
  const qs = sp.toString();
  return request<{ data: Array<{ id: number; name: string; alias: string; category: string; isPotential: boolean; sortOrder: number }>; total: number }>(`/products${qs ? '?' + qs : ''}`);
}

// ==================== 审计日志 ====================
export async function fetchAuditLogs() {
  return request<Array<{ id: number; time: string; user: string; name: string; action: string; target: string; detail: string; ip: string }>>('/audit/logs');
}

// ==================== 数据总览 ====================
export async function fetchDashboardOverviewDeptRanking() {
  return request<Array<{ dept: string; sales: number; sales_prev: number; yoy: number; coverage_pct: number }>>('/dashboard/dept-ranking');
}

export { USE_MOCK };
