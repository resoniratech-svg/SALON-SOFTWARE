export interface StaffListQuery {
  search?: string;
  designationId?: string;
  isActive?: boolean;
  enableAppointments?: boolean;
  page?: number;
  limit?: number;
  export?: 'csv' | 'excel';
}

export interface CreateStaffInput {
  personalDetails: {
    firstName: string;
    lastName: string;
    displayName?: string;
    gender?: string;
    dob?: string;
    mobile: string;
    email?: string;
    address?: string;
    emergencyContactName?: string;
    emergencyContactNumber?: string;
    avatarUrl?: string;
  };
  documents?: {
    documentType: string;
    documentNumber?: string;
    documentUrl: string;
  }[];
  joiningDetails: {
    joiningDate: string;
    designationId: string;
    employeeNumber: string;
    reportingToId?: string | null;
    workingHours: string;
  };
  bankDetails: {
    bankName: string;
    branch: string;
    accountNumber: string;
    ifsc: string;
  };
  appointmentSettings?: {
    enableAppointments: boolean;
    showAllAppointments: boolean;
  };
  weeklySchedule?: {
    dayOfWeek: number;
    shiftId?: string | null;
    isWeeklyOff: boolean;
  }[];
}

export interface UpdateStaffInput {
  personalDetails?: Partial<CreateStaffInput['personalDetails']>;
  documents?: CreateStaffInput['documents'];
  joiningDetails?: Partial<CreateStaffInput['joiningDetails']>;
  bankDetails?: Partial<CreateStaffInput['bankDetails']>;
  appointmentSettings?: Partial<NonNullable<CreateStaffInput['appointmentSettings']>>;
  weeklySchedule?: CreateStaffInput['weeklySchedule'];
}
