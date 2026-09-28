export interface PayrollConfigInput {
  staffId?: string | null;
  basicSalary: number;
  hra?: number;
  conveyance?: number;
  medicalAllowance?: number;
  specialAllowance?: number;
  pfPercentage?: number;
  esiPercentage?: number;
  professionalTax?: number;
  tdsPercentage?: number;
  isActive?: boolean;
}

export interface GenerateSalaryInput {
  month: number; // 1 - 12
  year: number; // 2026
  staffId?: string | null; // Optional: individual or all
  workingDays?: number;
  presentDays?: number;
  incentives?: number;
  bonuses?: number;
  paymentMethod?: string;
  notes?: string | null;
  forceRegenerate?: boolean;
}

export interface SalaryFilterQuery {
  page?: number;
  limit?: number;
  staffId?: string;
  month?: number;
  year?: number;
  status?: string;
}

export interface PayslipItem {
  name: string;
  amount: number;
}

export interface PayslipResponse {
  configured: boolean;
  message?: string;
  payslip?: {
    salaryId: string;
    company: {
      id: string;
      name: string;
      code?: string | null;
      address?: string | null;
      contactEmail?: string | null;
      contactPhone?: string | null;
    };
    staff: {
      id: string;
      name: string;
      email?: string | null;
      mobile?: string | null;
      designation?: string | null;
      joiningDate?: string | null;
      bankName?: string | null;
      accountNumber?: string | null;
    };
    period: {
      month: number;
      monthName: string;
      year: number;
      workingDays: number;
      presentDays: number;
    };
    earnings: PayslipItem[];
    deductions: PayslipItem[];
    summary: {
      basicSalary: number;
      totalEarnings: number;
      totalDeductions: number;
      netSalary: number;
      status: string;
      paymentMethod?: string | null;
      paidAt?: string | null;
    };
  };
}

export interface UpdateSalaryInput {
  basicSalary?: number;
  allowances?: number;
  deductions?: number;
  incentives?: number;
  bonuses?: number;
  workingDays?: number;
  presentDays?: number;
  status?: 'PENDING' | 'APPROVED' | 'PAID';
  paymentMethod?: string;
  paidAt?: string | null;
  notes?: string | null;
}

