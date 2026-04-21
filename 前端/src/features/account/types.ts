export type AccountRole = 'user' | 'admin' | 'super_admin'
export type RegistrationApprovalStatus = 'pending' | 'approved' | 'rejected'

export interface AuthUser {
  id: string
  username: string
  nickname: string | null
  email: string
  avatarUrl: string | null
  bio: string | null
  isActive: boolean
  role: AccountRole
  approvalStatus: RegistrationApprovalStatus
  approvalReviewedAt: string | null
  approvalReviewedBy: string | null
  createdAt: string
  updatedAt: string
  lastLoginAt: string | null
}

export interface LoginSession {
  id: string
  clientType: 'web' | 'mobile' | 'unknown'
  deviceName: string
  ipAddress: string
  userAgent: string
  createdAt: string
  lastSeenAt: string
  expiresAt: string
  current: boolean
}

export interface AuthPayload {
  token: string
  user: AuthUser
  session: LoginSession
}

export interface RegisterResult {
  token: string | null
  user: AuthUser
  session: LoginSession | null
  requiresApproval: boolean
  message: string
}

export interface RegisterConfig {
  registerEnabled: boolean
  registerApprovalRequired: boolean
}

export interface SubmitFeedbackDTO {
  content: string
}

export interface CloudEnvironment {
  id: string
  name: string
  baseUrl: string
}

export interface StudioUiConfig {
  serverUrl: string
  cloudBaseUrl: string
  cloudEnvironments: CloudEnvironment[]
  activeCloudEnvironmentId: string
}

export interface ApiResp<T> {
  success: boolean
  data: T
  error?: string
  message?: string
}
